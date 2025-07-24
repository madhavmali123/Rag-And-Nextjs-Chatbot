import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini embedding model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embedModel = genAI.getGenerativeModel({ model: "models/text-embedding-004" });

// Initialize Pinecone
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index(process.env.PINECONE_INDEX!);

/**
 * Upserts chunks into Pinecone vector DB after embedding.
 */
export async function upsertChunks(chunks: string[]) {
  for (const chunk of chunks) {
    const embeddingResponse = await embedModel.embedContent({
      content: {
        parts: [{ text: chunk }],
        role: "user"
      }
    });

    const vector = {
      id: crypto.randomUUID(),
      values: embeddingResponse.embedding.values,
      metadata: { text: chunk }
    };

    await index.upsert([vector]);
  }
}

/**
 * Queries Pinecone index using embedded query.
 */
export async function getRelevantChunks(query: string): Promise<string[]> {
  const result = await embedModel.embedContent({
    content: {
      parts: [{ text: query }],
      role: "user"
    }
  });

  const queryEmbedding = result.embedding.values;

  const search = await index.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true
  });

  return search.matches.map((match: any) => match.metadata.text);
}
