import "dotenv/config";
import express from "express";
import cors from "cors";
import { getYouTubeData } from "./services/youtube.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
