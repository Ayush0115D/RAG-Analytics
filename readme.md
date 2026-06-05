# Technical Round Challenge - Engineers


There are free (and trial) versions of every tool below. If you can't find one — find a free alternative.

- The job of an engineer is to solve problems nobody else can. This is purposefully a test of your resourcefulness.
- If this is too hard for you, please do not submit a demo. You won't be able to handle the tasks we actually assign internally. But if you can handle this, you'll be a 'top 1% engineer' on our interview list.
- 📍If you make it past the technical screening round, you'll schedule an interview with the CEO or Head of Engineering. You'll do the demonstration LIVE on the call.
- Not a previous execution - a new one, start to finish.

**GOOD LUCK!**

## Rules

1. Do things all dynamically.
2. Must be a full-stack RAG chatbot.
3. Must use **LangChain or LangGraph** + embeddings + a vector DB.
    1. Use the stack listed below — but if you have a better alternative with reasoning, that's welcome as an addition to the demo.
4. Every output must be dynamic / not hard-coded. Inputs can be hard-coded.
5. Once done, demo on a Loom; No bugs. No excuses.
    1. Explain how this is the highest-quality, lowest-cost method to run this at scale (1000 creators a day). If it isn't the most efficient on cost and quality, tell us a better alternative.
    2. Bottom line: The work must get done no matter what, in a timely manner (as per given deadline). Looking for REASONING on why this is the best solution.
    3. We want you to think over costing & scalability. 

**Note - We don’t want Claude prompters we want Engineers who can think & build scalable products.**

## RAG Chatbot Task

1. Take **two social media video URLs** as input (YouTube and Instagram Reels - **mandatory)**.
2. Pull the **transcript** and **metadata** for both videos (views, likes, comments, creator, follower count, hashtags, upload date, duration).
3. Compute **engagement rate** = (likes + comments) / views × 100.
4. **Chunk + embed** the transcripts and store in a **vector DB** (Pinecone, Weaviate, ChromaDB, Qdrant, or pgvector). Tag every chunk with `video_id` (A or B).
5. Build a **RAG chat interface** (LangChain or LangGraph) where a creator can ask:
    - *Why did Video A get more engagement than Video B?*
    - *What's the engagement rate of each?*
    - *Compare the hooks in the first 5 seconds.*
    - *Who's the creator of Video B and what's their follower count?*
    - *Suggest improvements for B based on what worked in A.*
6. Responses must **stream**, **cite sources** (which video + which chunk), and **maintain memory** across turns.
7. Build a **vibe-coded frontend** — side-by-side video cards + chat panel. (We dont care about aesthetics if it aint laggy). We care about performance, speed & quality.

## Tech Stack

- **Frontend:** React / Next.js
- **Backend:** FastAPI or Node.js
- **Orchestration:** LangChain or LangGraph (mandatory)
- **Embeddings:** OpenAI / Cohere / open-source (BGE, E5)
- **Vector DB:** Pinecone / Weaviate / ChromaDB / Qdrant / pgvector
- **LLM:** GPT-4o / Claude / Gemini / Llama
- **Transcript:** `youtube-transcript-api` / `yt-dlp` + Whisper / AssemblyAI

## Submission

1. **Loom video** — full demo, start to finish, with two real video URLs.
2. **GitHub link** — clean repo, README, `.env.example`, multiple commits.
3. Deadline  - 5 days after receiving task

4. When you are done with the project, please reply in this format so that we could process your project more easily and efficiently. 
    1. Project URL
    2. Project Description 
    3. Loom URL
    4. Github repo 
    
    Please check the below screenshots. This is how we expect your reply to be. 
    

> **💡 Tip: Build It Like You Already Work Here**
> 
> We don't hire Claude bots. We hire engineers. That means commits that tell a story, a README written by a human who actually built the thing, and trade-offs you can defend on a call , *why this vector DB, why this chunk size, what breaks at 10,000 users.*
> 
> If your repo reads like ChatGPT one-shotted it, we'll know. If it reads like you sweated over it, we'll call you.
>