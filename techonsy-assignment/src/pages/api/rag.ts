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

    const contextChunks = await getRelevantChunks(query);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `Answer based on context:\n${contextChunks.join("\n")}\n\nQuery: ${query}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    console.log(prompt);

    return res.status(200).json({ answer: response.text() });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: errorMessage });
  }
}