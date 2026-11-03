import { Pinecone } from "@pinecone-database/pinecone";

class InMemoryStore {
  constructor() {
    this.namespaces = {};
  }

  async addChunks(embeddedChunks, namespace) {
    const ns = namespace || "_default";
    if (!this.namespaces[ns]) this.namespaces[ns] = [];
    for (const c of embeddedChunks) {
      this.namespaces[ns].push({
        id: `${c.video_id}_${c.index}`,
        text: c.text,
        video_id: c.video_id,
        offset: c.offset,
        index: c.index,
        embedding: c.embedding,
      });
    }
    return this.namespaces[ns].length;
  }

  async deleteVideoChunks(videoId, namespace) {
    const ns = namespace || "_default";
    this.namespaces[ns] = (this.namespaces[ns] || []).filter((chunk) => chunk.video_id !== videoId);
  }

  async query(queryEmbedding, topK = 5, filter = {}, namespace) {
    const ns = namespace || "_default";
    let chunks = this.namespaces[ns] || [];
    if (filter.video_id?.$in) {
      chunks = chunks.filter((c) => filter.video_id.$in.includes(c.video_id));
    }
    const scored = chunks.map((c) => ({
      ...c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ embedding, ...rest }) => rest);
  }

  async count() {
    return Object.values(this.namespaces).reduce((s, arr) => s + arr.length, 0);
  }

  async deleteAll(namespace) {
    const ns = namespace || "_default";
    this.namespaces[ns] = [];
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

  async addChunks(embeddedChunks, namespace) {
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

    for (let i = 0; i < vectors.length; i += 100) {
      await this.index.upsert({ records: vectors.slice(i, i + 100), namespace });
    }
    console.log(`Pinecone: upserted ${vectors.length} vectors in namespace "${namespace}"`);

    return vectors.length;
  }

  async deleteVideoChunks(videoId, namespace) {
    await this.index.deleteMany({
      filter: { video_id: { $eq: videoId } },
      namespace,
    });
    console.log(`Pinecone: deleted previous chunks for video "${videoId}" in namespace "${namespace}"`);
  }

  async query(queryEmbedding, topK = 5, filter = {}, namespace) {
    try {
      const result = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        namespace,
      });

      console.log(`Pinecone: query returned ${result.matches.length} matches in namespace "${namespace}"`);

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

  async count(namespace) {
    try {
      const stats = namespace
        ? await this.index.describeIndexStats()
        : await this.index.describeIndexStats();
      return stats.totalRecordCount || 0;
    } catch (e) {
      console.error("Pinecone count failed:", e.message);
      return 0;
    }
  }

  async deleteAll(namespace) {
    try {
      await this.index.deleteAll({ namespace });
      console.log(`Pinecone: deleted all vectors in namespace "${namespace}"`);
    } catch (e) {
      console.error("Pinecone deleteAll failed:", e.message);
    }
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
