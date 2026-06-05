const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function fetchYouTube(url, videoId) {
  const res = await fetch(`${API_URL}/api/youtube`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, video_id: videoId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function fetchInstagram(url, videoId) {
  const res = await fetch(`${API_URL}/api/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, video_id: videoId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function ingestVideo(transcript, videoId) {
  const res = await fetch(`${API_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, video_id: videoId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export function streamChat(question, history, callbacks) {
  const { onText, onSources, onDone, onError } = callbacks;

  fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onError?.(err.error || `HTTP ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "text") onText?.(event.content);
              if (event.type === "sources") onSources?.(event.content);
              if (event.type === "done") onDone?.();
              if (event.type === "error") onError?.(event.content);
            } catch {}
          }
        }
      }
    })
    .catch((err) => onError?.(err.message));
}
