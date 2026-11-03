import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchYouTube, fetchInstagram, ingestVideo, streamChat } from "../api";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function proxyImg(url) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith(`${API_URL}/`)) return url;
  return `${API_URL}/api/proxy-image?u=${encodeURIComponent(btoa(encodeURIComponent(url)))}`;
}

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

/* ───────── Toast ───────── */
let toastId = 0;
let toastListeners = [];
function notify(type, message) { toastListeners.forEach((fn) => fn({ id: ++toastId, type, message })); }

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const fn = (t) => setToasts((prev) => [...prev, t]);
    toastListeners.push(fn);
    return () => { toastListeners = toastListeners.filter((f) => f !== fn); };
  }, []);
  function remove(id) { setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t)); setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 250); }
  useEffect(() => { toasts.forEach((t) => { if (!t.exiting) setTimeout(() => remove(t.id), 3500); }); }, [toasts.length]);
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type} ${t.exiting ? "toast-exit" : ""}`} onClick={() => remove(t.id)}>
          {t.type === "success" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          {t.type === "error" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {t.type === "info" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ───────── Components ───────── */
function UserAvatar() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("rag_user") || "null"); } catch {}
  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-cyan-500/20">
      {initial}
    </div>
  );
}

function Header({ onLogout }) {
  const { darkMode, setDarkMode } = useTheme();
  let userName = "User";
  try { const u = JSON.parse(localStorage.getItem("rag_user") || "null"); if (u?.name) userName = u.name; } catch {}

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-body)]/70 backdrop-blur-xl border-b border-[var(--border)]">
      <div className="max-w-[1280px] mx-auto px-6 h-[68px] flex items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="logo-hdr" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#06b6d4" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#logo-hdr)" />
              <path d="M12 9.5v13l10-6.5z" fill="#fff" />
            </svg>
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl opacity-20 blur-sm" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-heading)] m-0 leading-tight tracking-tight">RAG Analytics</h1>
            <p className="text-[10px] text-[var(--text-muted)] m-0 leading-tight font-medium">Video Intelligence Platform</p>
          </div>
        </div>

        <div className="h-5 w-px bg-[var(--border)]" />

        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-400 bg-emerald-500/8 border border-emerald-500/15">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
            YouTube
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-purple-400 bg-purple-500/8 border border-purple-500/15">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/40" />
            Instagram
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="btn-icon" title={darkMode ? "Light mode" : "Dark mode"}>
            {darkMode ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button onClick={onLogout} className="btn-ghost text-[11px] flex items-center gap-1.5 h-9" title="Logout">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] hidden sm:block max-w-[100px] truncate">{userName}</span>
            <UserAvatar />
          </div>
        </div>
      </div>
      <div className="relative">
        <div className="h-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
        <div className="absolute inset-0 h-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 blur-sm opacity-60" />
      </div>
    </header>
  );
}

/* ───────── Skeleton ───────── */
function SkeletonVideoCard() {
  return (
    <div className="card overflow-hidden card-lift">
      <div className="w-full aspect-video skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-4 skeleton w-3/4" />
        <div className="h-3 skeleton w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 skeleton w-16" />
          <div className="h-6 skeleton w-14" />
          <div className="h-6 skeleton w-16" />
          <div className="h-6 skeleton w-14" />
        </div>
        <div className="h-3 skeleton w-2/3" />
      </div>
    </div>
  );
}

/* ───────── URL Input Card ───────── */
function UrlInputCard({ label, platform, placeholder, value, onChange, onFetch, loading, badgeColor }) {
  return (
    <div className="card card-lift dash-entrance">
      <div className="card-header flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
        <h2 className="text-sm font-semibold text-[var(--text-heading)] m-0">{label}</h2>
        <span className="ml-auto badge" style={{ background: "var(--bg-slate-900)", color: "var(--text-muted)" }}>{platform}</span>
      </div>
      <div className="card-body">
        <label className="text-xs text-[var(--text-secondary)] mb-2 block">Video URL</label>
        <div className="flex gap-2.5">
          <input type="text" placeholder={placeholder} className="input-field flex-1" value={value} onChange={onChange} />
          <button onClick={onFetch} disabled={loading} className="btn-primary" style={{ minWidth: 80 }}>
            {loading ? <Spinner /> : "Fetch"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Video Card ───────── */
function VideoCard({ data, label, loading, error, url, isYT }) {
  if (loading) return <SkeletonVideoCard />;

  if (error) {
    return (
      <div className="card min-h-[220px] flex items-center justify-center p-5 card-lift">
        <div className="text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-60">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-sm text-red-400 text-center break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card min-h-[220px] flex items-center justify-center card-lift">
        <div className="text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
          </svg>
          <p className="text-sm text-[var(--text-muted)]">No video loaded</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">Enter a URL above and click Fetch</p>
        </div>
      </div>
    );
  }

  const m = data.metadata;
  const ytId = isYT && url ? extractYtId(url) : null;

  return (
    <div className="card overflow-hidden card-lift">
      <div className="relative w-full aspect-video bg-[var(--bg-slate-900)]">
        {ytId ? (
          <iframe className="w-full h-full border-none" src={`https://www.youtube.com/embed/${ytId}`} title={m.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        ) : m.thumbnail ? (
          <>
            <img src={proxyImg(m.thumbnail)} alt={m.title} className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = "none" }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-transparent to-transparent" />
          </>
        ) : null}
        <span className="absolute top-3 left-3 bg-[var(--accent)] text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">{m.video_id}</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-heading)] line-clamp-2 m-0">{m.title || "Untitled"}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 m-0">{m.creator || "Unknown creator"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {formatCount(m.views)}
          </span>
          <span className="stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            {formatCount(m.likes)}
          </span>
          <span className="stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {formatCount(m.comments)}
          </span>
          <span className="stat text-emerald-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            {m.engagement_rate}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span>{formatCount(m.follower_count)} followers</span>
          <span className="opacity-30">·</span>
          <span>{m.upload_date?.slice(0, 10) || "Unknown"}</span>
          <span className="opacity-30">·</span>
          <span>{Math.floor(m.duration / 60)}:{(m.duration % 60).toString().padStart(2, "0")}</span>
        </div>
        {!data.transcript?.length && (
          <p className="text-xs text-amber-400 m-0">
            {data.transcript_error || "No transcript was available for this video."}
          </p>
        )}
        {m.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {m.hashtags.slice(0, 5).map((t, i) => (
              <span key={i} className="badge badge-slate text-[10px]">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Chat ───────── */
function ChatMessage({ msg, onSourceClick }) {
  const showSources = msg.role === "assistant" && msg.sources?.length > 0;
  return (
    <div className={`chat-msg flex flex-col gap-2 max-w-[88%] ${msg.role === "user" ? "self-end items-end" : "self-start items-start"}`}>
      <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${msg.role === "user" ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white" : "bg-[var(--bg-slate-800)] text-[var(--text-muted)]"}`}>
          {msg.role === "user" ? "U" : "AI"}
        </div>
        <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed min-w-0 ${msg.role === "user" ? "bg-cyan-600/10 text-[var(--text-primary)] border border-cyan-500/15" : "bg-[var(--bg-slate-800)]/50 text-[var(--text-secondary)] border border-[var(--border)]"}`}>
          <p className="m-0 whitespace-pre-wrap break-words">{msg.text}</p>
          {msg.text === "" && msg.role === "assistant" && (
            <span className="flex gap-1 items-center h-5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 typing-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 typing-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 typing-dot" />
            </span>
          )}
        </div>
      </div>
      {showSources && (
        <div className="sources-panel rounded-lg p-2.5 ml-10 flex flex-wrap gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-medium mr-1">Sources:</span>
          {msg.sources.map((s, i) => (
            <span key={i} className="source-chip" onClick={() => onSourceClick?.(s)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              [Video {s.video_id} — Chunk {s.chunk_index}] <span className="opacity-50">({(s.score * 100).toFixed(0)}%)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPanel({ disabled, hasBoth, onSourceClick, externalMessages, onMessagesChange, videoIds }) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const messages = externalMessages || [];
  const setMessages = onMessagesChange || (() => {});

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleSend() {
    const q = input.trim();
    if (!q || streaming || disabled) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }, { role: "assistant", text: "", sources: [] }]);
    setStreaming(true);
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const ids = videoIds;
    streamChat(q, history, {
      onText(content) {
        setMessages((prev) => { const c = [...prev]; const l = c[c.length - 1]; if (l.role === "assistant") c[c.length - 1] = { ...l, text: l.text + content }; return c; });
      },
      onSources(content) {
        setMessages((prev) => { const c = [...prev]; const l = c[c.length - 1]; if (l.role === "assistant") c[c.length - 1] = { ...l, sources: content }; return c; });
      },
      onDone() { setStreaming(false); },
      onError(err) {
        setMessages((prev) => { const c = [...prev]; const l = c[c.length - 1]; if (l.role === "assistant") c[c.length - 1] = { ...l, text: l.text || `Error: ${err}` }; return c; });
        setStreaming(false);
      },
    }, ids);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div className="card flex flex-col h-[520px] card-lift dash-entrance" style={{ animationDelay: "0.35s" }}>
      <div className="card-header flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/30" />
          <h2 className="text-sm font-semibold text-[var(--text-heading)] m-0">Chat</h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {streaming && (
            <span className="badge badge-cyan text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Streaming
            </span>
          )}
          {!disabled && !streaming && messages.length > 0 && (
            <button onClick={() => setMessages([])} className="btn-ghost text-[11px]">Clear</button>
          )}
        </div>
      </div>

      <div className="chat-messages flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center text-[var(--text-muted)] m-auto">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-30">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm">{disabled ? "Load a video with a transcript to start asking questions." : hasBoth ? "Both videos loaded. Ask a question to compare them." : "Ask a question about the video."}</p>
          </div>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} msg={msg} onSourceClick={onSourceClick} />)}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2.5 px-5 py-4 border-t border-[var(--border)]">
        <textarea placeholder={disabled ? "Fetch a video with a transcript first..." : streaming ? "Waiting for response..." : "Ask a question about the video..."}
          className="input-field flex-1 resize-none min-h-[40px] max-h-[120px]" value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
          disabled={disabled || streaming} rows={1} />
        <button onClick={handleSend} disabled={disabled || streaming || !input.trim()} className="btn-primary" style={{ minWidth: 70 }}>
          {streaming ? <Spinner /> : "Send"}
        </button>
      </div>
    </div>
  );
}

/* ───────── Link History ───────── */
function LinkHistory({ links, onLoad, onClear }) {
  const [collapsed, setCollapsed] = useState(false);
  const empty = links.length === 0;
  return (
    <div className="card card-lift dash-entrance" style={{ animationDelay: "0.4s" }}>
      <div className="card-header flex items-center gap-3 cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <h2 className="text-sm font-semibold text-[var(--text-heading)] m-0">Link History</h2>
        <span className="text-[10px] text-[var(--text-muted)] ml-1">({links.length})</span>
        <div className="ml-auto flex items-center gap-2">
          {!empty && <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="btn-ghost text-[11px]">Clear</button>}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.2s ease" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      {!collapsed && (
        <div className="card-body">
          {empty ? (
            <div className="text-center py-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-30">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">No links yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">Fetched video URLs will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {[...links].reverse().map((link, i) => (
                <div key={link.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-slate-900)] border border-[var(--border)] group" style={{ animation: `fade-in 0.2s ease-out ${i * 0.03}s both` }}>
                  <span className={`flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0 ${link.platform === "youtube" ? "bg-emerald-500/15 text-emerald-400" : "bg-purple-500/15 text-purple-400"}`}>
                    {link.platform === "youtube" ? "YT" : "IG"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[var(--text-secondary)] m-0 truncate">{link.url}</p>
                    <p className="text-[10px] text-[var(--text-muted)] m-0 mt-0.5">{link.timestamp}</p>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { navigator.clipboard.writeText(link.url); notify("success", "Copied to clipboard"); }}
                      className="btn-ghost text-[10px] px-2 py-1 h-auto" title="Copy URL">Copy</button>
                    <button onClick={() => onLoad(link.url, link.platform)}
                      className="btn-ghost text-[10px] px-2 py-1 h-auto" title="Load URL">Load</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Dashboard ───────── */
const STORAGE_KEY = "rag_dashboard_state";

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object") return null;
    return state;
  } catch { return null; }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function cleanVideo(video) {
  if (!video) return null;
  return { metadata: video.metadata, transcript: video.transcript, transcript_error: video.transcript_error };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const saved = useRef(loadSavedState());
  const [restored, setRestored] = useState(false);

  const [ytUrl, setYtUrl] = useState(saved.current?.ytUrl || "");
  const [igUrl, setIgUrl] = useState(saved.current?.igUrl || "");
  const [videoA, setVideoA] = useState(saved.current?.videoA || null);
  const [videoB, setVideoB] = useState(saved.current?.videoB || null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");
  const [chatMessages, setChatMessages] = useState(saved.current?.chatMessages || []);
  const [linkHistory, setLinkHistory] = useState(saved.current?.linkHistory || []);

  useEffect(() => {
    if (saved.current && (saved.current.videoA || saved.current.videoB || saved.current.chatMessages?.length > 0)) {
      setRestored(true);
      setTimeout(() => setRestored(false), 2500);
    }
    saved.current = null;
  }, []);

  const hasBoth = !!(videoA && videoB);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveState({ ytUrl, igUrl, videoA: cleanVideo(videoA), videoB: cleanVideo(videoB), chatMessages, linkHistory });
    }, 500);
    return () => clearTimeout(timer);
  }, [ytUrl, igUrl, videoA, videoB, chatMessages, linkHistory]);

  async function handleFetch(videoId) {
    const url = videoId === "A" ? ytUrl : igUrl;
    if (!url.trim()) return;
    const setData = videoId === "A" ? setVideoA : setVideoB;
    const setLoading = videoId === "A" ? setLoadingA : setLoadingB;
    const setError = videoId === "A" ? setErrorA : setErrorB;
    const fetcher = videoId === "A" ? fetchYouTube : fetchInstagram;
    const platform = videoId === "A" ? "youtube" : "instagram";
    setLoading(true);
    setError("");
    setData(null);
    setChatMessages([]);
    try {
      const data = await fetcher(url, videoId);
      setData(data);
      const hasTranscript = Array.isArray(data.transcript) && data.transcript.length > 0;
      if (hasTranscript) await ingestVideo(data.transcript, videoId);
      setLinkHistory((prev) => {
        const next = [...prev, { id: Date.now(), url, platform, videoId, timestamp: new Date().toLocaleString() }];
        return next.length > 20 ? next.slice(next.length - 20) : next;
      });
      notify(
        hasTranscript ? "success" : "info",
        hasTranscript
          ? `${videoId === "A" ? "YouTube" : "Instagram"} video fetched & ingested`
          : data.transcript_error || "Video loaded, but no transcript was available."
      );
    } catch (err) {
      setError(err.message);
      notify("error", err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("rag_token");
    localStorage.removeItem("rag_user");
    localStorage.removeItem(STORAGE_KEY);
    navigate("/");
  }

  function handleSourceClick(source) {
    notify("info", `Video ${source.video_id} — Chunk ${source.chunk_index} (confidence: ${(source.score * 100).toFixed(0)}%)`);
  }

  function handleLoadLink(url, platform) {
    if (platform === "youtube") setYtUrl(url);
    else setIgUrl(url);
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("info", `URL loaded into ${platform === "youtube" ? "YouTube" : "Instagram"} field`);
  }

  function handleClearLinks() {
    setLinkHistory([]);
    notify("info", "Link history cleared");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onLogout={handleLogout} />
      <ToastContainer />

      {restored && (
        <div className="fixed top-[76px] left-1/2 -translate-x-1/2 z-30 bg-cyan-600/15 text-cyan-400 border border-cyan-500/20 rounded-lg px-4 py-2 text-xs font-medium backdrop-blur-sm animate-[fade-in_0.3s_ease-out]">
          Session restored
        </div>
      )}

      <main className="flex-1 max-w-[1280px] mx-auto w-full p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <UrlInputCard label="YouTube" platform="Video A" placeholder="https://youtube.com/watch?v=..."
            value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} onFetch={() => handleFetch("A")}
            loading={loadingA} badgeColor="bg-emerald-500" />
          <UrlInputCard label="Instagram" platform="Video B" placeholder="https://instagram.com/reel/..."
            value={igUrl} onChange={(e) => setIgUrl(e.target.value)} onFetch={() => handleFetch("B")}
            loading={loadingB} badgeColor="bg-purple-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="dash-entrance" style={{ animationDelay: "0.18s" }}>
            <VideoCard data={videoA} label="YouTube URL" url={ytUrl} isYT={true} loading={loadingA} error={errorA} />
          </div>
          <div className="dash-entrance" style={{ animationDelay: "0.25s" }}>
            <VideoCard data={videoB} label="Instagram URL" loading={loadingB} error={errorB} />
          </div>
        </div>

        <ChatPanel
          disabled={!(videoA?.transcript?.length || videoB?.transcript?.length)}
          hasBoth={hasBoth}
          onSourceClick={handleSourceClick}
          externalMessages={chatMessages}
          onMessagesChange={setChatMessages}
          videoIds={[videoA?.metadata?.video_id, videoB?.metadata?.video_id].filter(Boolean)}
        />

        <LinkHistory links={linkHistory} onLoad={handleLoadLink} onClear={handleClearLinks} />
      </main>

      <footer className="text-center py-4 border-t border-[var(--border)]">
        <p className="text-[11px] text-[var(--text-muted)]">RAG Analytics &mdash; Video Intelligence Platform</p>
      </footer>
    </div>
  );
}
