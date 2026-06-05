# RAG Chatbot

A full-stack RAG (Retrieval-Augmented Generation) chatbot that compares social media videos — YouTube and Instagram Reels — by extracting transcripts, computing engagement metrics, and answering contextual questions via an LLM-powered chat interface.

## Features

- **Video Input** — paste YouTube and Instagram Reel URLs
- **Transcript Extraction** — pulls captions from both platforms
- **Metadata & Engagement** — views, likes, comments, follower count, engagement rate
- **Vector Search** — chunks transcripts, embeds them (Gemini + OpenAI SDK), stores in ChromaDB
- **RAG Chat** — LangChain/LangGraph orchestration with streaming, source citations, and conversation memory
- **Side-by-Side UI** — video cards + chat panel in one view

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React (Vite)                      |
| Backend     | Node.js, Express                  |
| Orchestration | LangChain / LangGraph           |
| Embeddings  | Gemini API (OpenAI-compatible SDK) |
| Vector DB   | ChromaDB                          |
| LLM         | Gemini / OpenAI                   |
| Transcripts | youtube-transcript, yt-dlp + Whisper |

## Getting Started

### Prerequisites

- Node.js 18+
- Gemini API key (free tier)
- (Optional) OpenAI API key

### Setup

```bash
# Backend
cd backend
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The backend runs on `http://localhost:3001`, frontend on `http://localhost:5173`.

## Architecture

```
User → Frontend (React) → Backend (Express) → YouTube/Instagram APIs
                                                    ↓
                                              Transcript
                                                    ↓
                                              Chunk + Embed (Gemini)
                                                    ↓
                                              ChromaDB (vector store)
                                                    ↓
                                              LangChain RAG → LLM → Streamed response
```

## Commit History

Each feature is built incrementally with a clean git history:

1. Backend scaffold
2. YouTube transcript + metadata endpoint
3. Instagram Reels transcript + metadata endpoint
4. Embeddings + vector DB service
5. RAG chat endpoint (LangChain)
6. Frontend: video input + cards
7. Frontend: chat panel with streaming
8. Integration polish
