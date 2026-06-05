import { ChromaClient } from "chromadb";
import { execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execFile);

const COLLECTION_NAME = "rag_chatbot";
const CHROMA_PORT = 8000;

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

class InMemoryStore {
  constructor() {
    this.chunks = [];
  }

  async addChunks(embeddedChunks) {
    for (const c of embeddedChunks) {
      this.chunks.push({
        id: `${c.video_id}_${c.index}`,
        text: c.text,
        video_id: c.video_id,
        offset: c.offset,
        index: c.index,
        embedding: c.embedding,
      });
    }
    return this.chunks.length;
  }

  async query(queryEmbedding, topK = 5) {
    const scored = this.chunks.map((c) => ({
      ...c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ embedding, ...rest }) => rest);
  }

  async count() {
    return this.chunks.length;
  }

  async deleteAll() {
    this.chunks = [];
  }
}

class ChromaStore {
  constructor(client) {
    this.client = client;
    this.collection = null;
  }

  async init() {
    this.collection = await this.client.getOrCreateCollection({
      name: COLLECTION_NAME,
    });
  }

  async addChunks(embeddedChunks) {
    const ids = embeddedChunks.map((c) => `${c.video_id}_${c.index}`);
    const metadatas = embeddedChunks.map((c) => ({
      video_id: c.video_id,
      offset: c.offset,
      index: c.index,
    }));
    const documents = embeddedChunks.map((c) => c.text);
    const embeddings = embeddedChunks.map((c) => c.embedding);

    await this.collection.add({ ids, metadatas, documents, embeddings });
    return ids.length;
  }

  async query(queryEmbedding, topK = 5) {
    const result = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
    });

    return (result.ids[0] || []).map((id, i) => ({
      id,
      text: result.documents[0][i],
      video_id: result.metadatas[0][i].video_id,
      offset: result.metadatas[0][i].offset,
      index: result.metadatas[0][i].index,
      score: result.distances[0][i],
    }));
  }

  async count() {
    return this.collection.count();
  }

  async deleteAll() {
    await this.client.deleteCollection({ name: COLLECTION_NAME });
    await this.init();
  }
}

let store = null;

export async function getStore() {
  if (store) return store;

  try {
    const client = new ChromaClient({ path: `http://localhost:${CHROMA_PORT}` });
    await Promise.race([
      client.heartbeat(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    const cs = new ChromaStore(client);
    await cs.init();
    store = cs;
    console.log("Using ChromaDB server");
  } catch (e) {
    console.log("ChromaDB unavailable (" + e.message + "), using in-memory");
    store = new InMemoryStore();
  }

  return store;
}

export async function startChromaServer() {
  try {
    await execAsync("python", ["-m", "chromadb", "run", "--port", String(CHROMA_PORT)], {
      timeout: 5000,
    });
  } catch {
    try {
      await execAsync("python3", ["-m", "chromadb", "run", "--port", String(CHROMA_PORT)], {
        timeout: 5000,
      });
    } catch {
      console.log("Could not start ChromaDB server, will use in-memory fallback");
    }
  }
}
