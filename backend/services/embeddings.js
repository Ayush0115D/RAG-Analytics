const API_KEY = process.env.GEMINI_API_KEY || "";
const EMBEDDING_MODEL = "gemini-embedding-001";

async function callEmbedAPI(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data.embedding.values;
}

// Startup test
(async () => {
  try {
    const dim = (await callEmbedAPI("ping")).length;
    console.log(`Embedding model OK (${EMBEDDING_MODEL}), dim: ${dim}`);
  } catch (e) {
    console.error(`Embedding model FAILED (${EMBEDDING_MODEL}):`, e.message);
  }
})();

export async function embedText(text) {
  return callEmbedAPI(text);
}

export async function embedChunks(chunks) {
  const results = [];
  for (const chunk of chunks) {
    try {
      const embedding = await callEmbedAPI(chunk.text);
      results.push({ ...chunk, embedding });
    } catch (e) {
      console.error(`Embedding failed for chunk ${chunk.video_id}_${chunk.index}:`, e.message);
    }
  }
  return results;
}

export async function embedQuery(query) {
  return callEmbedAPI(query);
}
