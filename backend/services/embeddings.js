import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const EMBEDDING_MODEL = "gemini-embedding-001";

export async function embedText(text) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function embedChunks(chunks) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const result = await model.embedContent(chunk.text);
      return {
        ...chunk,
        embedding: result.embedding.values,
      };
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function embedQuery(query) {
  return embedText(query);
}
