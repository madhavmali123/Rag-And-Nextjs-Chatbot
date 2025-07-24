import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRelevantChunks } from "@/lib/vectorStore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const { query } = req.body;

  const contextChunks = await getRelevantChunks(query);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt = `Answer based on context:\n${contextChunks.join("\n")}\n\nQuery: ${query}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  // console.log(response)
  console.log(prompt)

  res.json({ answer: response.text() });
}
