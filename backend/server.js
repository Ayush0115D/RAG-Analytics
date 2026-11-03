import "dotenv/config";
import express from "express";
import cors from "cors";
import { getYouTubeData, getSupadataTranscriptJob } from "./services/youtube.js";
import { getInstagramData, ensureYtDlp } from "./services/instagram.js";
import { getStore } from "./services/vectorstore.js";
import { embedChunks, embedQuery } from "./services/embeddings.js";
import { chunkTranscript } from "./services/chunker.js";
import { createUser, authenticateUser, generateToken, verifyToken, getUserById } from "./services/auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));

// Auth middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = verifyToken(header.slice(7));
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Auth routes
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const user = await createUser({ name, email, password });
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    if (err.message === "Email already registered") return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const user = await authenticateUser({ email, password });
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

app.get("/", (_req, res) => {
  res.json({ app: "RAG Chatbot API", version: "1.0.0" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/proxy-image", async (req, res) => {
  try {
    const { u } = req.query;
    if (!u) return res.status(400).json({ error: "url query param required" });
    const url = decodeURIComponent(Buffer.from(u, "base64").toString());
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch image" });
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(400).json({ error: "Image proxy failed" });
  }
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

app.get("/api/youtube/transcript/:jobId", async (req, res) => {
  try {
    res.json(await getSupadataTranscriptJob(req.params.jobId));
  } catch (err) {
    res.status(502).json({ error: err.message });
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
    let msg = err.message || "Instagram fetch failed";
    if (msg.includes("data:") || msg.length > 300) msg = msg.slice(0, 200);
    res.status(400).json({ error: msg });
  }
});

app.post("/api/ingest", async (req, res) => {
  try {
    const { transcript, video_id, session_id } = req.body;
    if (!transcript || !video_id)
      return res.status(400).json({ error: "transcript and video_id are required" });

    const store = await getStore();
    const ns = session_id || undefined;

    const chunks = chunkTranscript(transcript, video_id);
    const embedded = await embedChunks(chunks);
    const count = await store.addChunks(embedded, ns);

    console.log(`Ingest ${video_id}: ${chunks.length} chunks created, ${embedded.length} embedded, ${count} total in store`);

    res.json({ chunks_created: chunks.length, chunks_stored: count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { question, history, video_ids, session_id } = req.body;
  if (!question) return res.status(400).json({ error: "Question is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const store = await getStore();
    const qe = await embedQuery(question);
    const filter = video_ids?.length > 0 ? { video_id: { $in: video_ids } } : {};
    const ns = session_id || undefined;
    const chunks = await store.query(qe, 5, filter, ns);
    console.log(`Chat: retrieved ${chunks.length} chunks for question "${question.slice(0, 50)}..."`);
    const context = chunks.map((c) => `[Video ${c.video_id} — Chunk ${c.index}]: ${c.text}`).join("\n\n");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a video content analyst comparing two videos. Answer the user's question based ONLY on the transcript chunks below.

${context ? `## Transcript Context\n${context}` : "No relevant transcript content found for this question."}

## Instructions
- Answer directly and conversationally — no markdown formatting, no bullet lists, no bold text.
- If the context contains relevant information, reference specific moments using [Video A — Chunk N] or [Video B — Chunk N].
- Compare the two videos where possible: contrast their topics, tone, style, or hooks.
- If the context doesn't contain enough information to answer, say so clearly.
- If only one video has relevant content, answer based on what's available.

## Question
${question}`;

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

async function start() {
  try {
    await ensureYtDlp();
    console.log("yt-dlp ready");
  } catch (e) {
    console.warn("yt-dlp download failed:", e.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
start();
