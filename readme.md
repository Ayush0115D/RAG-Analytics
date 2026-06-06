# RAG Chatbot

A full-stack Retrieval-Augmented Generation chatbot that compares YouTube and Instagram Reel videos by extracting transcripts, computing engagement metrics, and answering contextual questions via an LLM-powered chat interface.

## Features

- **Video Input** — paste YouTube and Instagram Reel URLs
- **Transcript Extraction** — YouTube captions via `youtube-transcript`, Instagram audio transcription via Gemini
- **Metadata & Engagement** — views, likes, comments, follower count, engagement rate via YouTube Data API + yt-dlp
- **Vector Search** — chunks transcripts (~500 tokens with overlap), embeds via Gemini REST API (`gemini-embedding-001`, 3072-dim), stores in Pinecone serverless vector DB
- **RAG Chat** — retrieves top-5 relevant chunks, streams answer via Gemini 2.5 Flash with SSE
- **Dark/Light Theme** — CSS variables with toggle, clean card-based UI
- **Responsive Dashboard** — side-by-side video cards with YouTube iframe embed + chat panel

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express |
| Embeddings | `gemini-embedding-001` via REST API (3072-dim) |
| Vector DB | Pinecone (serverless, 3072-dim, cosine metric) |
| LLM | `gemini-2.5-flash` with streaming |
| Transcripts | `youtube-transcript`, `@distube/ytdl-core`, youtubetranscript.com API, yt-dlp |
| Audio Transcription | Gemini inline audio (base64) |
| Video Metadata | YouTube Data API v3, yt-dlp |

## Setup

### Prerequisites

- Node.js 18+
- Gemini API key (free at https://aistudio.google.com/apikey)
- YouTube Data API key (free at https://console.cloud.google.com)
- Pinecone API key (free serverless index, 3072-dim, cosine metric)
- Instagram cookies (export via browser extension)

### Quick Start

```bash
# Backend
cd backend
cp .env.example .env   # fill in your API keys
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`, frontend on `http://localhost:5173`.

### Instagram Setup

1. Log into Instagram in your browser
2. Export cookies using "cookies.txt" browser extension
3. Save as `backend/instagram_cookies.txt`
4. The backend reads this file automatically

## Architecture

```
User → Frontend (React + Tailwind) → Backend (Express)
  → /api/youtube    → YouTube Data API + transcript fallbacks
  → /api/instagram  → yt-dlp dump-json + audio → Gemini transcription
  → /api/ingest     → chunk → Gemini embed → Pinecone upsert
  → /api/chat       → Pinecone query → top-5 chunks → Gemini stream
```

### Flow

1. User pastes YouTube and Instagram Reel URLs into input fields
2. Each "Fetch" button calls its respective backend endpoint
3. Transcripts are chunked (500 tokens, 50 overlap), embedded via Gemini, upserted to Pinecone
4. Chat queries embed the question, find top-5 similar chunks via cosine similarity
5. Gemini 2.5 Flash answers with source citations streamed via SSE

## Deployment

- **Frontend** — Vercel (`VITE_API_URL` points to backend)
- **Backend** — Render Web Service
- **Pinecone** — Serverless index (free tier)
- **Instagram** — `INSTAGRAM_COOKIES_B64` env var on Render (base64-encoded cookies.txt)

## Cost & Scalability

| Component | Cost Estimate |
|-----------|-------------|
| Gemini API (embed + generate + transcribe) | ~$0 (free tier) |
| YouTube Data API | $0 (10K quota/day free) |
| yt-dlp downloads | Bandwidth only |
| Pinecone | Free serverless tier |
| Hosting (Render + Vercel) | $0 (free tiers) |

### Bottlenecks

1. **Instagram transcription** — yt-dlp download + Gemini audio transcription takes ~5-15s per reel. Parallelize with a job queue (BullMQ + Redis) at scale.
2. **YouTube quota** — 10K requests/day free. Upgrade to paid ($0.03/1K) beyond that.
3. **Instagram cookies** — expire periodically; re-export required.

## Trade-offs

- **Gemini over OpenAI** — generous free tier, audio transcription inline without Whisper infra
- **Pinecone over ChromaDB** — ChromaDB npm package caused CORS errors in Node.js; Pinecone serverless works via REST API
- **Gemini REST API over SDK** — direct `embedContent` endpoint more reliable than SDK model name resolution
- **Chunk size 500 / overlap 50** — balances context window with precision for short-form video analysis
