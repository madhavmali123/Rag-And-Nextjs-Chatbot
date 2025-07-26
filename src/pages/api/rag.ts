import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRelevantChunks } from "@/lib/vectorStore";
import type { NextApiRequest, NextApiResponse } from 'next';

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

interface RequestBody {
  query: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ answer: string } | { error: string }>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body as RequestBody;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get relevant chunks from vector store
    const contextChunks = await getRelevantChunks(query);
    
    // Filter out irrelevant chunks (empty or too short)
    const filteredChunks = contextChunks
      .filter(chunk => chunk.trim().length > 20)
      .slice(0, 5); // Only use top 3 most relevant chunks

    // If no relevant context found
    if (filteredChunks.length === 0) {
      return res.status(200).json({ 
        answer: "I couldn't find relevant information about this topic in the documents."
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // Improved prompt with clearer instructions
    const prompt = `
    You are a helpful assistant that answers questions based on the provided context.
    If the context doesn't contain the answer, say "I couldn't find that information in the documents."

    Context:
    ${filteredChunks.join("\n---\n")}

    Question: ${query}

    Answer concisely and accurately based only on the context above:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    // Additional check for empty or generic responses
    if (!answer || answer.toLowerCase().includes("i don't know") || answer.length < 10) {
      return res.status(200).json({ 
        answer: "I couldn't find a specific answer to that question in the documents."
      });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    console.error('Error:', error);
    
    // Handle rate limiting specifically
    if (error?.toString().includes('429')) {
      return res.status(429).json({ 
        error: "Too many requests. Please try again later." 
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: errorMessage });
  }
}