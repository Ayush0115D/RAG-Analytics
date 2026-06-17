import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { loginApi, signupApi } from "../api";

function NeuralBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-5">
      <div className="grid-overlay" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 5%, transparent) 0%, transparent 70%)" }}
      />
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <line x1="0%" y1="30%" x2="40%" y2="50%" stroke="var(--accent)" strokeWidth="0.5" opacity="0.07">
          <animate attributeName="opacity" values="0.07;0.02;0.07" dur="6s" repeatCount="indefinite" />
        </line>
        <line x1="60%" y1="50%" x2="100%" y2="30%" stroke="#3b82f6" strokeWidth="0.5" opacity="0.07">
          <animate attributeName="opacity" values="0.07;0.02;0.07" dur="8s" repeatCount="indefinite" />
        </line>
        <line x1="0%" y1="70%" x2="35%" y2="60%" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.05">
          <animate attributeName="opacity" values="0.05;0.01;0.05" dur="7s" repeatCount="indefinite" />
        </line>
        <line x1="65%" y1="60%" x2="100%" y2="70%" stroke="var(--accent)" strokeWidth="0.5" opacity="0.05">
          <animate attributeName="opacity" values="0.05;0.01;0.05" dur="9s" repeatCount="indefinite" />
        </line>
        <line x1="0%" y1="0%" x2="100%" y2="100%" stroke="var(--accent)" strokeWidth="0.3" opacity="0.03">
          <animate attributeName="opacity" values="0.03;0.01;0.03" dur="12s" repeatCount="indefinite" />
        </line>
        <line x1="100%" y1="0%" x2="0%" y2="100%" stroke="#3b82f6" strokeWidth="0.3" opacity="0.03">
          <animate attributeName="opacity" values="0.03;0.01;0.03" dur="15s" repeatCount="indefinite" />
        </line>
        <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="var(--accent)" strokeWidth="0.3" opacity="0.03" strokeDasharray="4 8">
          <animate attributeName="stroke-dashoffset" values="0;100" dur="3s" repeatCount="indefinite" />
        </line>
      </svg>
      <div className="node node-1" />
      <div className="node node-2" />
      <div className="node node-3" />
      <div className="node node-4" />
      <div className="corner-trace corner-tl" />
      <div className="corner-trace corner-tr" />
      <div className="corner-trace corner-bl" />
      <div className="corner-trace corner-br" />
      <div className="bg-tag" style={{ top: "15%", left: "5%", animationDelay: "0s" }}><span className="bg-tag-dot" /> VIDEO ANALYSIS</div>
      <div className="bg-tag" style={{ top: "30%", right: "4%", animationDelay: "1.2s" }}><span className="bg-tag-dot" /> AI INSIGHTS</div>
      <div className="bg-tag" style={{ bottom: "30%", left: "4%", animationDelay: "2.5s" }}><span className="bg-tag-dot" /> ENGAGEMENT</div>
      <div className="bg-tag" style={{ bottom: "15%", right: "5%", animationDelay: "3.8s" }}><span className="bg-tag-dot" /> COMPARISON</div>
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className="data-particle"
          style={{
            left: `${1 + (i * 2.8)}%`,
            animationDelay: `${(i % 12) * 0.9}s`,
            animationDuration: `${10 + (i % 6) * 2.5}s`,
            width: `${1 + (i % 3)}px`,
            height: `${1 + (i % 3)}px`,
          }}
        />
      ))}
    </div>
  );
}

function KnowledgeGraph() {
  return (
    <svg viewBox="0 0 300 110" className="w-full h-auto" fill="none">
      <defs>
        <linearGradient id="kg-line" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#06b6d4" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="kg-node" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <filter id="kg-glow"><feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M60 55 Q110 25 150 55 T240 55 T280 35" stroke="url(#kg-line)" strokeWidth="1.5" filter="url(#kg-glow)">
        <animate attributeName="stroke-dasharray" values="0 600;600 0" dur="1.8s" fill="freeze" />
      </path>
      <path d="M150 55 Q110 85 60 55" stroke="url(#kg-line)" strokeWidth="1" opacity="0.4" />
      <path d="M150 55 Q190 85 240 55" stroke="url(#kg-line)" strokeWidth="1" opacity="0.4" />
      <path d="M60 55 Q35 80 20 65" stroke="url(#kg-line)" strokeWidth="0.7" opacity="0.25" />
      <path d="M240 55 Q265 80 280 65" stroke="url(#kg-line)" strokeWidth="0.7" opacity="0.25" />
      <circle cx="60" cy="55" r="16" fill="var(--bg-card)" stroke="url(#kg-node)" strokeWidth="2" filter="url(#kg-glow)">
        <animate attributeName="r" values="16;18;16" dur="3s" repeatCount="indefinite" />
      </circle>
      <text x="60" y="60" textAnchor="middle" fill="var(--accent)" fontSize="18" fontWeight="bold">A</text>
      <circle cx="150" cy="55" r="13" fill="var(--bg-card)" stroke="url(#kg-node)" strokeWidth="1.8" filter="url(#kg-glow)">
        <animate attributeName="r" values="13;15;13" dur="3.5s" repeatCount="indefinite" begin="0.8s" />
      </circle>
      <text x="150" y="60" textAnchor="middle" fill="#3b82f6" fontSize="14" fontWeight="bold">B</text>
      <circle cx="240" cy="55" r="14" fill="var(--bg-card)" stroke="url(#kg-node)" strokeWidth="1.8" filter="url(#kg-glow)">
        <animate attributeName="r" values="14;16;14" dur="4s" repeatCount="indefinite" begin="1.5s" />
      </circle>
      <text x="240" y="60" textAnchor="middle" fill="var(--accent)" fontSize="15" fontWeight="bold">C</text>
      <circle cx="20" cy="65" r="5" fill="var(--bg-card)" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
      <circle cx="280" cy="65" r="5" fill="var(--bg-card)" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
      <circle cx="150" cy="20" r="4" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="0.8" opacity="0.3" />
      <circle cx="150" cy="90" r="4" fill="var(--bg-card)" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" />
      <circle r="3" fill="var(--accent)" filter="url(#kg-glow)">
        <animateMotion dur="3.5s" repeatCount="indefinite" path="M60 55 Q110 25 150 55" />
      </circle>
      <circle r="2.5" fill="#3b82f6" filter="url(#kg-glow)">
        <animateMotion dur="4s" repeatCount="indefinite" path="M150 55 Q110 85 60 55" begin="1.2s" />
      </circle>
      <circle r="2" fill="#8b5cf6" filter="url(#kg-glow)">
        <animateMotion dur="3s" repeatCount="indefinite" path="M150 55 Q190 85 240 55" begin="0.5s" />
      </circle>
      <circle r="2.5" fill="var(--accent)" filter="url(#kg-glow)">
        <animateMotion dur="4.5s" repeatCount="indefinite" path="M240 55 Q190 25 150 55" begin="2s" />
      </circle>
      <circle cx="60" cy="55" r="22" stroke="var(--accent)" strokeWidth="0.5" opacity="0.15">
        <animate attributeName="r" values="22;28;22" dur="4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0;0.15" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="240" cy="55" r="20" stroke="#3b82f6" strokeWidth="0.5" opacity="0.12">
        <animate attributeName="r" values="20;26;20" dur="5s" repeatCount="indefinite" begin="1s" />
        <animate attributeName="opacity" values="0.12;0;0.12" dur="5s" repeatCount="indefinite" begin="1s" />
      </circle>
    </svg>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  let score = 0;
  if (len >= 6) score++;
  if (len >= 8) score++;
  if (hasUpper && hasLower) score++;
  if (hasDigit) score++;
  if (hasSpecial) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="relative flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
              style={{ width: i <= score ? "100%" : "0%", backgroundColor: colors[score], boxShadow: i <= score ? `0 0 6px ${colors[score]}` : "none" }} />
          </div>
        ))}
      </div>
      <p className="text-[11px] font-medium tracking-wide" style={{ color: colors[score] || "var(--text-muted)" }}>{labels[score]}</p>
    </div>
  );
}

function IconAt() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8v5a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V12A10 10 0 1 0 12 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.15" strokeDasharray="2 2" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L3 7v6c0 5.25 3.83 10.15 9 11 5.17-.85 9-5.75 9-11V7l-9-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v18" stroke="currentColor" strokeWidth="0.5" opacity="0.15" strokeDasharray="2 3" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.12" strokeDasharray="2 2" />
      <circle cx="4" cy="6" r="1.5" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <circle cx="20" cy="5" r="1" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
    </svg>
  );
}

function IconEye({ off }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
      ) : (
        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
      )}
    </svg>
  );
}

function AuthInput({ id, label, type, value, onChange, icon: Icon, error, children }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const floatUp = focused || hasValue;
  return (
    <div className="auth-input-group">
      <div className={`auth-input-wrapper ${error ? "auth-input-error" : ""}`}>
        <div className="auth-input-icon"><Icon /></div>
        <input id={id} type={type} value={value} onChange={onChange}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="auth-input"
          autoComplete={type === "password" ? (id.includes("confirm") ? "new-password" : "off") : id} />
        <label htmlFor={id} className={`auth-label ${floatUp ? "auth-label-float" : ""}`}>{label}</label>
        {children && <div className="auth-input-suffix">{children}</div>}
        <div className={`auth-input-beam ${focused ? "auth-input-beam-active" : ""}`} />
      </div>
      {error && <p className="auth-error-msg">{error}</p>}
    </div>
  );
}

const featureIcons = [
  { path: "M8 5v14l11-7z", extra: <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="0.5" opacity="0.2" /> },
  {
    path: "M12 2a4 4 0 0 1 4 4v2M8 8V6a4 4 0 0 1 4-4z", extra: (
      <><path d="M3 12h4l2 3h6l2-3h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="16" r="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="0.8" /></>
    ),
  },
  { path: "M4 20h16M6 16V8m4 8V4m4 12v-6m4 6v-2", extra: (<><circle cx="6" cy="6" r="1.5" fill="currentColor" opacity="0.2" /><circle cx="14" cy="10" r="1.5" fill="currentColor" opacity="0.15" /></>) },
  { path: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", extra: <path d="M9 9h6M9 13h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" /> },
];

const features = [
  { icon: 0, text: "Compare YouTube & Instagram Reels" },
  { icon: 1, text: "AI-Powered Video Analysis" },
  { icon: 2, text: "Real-Time Engagement Metrics" },
  { icon: 3, text: "Smart Q&A with RAG Technology" },
];

export default function AuthPage() {
  const { darkMode, setDarkMode } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginErrors, setLoginErrors] = useState({});
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [signupErrors, setSignupErrors] = useState({});

  function validateLogin() {
    const err = {};
    if (!loginForm.email.trim()) err.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(loginForm.email)) err.email = "Invalid email format";
    if (!loginForm.password) err.password = "Password is required";
    setLoginErrors(err);
    return Object.keys(err).length === 0;
  }
  function validateSignup() {
    const err = {};
    if (!signupForm.name.trim()) err.name = "Name is required";
    if (!signupForm.email.trim()) err.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(signupForm.email)) err.email = "Invalid email format";
    if (!signupForm.password) err.password = "Password is required";
    else if (signupForm.password.length < 6) err.password = "Minimum 6 characters";
    if (signupForm.password !== signupForm.confirmPassword) err.confirmPassword = "Passwords don't match";
    setSignupErrors(err);
    return Object.keys(err).length === 0;
  }
  async function handleLogin(e) {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    try {
      const data = await loginApi(loginForm.email, loginForm.password);
      localStorage.setItem("rag_token", data.token);
      localStorage.setItem("rag_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setLoginErrors({ form: err.name === "AbortError" ? "Connection timed out. Is the backend running?" : err.message });
    } finally {
      setLoading(false);
    }
  }
  async function handleSignup(e) {
    e.preventDefault();
    if (!validateSignup()) return;
    setLoading(true);
    try {
      const data = await signupApi(signupForm.name, signupForm.email, signupForm.password);
      localStorage.setItem("rag_token", data.token);
      localStorage.setItem("rag_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      if (err.name === "AbortError") {
        setSignupErrors({ form: "Connection timed out. Is the backend running?" });
      } else if (err.message === "Email already registered") {
        setSignupErrors({ email: err.message });
      } else {
        setSignupErrors({ form: err.message });
      }
    } finally {
      setLoading(false);
    }
  }
  function updateLogin(field, value) { setLoginForm((prev) => ({ ...prev, [field]: value })); if (loginErrors[field]) setLoginErrors((prev) => ({ ...prev, [field]: "" })); }
  function updateSignup(field, value) { setSignupForm((prev) => ({ ...prev, [field]: value })); if (signupErrors[field]) setSignupErrors((prev) => ({ ...prev, [field]: "" })); }

  return (
    <div className="auth-page">
      <NeuralBg />
      <button onClick={() => setDarkMode(!darkMode)}
        className="fixed top-5 right-5 z-50 auth-theme-btn"
        title={darkMode ? "Light mode" : "Dark mode"}>
        {darkMode ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      <div className="auth-container">
        {/* ===== LEFT: Brand Side ===== */}
        <div className="auth-brand">
          <div className="auth-brand-inner">
            <div className="flex items-center gap-3 mb-5">
              <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
                <defs><linearGradient id="logo-brand" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#06b6d4"/><stop offset="1" stopColor="#3b82f6"/>
                </linearGradient></defs>
                <rect width="32" height="32" rx="8" fill="url(#logo-brand)"/>
                <path d="M12 9.5v13l10-6.5z" fill="#fff"/>
              </svg>
              <div>
                <h1 className="auth-brand-title">RAG Analytics</h1>
                <p className="auth-brand-subtitle">Video Intelligence Platform</p>
              </div>
            </div>

            <p className="auth-brand-desc">
              Compare YouTube and Instagram Reels side by side — extract transcripts, analyze engagement, and get AI-driven insights in real time.
            </p>

            <div className="auth-brand-graph">
              <KnowledgeGraph />
            </div>

            <div className="auth-brand-features">
              {features.map((f, i) => (
                <div key={i} className="auth-brand-feature" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                  <span className="auth-brand-feature-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={featureIcons[f.icon].path} />{featureIcons[f.icon].extra}
                    </svg>
                  </span>
                  <span className="auth-brand-feature-text">{f.text}</span>
                </div>
              ))}
            </div>

            <div className="auth-brand-footer">
              <span className="auth-brand-badge">YouTube</span>
              <span className="auth-brand-badge">Instagram Reels</span>
            </div>
          </div>
        </div>

        {/* ===== RIGHT: Form Side ===== */}
        <div className="auth-form-side">
          <div className="auth-card">
            <div className="auth-tabs">
              <button className={`auth-tab ${tab === "login" ? "auth-tab-active" : ""}`}
                onClick={() => { setTab("login"); setLoginErrors({}); }}>Sign In</button>
              <button className={`auth-tab ${tab === "signup" ? "auth-tab-active" : ""}`}
                onClick={() => { setTab("signup"); setSignupErrors({}); }}>Register</button>
              <div className={`auth-tab-indicator ${tab === "login" ? "translate-x-0" : "translate-x-full"}`} />
            </div>

            {tab === "login" && (
              <form onSubmit={handleLogin} className="auth-form">
                <AuthInput id="login-email" label="Email address" type="email" value={loginForm.email}
                  onChange={(e) => updateLogin("email", e.target.value)} error={loginErrors.email} icon={IconAt} />
                <AuthInput id="login-password" label="Password" type={showPassword ? "text" : "password"} value={loginForm.password}
                  onChange={(e) => updateLogin("password", e.target.value)} error={loginErrors.password} icon={IconShield}>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="auth-eye-btn" tabIndex={-1}><IconEye off={showPassword} /></button>
                </AuthInput>
                {loginErrors.form && <div className="auth-error-banner">{loginErrors.form}</div>}
                <button type="submit" disabled={loading} className="auth-submit">
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</span> : <span>Sign In</span>}
                </button>
                <p className="auth-switch">Don't have an account?{' '}<button type="button" className="auth-switch-link" onClick={() => { setTab("signup"); setLoginErrors({}); }}>Register</button></p>
              </form>
            )}

            {tab === "signup" && (
              <form onSubmit={handleSignup} className="auth-form">
                <AuthInput id="signup-name" label="Full name" type="text" value={signupForm.name}
                  onChange={(e) => updateSignup("name", e.target.value)} error={signupErrors.name} icon={IconUser} />
                <AuthInput id="signup-email" label="Email address" type="email" value={signupForm.email}
                  onChange={(e) => updateSignup("email", e.target.value)} error={signupErrors.email} icon={IconAt} />
                <AuthInput id="signup-password" label="Password" type={showPassword ? "text" : "password"} value={signupForm.password}
                  onChange={(e) => updateSignup("password", e.target.value)} error={signupErrors.password} icon={IconShield}>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="auth-eye-btn" tabIndex={-1}><IconEye off={showPassword} /></button>
                </AuthInput>
                <PasswordStrength password={signupForm.password} />
                <AuthInput id="signup-confirm" label="Confirm password" type={showConfirm ? "text" : "password"} value={signupForm.confirmPassword}
                  onChange={(e) => updateSignup("confirmPassword", e.target.value)} error={signupErrors.confirmPassword} icon={IconShield}>
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="auth-eye-btn" tabIndex={-1}><IconEye off={showConfirm} /></button>
                </AuthInput>
                <div className="mt-1 mb-3" />
                {signupErrors.form && <div className="auth-error-banner">{signupErrors.form}</div>}
                <button type="submit" disabled={loading} className="auth-submit">
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</span> : <span>Create Account</span>}
                </button>
                <p className="auth-switch">Already have an account?{' '}<button type="button" className="auth-switch-link" onClick={() => { setTab("login"); setSignupErrors({}); }}>Sign in</button></p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
