import { useState, useRef, useEffect } from "react";
import { fetchYouTube, fetchInstagram, ingestVideo, streamChat } from "./api";
import "./App.css";

function parseCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function VideoCard({ data, label, loading, error }) {
  if (loading) {
    return (
      <div className="video-card loading">
        <div className="spinner" />
        <p>Loading {label}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-card error">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="video-card empty">
        <p>Paste a {label} URL to begin</p>
      </div>
    );
  }

  const m = data.metadata;
  return (
    <div className="video-card loaded">
      <div className="video-thumb">
        {m.thumbnail && <img src={m.thumbnail} alt={m.title} />}
        <span className="video-id-badge">{m.video_id}</span>
      </div>
      <div className="video-info">
        <h3>{m.title}</h3>
        <p className="creator">{m.creator}</p>
        <div className="stats">
          <span>👁 {parseCount(m.views)} views</span>
          <span>👍 {parseCount(m.likes)}</span>
          <span>💬 {parseCount(m.comments)}</span>
          <span className="engagement">📊 {m.engagement_rate}%</span>
        </div>
        <p className="follower">Followers: {parseCount(m.follower_count)}</p>
        <p className="date">{m.upload_date?.slice(0, 10)} | {Math.floor(m.duration / 60)}:{(m.duration % 60).toString().padStart(2, "0")}</p>
        {m.hashtags?.length > 0 && (
          <p className="hashtags">{m.hashtags.map((t) => `#${t}`).join(" ")}</p>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  return (
    <div className={`chat-msg ${msg.role}`}>
      <div className="msg-avatar">{msg.role === "user" ? "U" : "AI"}</div>
      <div className="msg-content">
        <p>{msg.text}</p>
        {msg.sources && msg.sources.length > 0 && (
          <details className="sources-dropdown">
            <summary>Sources ({msg.sources.length})</summary>
            {msg.sources.map((s, i) => (
              <div key={i} className="source-item">
                <strong>Video {s.video_id}</strong>: …{s.text.slice(0, 200)}…
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ disabled }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const q = input.trim();
    if (!q || streaming || disabled) return;
    setInput("");

    const userMsg = { role: "user", text: q };
    const botMsg = { role: "assistant", text: "", sources: [] };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setStreaming(true);

    const history = messages.map((m) => ({ role: m.role, content: m.text }));

    streamChat(q, history, {
      onText(content) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") {
            copy[copy.length - 1] = { ...last, text: last.text + content };
          }
          return copy;
        });
      },
      onSources(content) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") {
            copy[copy.length - 1] = { ...last, sources: content };
          }
          return copy;
        });
      },
      onDone() {
        setStreaming(false);
      },
      onError(err) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") {
            copy[copy.length - 1] = { ...last, text: last.text || `Error: ${err}` };
          }
          return copy;
        });
        setStreaming(false);
      },
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Chat</h2>
        {streaming && <span className="streaming-badge">Streaming...</span>}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-placeholder">Ask a question about the videos above.</p>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          placeholder={
            disabled
              ? "Fetch a video first..."
              : streaming
                ? "Waiting for response..."
                : "Ask about the videos..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || streaming}
          rows={1}
        />
        <button onClick={handleSend} disabled={disabled || streaming || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [ytUrl, setYtUrl] = useState("");
  const [igUrl, setIgUrl] = useState("");
  const [videoA, setVideoA] = useState(null);
  const [videoB, setVideoB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");

  async function handleFetch(videoId) {
    const url = videoId === "A" ? ytUrl : igUrl;
    if (!url.trim()) return;

    const setData = videoId === "A" ? setVideoA : setVideoB;
    const setLoading = videoId === "A" ? setLoadingA : setLoadingB;
    const setError = videoId === "A" ? setErrorA : setErrorB;
    const fetcher = videoId === "A" ? fetchYouTube : fetchInstagram;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const data = await fetcher(url, videoId);
      setData(data);
      await ingestVideo(data.transcript, videoId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const hasVideos = videoA || videoB;

  return (
    <div className="app">
      <header className="app-header">
        <h1>RAG Chatbot</h1>
        <p>Compare social media videos with AI</p>
      </header>

      <section className="input-section">
        <div className="input-group">
          <label>YouTube URL (Video A)</label>
          <div className="input-row">
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
            />
            <button onClick={() => handleFetch("A")} disabled={loadingA}>
              {loadingA ? "Loading..." : "Fetch"}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>Instagram Reel URL (Video B)</label>
          <div className="input-row">
            <input
              type="text"
              placeholder="https://instagram.com/reel/..."
              value={igUrl}
              onChange={(e) => setIgUrl(e.target.value)}
            />
            <button onClick={() => handleFetch("B")} disabled={loadingB}>
              {loadingB ? "Loading..." : "Fetch"}
            </button>
          </div>
        </div>
      </section>

      <section className="videos-section">
        <VideoCard data={videoA} label="YouTube URL" loading={loadingA} error={errorA} />
        <VideoCard data={videoB} label="Instagram URL" loading={loadingB} error={errorB} />
      </section>

      <ChatPanel disabled={!hasVideos} />
    </div>
  );
}
