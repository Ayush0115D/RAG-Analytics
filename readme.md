# RAG Chatbot

A full-stack Retrieval-Augmented Generation chatbot that compares Instagram Reel and YouTube videos by computing engagement metrics and answering contextual questions via an LLM-powered chat interface.

## Features

- **Video Input** — paste YouTube and Instagram Reel URLs
- **Transcript Extraction** — Instagram audio transcription via Gemini; production YouTube transcription via Supadata when configured (see [Limitations](#limitations))
- **Metadata & Engagement** — views, likes, comments, follower count, engagement rate via YouTube Data API (YouTube) and yt-dlp (Instagram)
- **Vector Search** — chunks transcripts (~500 tokens with overlap), embeds via Gemini REST API (`gemini-embedding-001`, 3072-dim), stores in Pinecone serverless vector DB
- **RAG Chat** — retrieves top-5 relevant chunks, streams answer via Gemini 2.5 Flash with SSE
- **Dark/Light Theme** — CSS variables with toggle, clean card-based UI
- **Responsive Dashboard** — side-by-side video cards with YouTube iframe embed + chat panel
- **Sources Panel** — clickable chunk chips in chat showing video ID, chunk index, confidence score
- **Link History** — collapsible card with copy/load/clear buttons, platform badges, timestamps, max 20 entries
- **Session Persistence** — saves URL inputs, video metadata, chat messages, link history to localStorage (500ms debounced)
- **Toast Notifications** — success/error/info with slide-in animation
- **Skeleton Shimmers** — animated placeholder cards while videos load
- **Staggered Entrance Animations** — cascading `.dash-entrance` delays
- **Image Proxy** — Instagram CDN thumbnails proxied through backend (base64-encoded URLs to bypass ad blockers)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express |
| Embeddings | `gemini-embedding-001` via REST API (3072-dim) |
| Vector DB | Pinecone (serverless, 3072-dim, cosine metric) |
| LLM | `gemini-2.5-flash` with streaming |
| YouTube Transcripts | Supadata API |
| Instagram Audio Transcript | yt-dlp download → Gemini inline audio (base64) transcription |
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

### Instagram Cookies

The backend supports three ways to provide Instagram cookies:

1. **`INSTAGRAM_COOKIES_B64` env var** (recommended for production) — base64-encoded cookies.txt content
2. **`INSTAGRAM_COOKIES_FILE` env var** — path to a cookies.txt file (resolved relative to `backend/`)
3. **`--cookies-from-browser`** (Windows local only) — yt-dlp extracts cookies from your browser

On Render, set `INSTAGRAM_COOKIES_B64` in the dashboard. On local, place `instagram_cookies.txt` in the `backend/` directory or set the env var.

## Architecture

```
User → Frontend (React + Tailwind) → Backend (Express)
  → /api/youtube        → YouTube Data API + Supadata transcript API
  → /api/youtube/transcript/:jobId → poll long-running Supadata transcript jobs
  → /api/instagram      → yt-dlp dump-json + audio → Gemini transcription
  → /api/ingest         → chunk → Gemini embed → Pinecone upsert
  → /api/chat           → Pinecone query → top-5 chunks → Gemini stream
  → /api/proxy-image    → fetch external image → return with CORS headers
  → /api/auth/signup    → bcrypt hash → store in users.json → return JWT
  → /api/auth/login     → verify password → return JWT
  → /api/auth/me        → verify JWT → return user
```

### Flow

1. User pastes YouTube and Instagram Reel URLs into input fields
2. Each "Fetch" button calls its respective backend endpoint
3. Available transcripts are chunked (500 tokens, 50 overlap), embedded via Gemini, and upserted to Pinecone
4. Chat queries embed the question, find top-5 similar chunks via cosine similarity
5. Gemini 2.5 Flash answers with source citations streamed via SSE

## Deployment

- **Frontend** — Vercel (`VITE_API_URL` points to backend). SPA routing is handled via `vercel.json` rewrites rule.
- **Backend** — Render Web Service
- **Pinecone** — Serverless index (free tier)
- **Instagram** — `INSTAGRAM_COOKIES_B64` env var on Render (base64-encoded cookies.txt)
- **YouTube transcripts** — set `SUPADATA_API_KEY` in the Render backend environment, then redeploy. Create a key at [Supadata](https://dash.supadata.ai/organizations/api-key). Keep the key server-side; never add it to the frontend.

`SUPADATA_MODE=auto` (default) tries existing captions and can generate a transcript when captions are unavailable; generated transcripts may incur Supadata usage charges. Set `SUPADATA_MODE=native` to use existing captions only. `SUPADATA_LANG=en` selects the preferred language.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Create account (name, email, password) |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Bearer | Verify token, get user |
| POST | `/api/youtube` | No | Fetch YouTube video metadata + transcript |
| GET | `/api/youtube/transcript/:jobId` | No | Check an asynchronous YouTube transcript job |
| POST | `/api/instagram` | No | Fetch Instagram reel metadata + transcript |
| POST | `/api/ingest` | No | Chunk + embed + store transcript |
| POST | `/api/chat` | No | Ask question, stream SSE response |
| GET | `/api/proxy-image?u=` | No | Proxy external images (base64-encoded URL) |
| GET | `/api/health` | No | Health check |

## Cost & Scalability

| Component | Cost Estimate |
|-----------|-------------|
| Gemini API (embed + generate + transcribe) | ~$0 (free tier) |
| YouTube Data API | $0 (10K quota/day free) |
| Supadata YouTube transcription | Usage-based; `auto` may generate transcripts |
| yt-dlp downloads (Instagram only) | Bandwidth only |
| Pinecone | Free serverless tier |
| Hosting (Render + Vercel) | $0 (free tiers) |

#

## Limitations

### YouTube Transcripts on Cloud Hosting (Render)

**Problem and investigation:** YouTube metadata worked, but transcript extraction failed on Render. Logs showed YouTube rate-limiting/captcha errors (`429`) and forbidden responses (`403`). Four direct approaches were tried: the `youtube-transcript` package, caption tracks via `ytdl-core`, the `youtubetranscript.com` page, and its API endpoint. All failed from Render, so adding retries or more direct scraping methods would not address the hosting IP restriction.

**Chosen solution:** Supadata is the single YouTube transcript provider. The backend sends the video URL to Supadata and the frontend polls for long-running results. The failed direct methods are no longer called; the Supadata key stays on the server.

**Production setup:** add `SUPADATA_API_KEY` to the Render backend environment and redeploy. `SUPADATA_MODE=auto` is the default and may incur provider charges; `native` uses existing captions only. If Supadata fails or returns no transcript, the dashboard reports the issue and the app does not ingest empty text. Old chunks for that video slot are cleared so stale content cannot appear in chat. Fetch the video again after deployment to replace old chunks.

YouTube metadata is still fetched separately through the YouTube Data API. Supadata may not return a transcript for private, unavailable, or unsupported videos.
