
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with error checking
if (!process.env.GEMINI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
  throw new Error("Missing required environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({ 
  apiKey: process.env.PINECONE_API_KEY,
  fetchApi: globalThis.fetch
});

const index = pinecone.index(process.env.PINECONE_INDEX);
const embedModel = genAI.getGenerativeModel({ 
  model: "models/text-embedding-004",
  generationConfig: {
    maxOutputTokens: 1000
  }
});

interface Vector {
  id: string;
  values: number[];
  metadata: {
    text: string;
    chunkId: string;
    timestamp: number;
  };
}

// Helper for content-based IDs
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Main function to upsert chunks
export async function upsertChunks(chunks: string[], batchSize = 100): Promise<void> {
  if (!chunks.length) return;

  const vectors: Vector[] = [];
  
  for (const chunk of chunks) {
    try {
      const embeddingResponse = await embedModel.embedContent({
        content: {
          parts: [{ text: chunk }],
          role: "user"
        }
      });

      vectors.push({
        id: await generateContentHash(chunk),
        values: embeddingResponse.embedding.values,
        metadata: {
          text: chunk,
          chunkId: await generateContentHash(chunk),
          timestamp: Date.now()
        }
      });

      if (vectors.length >= batchSize) {
        await index.upsert(vectors);
        vectors.length = 0;
      }
    } catch (error) {
      console.error(`Failed to process chunk: ${error}`);
    }
  }
       console.log("vectors created  :- "+ vectors.length)
  if (vectors.length > 0) {
    await index.upsert(vectors);
  }
}

// Function to query relevant chunks
export async function getRelevantChunks(query: string): Promise<string[]> {
  const embeddingResponse = await embedModel.embedContent({
    content: {
      parts: [{ text: query }],
      role: "user"
    }
  });

  const searchResults = await index.query({
    vector: embeddingResponse.embedding.values,
    topK: 5,
    includeMetadata: true
  });

  return searchResults.matches
    .map(match => match.metadata?.text)
    .filter((text): text is string => typeof text === 'string');
}

// Verification function
export async function verifyPineconeConnection(): Promise<boolean> {
  try {
    const stats = await index.describeIndexStats();
    
    // Type-safe property access with default value
    const recordCount = ('totalRecordCount' in stats && typeof stats.totalRecordCount === 'number')
      ? stats.totalRecordCount
      : 0;
    
    return recordCount > 0;
    
  } catch (error) {
    console.error("Pinecone connection failed:", error);
    return false;
  }
}