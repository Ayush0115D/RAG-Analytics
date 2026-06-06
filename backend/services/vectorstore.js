import { Pinecone } from "@pinecone-database/pinecone";

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

class PineconeStore {
  constructor(index) {
    this.index = index;
  }

  async addChunks(embeddedChunks) {
    const vectors = embeddedChunks.map((c) => ({
      id: `${c.video_id}_${c.index}`,
      values: c.embedding,
      metadata: {
        text: c.text,
        video_id: c.video_id,
        offset: c.offset,
        index: c.index,
      },
    }));

    try {
      for (let i = 0; i < vectors.length; i += 100) {
        await this.index.upsert({ records: vectors.slice(i, i + 100) });
      }
      console.log(`Pinecone: upserted ${vectors.length} vectors`);
    } catch (e) {
      console.error("Pinecone upsert failed:", e.message);
    }

    return vectors.length;
  }

  async query(queryEmbedding, topK = 5) {
    try {
      const result = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      });

      console.log(`Pinecone: query returned ${result.matches.length} matches`);

      return result.matches.map((m) => ({
        id: m.id,
        text: m.metadata.text,
        video_id: m.metadata.video_id,
        offset: m.metadata.offset,
        index: m.metadata.index,
        score: m.score,
      }));
    } catch (e) {
      console.error("Pinecone query failed:", e.message);
      return [];
    }
  }

  async count() {
    try {
      const stats = await this.index.describeIndexStats();
      return stats.totalRecordCount || 0;
    } catch (e) {
      console.error("Pinecone count failed:", e.message);
      return 0;
    }
  }

  async deleteAll() {
    // Pinecone free tier doesn't support delete by namespace easily
    // Users can delete from Pinecone console
  }
}

let store = null;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "rag-chatbot";

export async function getStore() {
  if (store) return store;

  if (process.env.PINECONE_API_KEY) {
    try {
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

      // Fetch the host URL for serverless indexes
      const indexDescription = await pc.describeIndex(PINECONE_INDEX);
      const host = indexDescription.host;
      console.log(`Pinecone: resolved host for "${PINECONE_INDEX}"`);

      const index = pc.index(PINECONE_INDEX, host);
      await index.describeIndexStats();
      store = new PineconeStore(index);
      console.log(`Using Pinecone vector DB (${host})`);
    } catch (e) {
      console.error("Pinecone init failed:", e.message);
      store = new InMemoryStore();
      console.log("Falling back to InMemoryStore");
    }
  } else {
    store = new InMemoryStore();
    console.log("Using InMemoryStore (set PINECONE_API_KEY for persistent storage)");
  }

  return store;
}
