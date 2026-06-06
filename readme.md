# RAG Chatbot

A full-stack RAG (Retrieval-Augmented Generation) chatbot that compares social media videos — YouTube and Instagram Reels — by extracting transcripts, computing engagement metrics, and answering contextual questions via an LLM-powered chat interface.

## Features

- **Video Input** — paste YouTube and Instagram Reel URLs
- **Transcript Extraction** — pulls captions from YouTube via `youtube-transcript`, transcribes Instagram Reels via yt-dlp + Gemini
- **Metadata & Engagement** — views, likes, comments, follower count, engagement rate via YouTube Data API + yt-dlp
- **Vector Search** — chunks transcripts (~500 tokens with overlap), embeds with Gemini, stores in ChromaDB (with in-memory fallback)
- **RAG Chat** — LangChain prompting with Gemini, streaming SSE, source citations, conversation memory
- **Side-by-Side UI** — video cards with YouTube embed + chat panel, Tailwind CSS

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite + Tailwind CSS | Fast builds, utility-first CSS, minimal JS overhead |
| Backend | Node.js + Express | Simple, fast, async I/O — ideal for proxy/aggregator services |
| Orchestration | LangChain + Gemini | Prompt chaining, context injection, streaming built-in |
| Embeddings | `gemini-embedding-001` (Google) | 768-dim, free tier, no extra infra; replaces OpenAI |
| Vector DB | ChromaDB (in-memory) | Zero-setup for demo; swap to Pinecone/Qdrant at scale |
| LLM | `gemini-2.5-flash` | Low-latency, high-quality, generous free tier |
| Transcripts | `youtube-transcript` + yt-dlp | YouTube captions natively; yt-dlp for Instagram audio |
| Audio | Gemini inline audio (base64) | No separate Whisper model needed — Gemini transcribes directly |

## Setup

### Prerequisites

- Node.js 18+
- Gemini API key (free at https://aistudio.google.com/apikey)
- YouTube Data API key (free at https://console.cloud.google.com)
- Instagram requires browser cookies — log into Instagram in Chrome

### Quick Start

```bash
# Backend
cd backend
cp .env .env.bak   # edit .env with your keys
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`, frontend on `http://localhost:5173`.

## Architecture

```
User → Frontend (React + Tailwind) → Backend (Express)
  → /api/youtube  → YouTube Data API + youtube-transcript
  → /api/instagram → yt-dlp dump-json + audio download → Gemini transcription
  → /api/ingest    → chunk → embed (gemini-embedding-001) → ChromaDB
  → /api/chat      → retrieves top-5 chunks → LangChain prompt → Gemini stream
```

### Flow

1. User pastes YT + IG URLs into the input fields
2. Each "Fetch" button calls its respective backend endpoint
3. Transcript is chunked (500 tokens, 50 overlap), embedded via Gemini, upserted to ChromaDB
4. Chat queries embed the question, find top-5 similar chunks as context
5. A LangChain prompt instructs Gemini to answer based only on that context with source citations
6. Response streams back via SSE (`data:` events for text/sources/done/error)

## Cost & Scalability

### At 1,000 creators/day (~3M requests/month)

| Component | Cost Estimate | Notes |
|-----------|-------------|-------|
| Gemini API (embed + generate + transcribe) | ~$0 (free tier) | Gemini 2.5 Flash has generous limits; embed-001 is free |
| YouTube Data API | $0 | 10K quota/day free = 10K video lookups |
| yt-dlp downloads | $0 | Bandwidth cost only (~1-5 MB per reel audio) |
| ChromaDB | $0 | In-process; at scale swap to Pinecone ($0.25/M vectors/month) |
| Hosting (Render Railway) | ~$7-20/mo | Node + Python sidecar for ChromaDB if needed |

### Bottlenecks at scale

1. **Instagram transcription** — yt-dlp downloads + Gemini audio transcription takes ~5-15s per reel. For 1K/day, parallelize with a job queue (BullMQ + Redis).
2. **YouTube quota** — 10K/day free. At 1K/day you use 2K quota (1 video + 1 channel lookup). Fine at this scale; upgrade to paid ($0.03/1K) at 10K/day.
3. **ChromaDB in-memory** — loses data on restart. For production, use persistent ChromaDB or Pinecone.

### Recommended production stack

Swap the in-memory ChromaDB for Pinecone (serverless, 0 infra) and add a Redis-backed job queue for Instagram transcription. Keep Gemini as the LLM — unbeatable cost/quality ratio at this volume.

## Trade-offs

- **Chunk size 500 / overlap 50** — balances context window with precision for short-form video analysis (hooks, pacing)
- **Gemini over OpenAI** — 1,500 RPM free vs. paid; audio transcription inline without Whisper infra
- **LangChain prompts over LangGraph** — simpler for single-turn retrieval + generation; add LangGraph if multi-agent investigation needed
- **In-memory over persisted vector DB** — zero ops for demo; swap in 5 lines of code to Pinecone
