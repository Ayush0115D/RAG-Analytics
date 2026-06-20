# RAG Chatbot

A full-stack Retrieval-Augmented Generation chatbot that compares Instagram Reel videos (fully working) with YouTube videos (metadata only — transcript extraction blocked on cloud hosting) by computing engagement metrics and answering contextual questions via an LLM-powered chat interface.

## Features

- **Video Input** — paste YouTube and Instagram Reel URLs
- **Transcript Extraction** — Instagram audio transcription via Gemini; YouTube transcript extraction is limited (see [Limitations](#limitations))
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
| YouTube Transcripts | 4 methods attempted — all return 0 entries on Render (see [Limitations](#limitations)) |
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
  → /api/youtube        → YouTube Data API + transcript fallbacks
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
3. Transcripts (Instagram always; YouTube only if available locally) are chunked (500 tokens, 50 overlap), embedded via Gemini, upserted to Pinecone
4. Chat queries embed the question, find top-5 similar chunks via cosine similarity
5. Gemini 2.5 Flash answers with source citations streamed via SSE

## Deployment

- **Frontend** — Vercel (`VITE_API_URL` points to backend). SPA routing is handled via `vercel.json` rewrites rule.
- **Backend** — Render Web Service
- **Pinecone** — Serverless index (free tier)
- **Instagram** — `INSTAGRAM_COOKIES_B64` env var on Render (base64-encoded cookies.txt)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Create account (name, email, password) |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Bearer | Verify token, get user |
| POST | `/api/youtube` | No | Fetch YouTube video metadata + transcript |
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
| yt-dlp downloads (Instagram only) | Bandwidth only |
| Pinecone | Free serverless tier |
| Hosting (Render + Vercel) | $0 (free tiers) |

#

## Limitations

### YouTube Transcripts on Cloud Hosting (Render)

YouTube transcripts do **not** work when the backend is deployed on Render (or similar cloud platforms). All 4 attempted transcript methods return an empty array `[]`:

| Method | What It Does | Why It Fails on Render |
|--------|-------------|----------------------|
| `youtube-transcript` npm package | Fetches transcript via YouTube's internal API | Unknown — returns 0 entries (possibly rate-limited or IP-blocked for Render's egress IP range) |
| `@distube/ytdl-core` caption tracks | Parses `player_response` for `captionTracks`, fetches the XML caption URL | `ytdl.getInfo()` succeeds but `captionTracks` array is empty — YouTube omits captions from the player response for Render IPs |
| `youtubetranscript.com` text page | Scrapes `youtubetranscript.com/?v=VIDEO_ID` | Returns HTML with no transcript data — the site is a client-side JS app, not a plain-text endpoint |
| `youtubetranscript.com` API | Calls `youtubetranscript.com/api?vid=VIDEO_ID` | Returns **404** — the API endpoint no longer exists |

**Root cause:** YouTube's anti-bot measures block Render's IP range. This affects all methods that rely on YouTube's internal endpoints or CDN (`googlevideo.com`). Audio download (for Gemini transcription) is also blocked at the CDN level — this is an infrastructure limitation, not an auth issue, so OAuth/cookies do not help. Upgrading from Render's free to paid tier does not change the IP range — same problem.

**What does work:**
- YouTube metadata (title, views, likes, comments, duration, thumbnail, channel subscriber count) — via YouTube Data API v3 ✓
- Instagram reels (audio download + Gemini transcription + metadata) — fully functional ✓

**What does not work on Render:**
- YouTube transcripts (all methods) ✗
- YouTube audio download for Gemini transcription ✗

**Local development:** YouTube transcripts may work locally depending on your IP address. The limitation is specific to cloud deployment environments with datacenter IP ranges.

### How Production Services Solve This

Companies that reliably extract YouTube transcripts at scale use one of the following approaches — none of which are hobby-level npm packages:

1. **YouTube Data API captions.download (official, limited)**
   The only official way. `GET https://www.googleapis.com/youtube/v3/captions/{id}` returns the raw caption file. Requires OAuth 2.0 with the channel owner's consent. Only works for videos that have **manually uploaded** captions (not auto-generated). Most YouTube content does not qualify.

2. **Residential proxies**
   Route requests through real home IPs (BrightData, Oxylabs, ScrapingBee). YouTube cannot distinguish them from regular users. The transcripts can then be fetched via headless browser or even direct API calls. Cost: ~$5–$15/GB of proxy traffic. This is the most common production approach.

3. **Headless browser + residential IP**
   Run Playwright/Puppeteer to fully render YouTube's watch page, let the client-side JS load the `timedtext` API response, and extract captions from the DOM. Combined with a residential proxy, this mimics a real user exactly. Still blocked if using a datacenter IP.

4. **youtubetranscript.com with headless rendering**
   The site `youtubetranscript.com` still shows transcripts in the browser (client-side JS renders them after fetch). A headless browser can wait for the DOM to populate and extract the text. The `/api?vid=` endpoint no longer exists, so direct HTTP fetch of plain text is impossible.

**Key takeaway:** The `youtube-transcript` npm package, `ytdl-core`, and `youtubetranscript.com` API are hobby tools that break frequently. Production services use the official YouTube Data API captions endpoint (limited scope) or residential proxies with headless browsers (paid, reliable). Neither approach fits a free-tier hobby project.
