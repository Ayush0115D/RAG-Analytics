export function chunkTranscript(transcript, videoId, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const entry of transcript) {
    const text = entry.text.trim();
    if (!text) continue;

    const words = text.split(/\s+/);
    for (const word of words) {
      current.push(word);
      currentLen++;

      if (currentLen >= chunkSize) {
        const chunkText = current.join(" ");
        const startOffset = transcript.find((t) => current.includes(t.text.split(/\s+/)[0]))?.offset ?? 0;

        chunks.push({
          text: chunkText,
          video_id: videoId,
          offset: startOffset,
          index: chunks.length,
        });

        const overlapWords = current.slice(-overlap);
        current = [...overlapWords];
        currentLen = overlapWords.length;
      }
    }
  }

  if (current.length > 0) {
    const chunkText = current.join(" ");
    const startOffset = transcript.find((t) => current.includes(t.text.split(/\s+/)[0]))?.offset ?? 0;

    chunks.push({
      text: chunkText,
      video_id: videoId,
      offset: startOffset,
      index: chunks.length,
    });
  }

  return chunks;
}
