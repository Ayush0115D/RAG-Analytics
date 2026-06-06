import { useState, useRef, useEffect } from "react";
import { fetchYouTube, fetchInstagram, ingestVideo, streamChat } from "./api";

function extractYtId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
}

function formatCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />;
}

function VideoCard({ data, label, loading, error, url, isYT }) {
  if (loading) {
    return (
      <div className="card min-h-[200px] flex flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm text-slate-500">Loading {label}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card min-h-[200px] flex items-center justify-center p-5">
        <p className="text-sm text-red-400 text-center break-words">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2 text-slate-600">{isYT ? "▶" : "📱"}</div>
          <p className="text-sm text-slate-500">No video loaded</p>
          <p className="text-xs text-slate-600 mt-1">Enter a URL above and click Fetch</p>
        </div>
      </div>
    );
  }

  const m = data.metadata;
  const ytId = isYT && url ? extractYtId(url) : null;

  return (
    <div className="card overflow-hidden">
      <div className="relative w-full aspect-video bg-slate-900">
        {ytId ? (
          <iframe
            className="w-full h-full border-none"
            src={`https://www.youtube.com/embed/${ytId}`}
            title={m.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : m.thumbnail ? (
          <>
            <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent" />
          </>
        ) : null}
        <span className="absolute top-3 left-3 bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">{m.video_id}</span>
      </div>
      <div className="p-4 space-y-2.5">
        <div>
          <h3 className="text-sm font-medium text-slate-100 line-clamp-2 m-0">{m.title || "Untitled"}</h3>
          <p className="text-xs text-slate-400 mt-1 m-0">{m.creator || "Unknown creator"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="stat">👁 {formatCount(m.views)}</span>
          <span className="stat">👍 {formatCount(m.likes)}</span>
          <span className="stat">💬 {formatCount(m.comments)}</span>
          <span className="stat text-emerald-400">📊 {m.engagement_rate}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{formatCount(m.follower_count)} followers</span>
          <span>·</span>
          <span>{m.upload_date?.slice(0, 10) || "Unknown"}</span>
          <span>·</span>
          <span>{Math.floor(m.duration / 60)}:{(m.duration % 60).toString().padStart(2, "0")}</span>
        </div>
        {m.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {m.hashtags.slice(0, 5).map((t, i) => (
              <span key={i} className="badge badge-slate">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  return (
    <div className={`chat-msg flex gap-3 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${msg.role === "user" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400"}`}>
        {msg.role === "user" ? "U" : "AI"}
      </div>
      <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed min-w-0 ${msg.role === "user" ? "bg-cyan-600/10 text-slate-200 border border-cyan-500/15" : "bg-slate-800/50 text-slate-300 border border-slate-700/50"}`}>
        <p className="m-0 whitespace-pre-wrap break-words">{msg.text}</p>
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

    setMessages((prev) => [...prev, { role: "user", text: q }, { role: "assistant", text: "", sources: [] }]);
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
    <div className="card flex flex-col h-[480px]">
      <div className="card-header flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <h2 className="text-sm font-semibold text-slate-200 m-0">Chat</h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!disabled && !streaming && messages.length > 0 && (
            <button onClick={() => setMessages([])} className="btn-ghost">Clear</button>
          )}
          {streaming && (
            <span className="badge badge-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Streaming
            </span>
          )}
        </div>
      </div>

      <div className="chat-messages flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 m-auto">
            <div className="text-3xl mb-2 text-slate-700">💬</div>
            <p className="text-sm">
              {disabled ? "Load a video to start asking questions." : hasBoth ? "Both videos loaded. Ask a question to compare them." : "Ask a question about the video."}
            </p>
          </div>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2.5 px-5 py-4 border-t border-slate-800">
        <textarea
          placeholder={disabled ? "Fetch a video first..." : streaming ? "Waiting for response..." : "Ask a question..."}
          className="input-field flex-1 resize-none min-h-[40px] max-h-[120px]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || streaming}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={disabled || streaming || !input.trim()}
          className="btn-primary"
        >
          {streaming ? <Spinner /> : "Send"}
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

  const hasBoth = !!(videoA && videoB);

  return (
    <div className="max-w-[1280px] mx-auto p-6">

      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">R</div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100 m-0">RAG Analytics</h1>
            <p className="text-xs text-slate-500 m-0 mt-0.5">Video Comparison Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-cyan">YouTube</span>
          <span className="badge badge-cyan">Instagram</span>
          <span className="badge badge-cyan">Gemini AI</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

        {/* YouTube Input */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-200 m-0">YouTube</h2>
          </div>
          <div className="card-body">
            <label className="text-xs text-slate-400 mb-2 block">Video URL (Video A)</label>
            <div className="flex gap-2.5">
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                className="input-field flex-1"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
              />
              <button onClick={() => handleFetch("A")} disabled={loadingA} className="btn-primary">
                {loadingA ? <Spinner /> : "Fetch"}
              </button>
            </div>
          </div>
        </div>

        {/* Instagram Input */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-200 m-0">Instagram</h2>
          </div>
          <div className="card-body">
            <label className="text-xs text-slate-400 mb-2 block">Reel URL (Video B)</label>
            <div className="flex gap-2.5">
              <input
                type="text"
                placeholder="https://instagram.com/reel/..."
                className="input-field flex-1"
                value={igUrl}
                onChange={(e) => setIgUrl(e.target.value)}
              />
              <button onClick={() => handleFetch("B")} disabled={loadingB} className="btn-primary">
                {loadingB ? <Spinner /> : "Fetch"}
              </button>
            </div>
            <details className="mt-3">
              <summary className="text-xs text-cyan-400/70 cursor-pointer hover:text-cyan-300 transition-colors">
                Instagram setup guide
              </summary>
              <div className="mt-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed">
                <p className="m-0 text-slate-300 font-medium">Instagram blocks anonymous requests. To fix:</p>
                <ol className="m-0 pl-4 space-y-1">
                  <li>Log into Instagram in Chrome</li>
                  <li>
                    Install "Get cookies.txt" extension from 
                    <a href="https://chrome.google.com/webstore/detail/get-cookiestxt/bgaddhkoddajcdgocldbbfleckgcbcid" target="_blank" rel="noopener noreferrer" className="text-cyan-400 ml-1">Chrome Web Store</a>
                  </li>
                  <li>Go to instagram.com, click the extension icon → "Export" → save as <code className="text-cyan-400 bg-slate-800 px-1 rounded">instagram_cookies.txt</code></li>
                  <li>Place the file in the <code className="text-cyan-400 bg-slate-800 px-1 rounded">backend/</code> folder</li>
                  <li>In <code className="text-cyan-400 bg-slate-800 px-1 rounded">backend/.env</code>, add: <code className="text-cyan-400 bg-slate-800 px-1 rounded">INSTAGRAM_COOKIES_FILE=instagram_cookies.txt</code></li>
                  <li>Save and restart the backend server</li>
                </ol>
                <p className="m-0 pt-1 text-slate-500">No browser extension needed? Set <code className="text-cyan-400 bg-slate-800 px-1 rounded">INSTAGRAM_BROWSER=chrome</code> in .env instead.</p>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Video Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <VideoCard data={videoA} label="YouTube URL" url={ytUrl} isYT={true} loading={loadingA} error={errorA} />
        <VideoCard data={videoB} label="Instagram URL" loading={loadingB} error={errorB} />
      </div>

      {/* Chat */}
      <ChatPanel disabled={!(videoA || videoB)} hasBoth={hasBoth} />

      <footer className="text-center mt-6 pb-4">
        <p className="text-xs text-slate-600">RAG Chatbot · Gemini · ChromaDB · LangChain</p>
      </footer>
    </div>
  );
}