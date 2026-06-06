import "dotenv/config";
import express from "express";
import cors from "cors";
import { getYouTubeData } from "./services/youtube.js";
import { getInstagramData } from "./services/instagram.js";
import { getStore } from "./services/vectorstore.js";
import { embedChunks, embedQuery } from "./services/embeddings.js";
import { chunkTranscript } from "./services/chunker.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      "http://localhost:5173",
      "http://localhost:4173",
      ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/$/, "")] : []),
    ];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({ app: "RAG Chatbot API", version: "1.0.0" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/youtube", async (req, res) => {
  try {
    const { url, video_id } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const data = await getYouTubeData(url);
    if (video_id) data.metadata.video_id = video_id;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/instagram", async (req, res) => {
  try {
    const { url, video_id } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const data = await getInstagramData(url);
    if (video_id) data.metadata.video_id = video_id;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/ingest", async (req, res) => {
  try {
    const { transcript, video_id } = req.body;
    if (!transcript || !video_id)
      return res.status(400).json({ error: "transcript and video_id are required" });

    const chunks = chunkTranscript(transcript, video_id);
    const store = await getStore();
    const embedded = await embedChunks(chunks);
    const count = await store.addChunks(embedded);

    res.json({ chunks_created: chunks.length, chunks_stored: count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { question, history } = req.body;
  if (!question) return res.status(400).json({ error: "Question is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const store = await getStore();
    const qe = await embedQuery(question);
    const chunks = await store.query(qe, 5);
    const context = chunks.map((c) => `[Video ${c.video_id} — Chunk ${c.index}]: ${c.text}`).join("\n\n");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a social media video analyst. You compare two videos (A and B) and answer questions based ONLY on the provided context.

Context:
${context || "No relevant context found."}

Rules:
- Answer concisely and directly.
- Always cite sources at the end using [Video X — Chunk Y].
- If the context doesn't contain the answer, say so.
- Use the metadata (views, likes, comments, engagement rate) when relevant.

Question: ${question}`;

    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
      }
    }

    if (chunks.length > 0) {
      res.write(`data: ${JSON.stringify({
        type: "sources",
        content: chunks.map((c) => ({ video_id: c.video_id, chunk_index: c.index, text: c.text, score: c.score })),
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err) {
    console.error("Chat error:", err.message);
    res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
  }
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
