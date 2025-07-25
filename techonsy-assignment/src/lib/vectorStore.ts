import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini embedding model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embedModel = genAI.getGenerativeModel({ model: "models/text-embedding-004" });

// Initialize Pinecone
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index(process.env.PINECONE_INDEX!);

interface Vector {
  id: string;
  values: number[];
  metadata: {
    text: string;
  };
}

/**
 * Upserts chunks into Pinecone vector DB after embedding.
 */
export async function upsertChunks(chunks: string[]): Promise<void> {
  for (const chunk of chunks) {
    const embeddingResponse = await embedModel.embedContent({
      content: {
        parts: [{ text: chunk }],
        role: "user"
      }
    });

    const vector: Vector = {
      id: crypto.randomUUID(),
      values: embeddingResponse.embedding.values,
      metadata: { text: chunk }
    };

    await index.upsert([vector]);
  }
}

interface SearchMatch {
  metadata: {
    text: string;
  };
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

  return search.matches
  .map((match) => match.metadata?.text)
  .filter((text): text is string => typeof text === 'string');

}
