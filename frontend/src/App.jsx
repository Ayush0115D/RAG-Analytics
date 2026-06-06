import { useState, useRef, useEffect } from "react";
import { fetchYouTube, fetchInstagram, ingestVideo, streamChat } from "./api";

function extractYtId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
}

function parseCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function Spinner() {
  return <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />;
}

function VideoCard({ data, label, loading, error, url, isYT }) {
  if (loading) {
    return (
      <div className="flex-1 border border-gray-200 rounded-xl bg-white min-h-[200px] flex flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm text-gray-500">Loading {label}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 border border-gray-200 rounded-xl bg-white min-h-[200px] flex items-center justify-center p-5">
        <p className="text-sm text-red-600 text-center break-words">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 border border-gray-200 rounded-xl bg-white min-h-[200px] flex items-center justify-center text-gray-400 text-sm">
        <p>Paste a {label} URL to begin</p>
      </div>
    );
  }

  const m = data.metadata;
  const ytId = isYT && url ? extractYtId(url) : null;

  return (
    <div className="flex-1 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="relative w-full aspect-video bg-gray-100">
        {ytId ? (
          <iframe
            className="w-full h-full border-none"
            src={`https://www.youtube.com/embed/${ytId}`}
            title={m.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : m.thumbnail ? (
          <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover" />
        ) : null}
        <span className="absolute top-2 left-2 bg-black/70 text-white font-bold text-sm w-7 h-7 flex items-center justify-center rounded-md">
          {m.video_id}
        </span>
      </div>
      <div className="p-3.5">
        <h3 className="m-0 text-sm leading-tight line-clamp-2">{m.title || "Untitled"}</h3>
        <p className="m-0 my-1.5 text-xs text-indigo-500 font-medium">{m.creator || "Unknown creator"}</p>
        <div className="flex flex-wrap gap-1.5 mb-1">
          <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">👁 {parseCount(m.views)} views</span>
          <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">👍 {parseCount(m.likes)}</span>
          <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">💬 {parseCount(m.comments)}</span>
          <span className="text-[11px] text-emerald-600 font-semibold bg-gray-100 px-2 py-0.5 rounded">📊 {m.engagement_rate}%</span>
        </div>
        <p className="text-[11px] text-gray-500 my-0.5">Followers: {parseCount(m.follower_count)}</p>
        <p className="text-[11px] text-gray-500 my-0.5">
          {m.upload_date?.slice(0, 10) || "Unknown date"} | {Math.floor(m.duration / 60)}:{(m.duration % 60).toString().padStart(2, "0")}
        </p>
        {m.hashtags?.length > 0 && (
          <p className="text-[11px] text-indigo-500 mt-1.5 mb-0">{m.hashtags.map((t) => `#${t}`).join(" ")}</p>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  return (
    <div className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.role === "user" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
        {msg.role === "user" ? "U" : "AI"}
      </div>
      <div className={`px-3 py-2.5 rounded-xl text-sm leading-relaxed min-w-0 ${msg.role === "user" ? "bg-indigo-500 text-white" : "bg-gray-50 text-gray-900"}`}>
        <p className="m-0 whitespace-pre-wrap break-words">{msg.text}</p>
        {msg.sources?.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-indigo-500 font-medium">Sources ({msg.sources.length})</summary>
            {msg.sources.map((s, i) => (
              <div key={i} className="py-1.5 text-gray-600 border-b border-gray-100 last:border-none">
                <strong>Video {s.video_id}</strong>: …{s.text.slice(0, 200)}…
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ disabled, hasBoth }) {
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
          if (last.role === "assistant") copy[copy.length - 1] = { ...last, text: last.text + content };
          return copy;
        });
      },
      onSources(content) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") copy[copy.length - 1] = { ...last, sources: content };
          return copy;
        });
      },
      onDone() { setStreaming(false); },
      onError(err) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === "assistant") copy[copy.length - 1] = { ...last, text: last.text || `Error: ${err}` };
          return copy;
        });
        setStreaming(false);
      },
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white flex flex-col h-[500px]">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-200">
        <h2 className="m-0 text-base">Chat</h2>
        <div className="ml-auto flex items-center gap-2">
          {!disabled && !streaming && messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-xs bg-transparent border border-gray-300 rounded px-2.5 py-1 cursor-pointer text-gray-600 hover:bg-gray-100">
              Clear
            </button>
          )}
          {streaming && (
            <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded animate-pulse">Streaming...</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 m-auto text-sm">
            {disabled ? "Fetch at least one video to start asking questions." : hasBoth ? "Both videos loaded! Ask a question to compare them." : "Ask a question about the videos above."}
          </p>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 px-4 py-3 border-t border-gray-200">
        <textarea
          placeholder={disabled ? "Fetch a video first..." : streaming ? "Waiting for response..." : hasBoth ? "Compare Video A and B..." : "Ask about the video..."}
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-inherit resize-none min-h-[40px] max-h-[120px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || streaming}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={disabled || streaming || !input.trim()}
          className="px-5 py-2.5 bg-indigo-500 text-white border-none rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
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
    <div className="max-w-[1400px] mx-auto p-5">
      <header className="text-center mb-6">
        <h1 className="m-0 text-2xl">RAG Chatbot</h1>
        <p className="m-1 mt-1 text-gray-500">Compare social media videos with AI</p>
      </header>

      <section className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1.5 text-gray-600">YouTube URL (Video A)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
            />
            <button
              onClick={() => handleFetch("A")}
              disabled={loadingA}
              className="px-5 py-2.5 bg-indigo-500 text-white border-none rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              {loadingA ? "Loading..." : "Fetch"}
            </button>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1.5 text-gray-600">Instagram Reel URL (Video B)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://instagram.com/reel/..."
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              value={igUrl}
              onChange={(e) => setIgUrl(e.target.value)}
            />
            <button
              onClick={() => handleFetch("B")}
              disabled={loadingB}
              className="px-5 py-2.5 bg-indigo-500 text-white border-none rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              {loadingB ? "Loading..." : "Fetch"}
            </button>
          </div>
        </div>
      </section>

      <section className="flex gap-5 mb-6">
        <VideoCard data={videoA} label="YouTube URL" url={ytUrl} isYT={true} loading={loadingA} error={errorA} />
        <VideoCard data={videoB} label="Instagram URL" loading={loadingB} error={errorB} />
      </section>

      <ChatPanel disabled={!hasVideos} hasBoth={!!(videoA && videoB)} />
    </div>
  );
}