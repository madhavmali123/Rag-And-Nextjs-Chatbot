"use client";
import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ question: string; answer: string }[]>([]);

  const handleQuery = async () => {
    if (!query.trim()) return;

    const res = await fetch("/api/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    const newEntry = { question: query, answer: data.answer || "No response" };

    setChat((prev) => [...prev, newEntry]);
    setQuery("");
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/embed", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    
    

  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-6 text-center text-white">
        Chat with PDF 📄 using Gemini + Pinecone
      </h1>

      {/* Upload PDF */}
      <div className="mb-8 bg-gray-800 shadow-lg rounded-lg p-6 w-full max-w-md border border-gray-700">
        <label className="block text-sm font-semibold mb-2">Upload a PDF</label>
        <input
          type="file"
          onChange={handleUpload}
          className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
        />
      </div>

      {/* Chat Window */}
      {chat.length > 0 && (
        <div className="w-full max-w-2xl bg-gray-800 p-4 rounded-lg shadow-lg mb-6 overflow-y-auto space-y-4 max-h-[500px] transition-all duration-300">
          {chat.map((entry, index) => (
            <div key={index}>
              {/* Question */}
              <div className="flex justify-end mb-2">
                <div className="bg-indigo-600 text-white p-3 rounded-lg max-w-xs text-sm">
                  {entry.question}
                </div>
              </div>
              {/* Answer */}
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-100 p-3 rounded-lg max-w-xs text-sm">
                  {entry.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="w-full max-w-2xl flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask something about the PDF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleQuery}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
