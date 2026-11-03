const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken() {
  return localStorage.getItem("rag_token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getSessionId() {
  let sid = localStorage.getItem("rag_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("rag_session_id", sid);
  }
  return sid;
}

async function handleRes(res) {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

function fetchWithTimeout(url, opts, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Auth
export async function signupApi(name, email, password) {
  const res = await fetchWithTimeout(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return handleRes(res);
}

export async function loginApi(email, password) {
  const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleRes(res);
}

export async function getMe() {
  const res = await fetchWithTimeout(`${API_URL}/api/auth/me`, {
    headers: { ...authHeaders() },
  });
  return handleRes(res);
}

// Videos
export async function fetchYouTube(url, videoId) {
  const res = await fetch(`${API_URL}/api/youtube`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, video_id: videoId, session_id: getSessionId() }),
  });
  const data = await handleRes(res);
  if (!data.transcript_job_id) return data;

  const jobId = encodeURIComponent(data.transcript_job_id);
  for (let attempt = 0; attempt < 300; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const jobRes = await fetch(`${API_URL}/api/youtube/transcript/${jobId}`);
    const job = await handleRes(jobRes);
    if (job.status === "completed") {
      return {
        ...data,
        transcript: job.transcript,
        transcript_job_id: undefined,
        transcript_source: "supadata",
        transcript_error: undefined,
      };
    }
  }

  throw new Error("YouTube transcript processing exceeded five minutes. Please retry.");
}

export async function fetchInstagram(url, videoId) {
  const res = await fetch(`${API_URL}/api/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, video_id: videoId, session_id: getSessionId() }),
  });
  return handleRes(res);
}

export async function ingestVideo(transcript, videoId) {
  const res = await fetch(`${API_URL}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, video_id: videoId, session_id: getSessionId() }),
  });
  return handleRes(res);
}

export function streamChat(question, history, callbacks, video_ids = []) {
  const { onText, onSources, onDone, onError } = callbacks;

  fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history, video_ids, session_id: getSessionId() }),
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
