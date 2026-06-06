export function chunkTranscript(transcript, videoId, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let current = [];
  let currentLen = 0;
  let entryIdx = 0;

  for (let i = 0; i < transcript.length; i++) {
    const entry = transcript[i];
    const text = entry.text.trim();
    if (!text) continue;

    const words = text.split(/\s+/);
    for (const word of words) {
      current.push(word);
      currentLen++;

      if (currentLen >= chunkSize) {
        chunks.push({
          text: current.join(" "),
          video_id: videoId,
          offset: transcript[entryIdx]?.offset ?? 0,
          index: chunks.length,
        });

        const overlapWords = current.slice(-overlap);
        current = [...overlapWords];
        currentLen = overlapWords.length;
        entryIdx = i;
      }
    }
  }

  if (current.length > 0) {
    chunks.push({
      text: current.join(" "),
      video_id: videoId,
      offset: transcript[entryIdx]?.offset ?? 0,
      index: chunks.length,
    });
  }

  return chunks;
}
