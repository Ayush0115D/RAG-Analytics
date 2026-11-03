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
| YouTube Transcripts | Supadata API in production, with direct YouTube fallbacks |
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
  → /api/youtube        → YouTube Data API + Supadata transcript provider + direct fallbacks
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

Direct YouTube transcript extraction can fail from Render because YouTube blocks or limits requests from some datacenter IP ranges. The app now supports Supadata as a production transcript provider. Configure `SUPADATA_API_KEY` on the backend to route transcript requests through Supadata; long-running transcription jobs are polled asynchronously. If the key is not configured, the backend continues trying its original direct methods:

| Method | What It Does | Why It Fails on Render |
|--------|-------------|----------------------|
| `youtube-transcript` npm package | Fetches transcript via YouTube's internal API | Unknown — returns 0 entries (possibly rate-limited or IP-blocked for Render's egress IP range) |
| `@distube/ytdl-core` caption tracks | Parses `player_response` for `captionTracks`, fetches the XML caption URL | `ytdl.getInfo()` succeeds but `captionTracks` array is empty — YouTube omits captions from the player response for Render IPs |
| `youtubetranscript.com` text page | Scrapes `youtubetranscript.com/?v=VIDEO_ID` | Returns HTML with no transcript data — the site is a client-side JS app, not a plain-text endpoint |
| `youtubetranscript.com` API | Calls `youtubetranscript.com/api?vid=VIDEO_ID` | Returns **404** — the API endpoint no longer exists |

**Root cause:** direct methods rely on YouTube's internal endpoints or CDN (`googlevideo.com`), which can block datacenter egress IPs. The Supadata integration avoids relying on Render's YouTube egress IP for transcript retrieval. It is an external service and does not guarantee a transcript for private, unavailable, or unsupported videos.

**What does work:**
- YouTube metadata (title, views, likes, comments, duration, thumbnail, channel subscriber count) — via YouTube Data API v3 ✓
- Instagram reels (audio download + Gemini transcription + metadata) — fully functional ✓

**What still does not work on Render without a provider key:**
- YouTube transcripts when YouTube blocks the Render IP ✗
- YouTube audio download for Gemini transcription ✗

**Production setup:** create a Supadata API key and add it as `SUPADATA_API_KEY` in Render's backend environment variables. Leave `SUPADATA_MODE` unset for `auto`, or set it to `native` to avoid AI transcript generation (only videos with available captions can then work). Redeploy the backend after setting the variable. If no transcript is available, the dashboard displays a warning instead of reporting a successful ingestion.

### How Production Services Solve This

For public videos where the owner has not granted caption access, a hosted transcript provider is the most practical option for this app. Alternatives include:

1. **YouTube Data API captions.download (official, limited)**
   The only official way. `GET https://www.googleapis.com/youtube/v3/captions/{id}` returns the raw caption file. Requires OAuth 2.0 with the channel owner's consent. Only works for videos that have **manually uploaded** captions (not auto-generated). Most YouTube content does not qualify.

2. **Hosted transcript API (implemented)**
   Supadata provides YouTube transcript retrieval and optional AI transcription through an API key. The backend integration is enabled by `SUPADATA_API_KEY`; `auto` may consume paid usage, while `native` only fetches existing captions.

3. **Deploy where direct YouTube access is available**
   A different host or egress network may work, but YouTube can still restrict datacenter IPs, so this is not a dependable fix by itself.

**Key takeaway:** changing retries or adding YouTube cookies to Render does not solve a network-level IP restriction. The implemented provider is the recommended production method; it requires a backend API key and may incur provider usage charges.
