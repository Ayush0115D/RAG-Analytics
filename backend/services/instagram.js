import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_WIN = process.platform === "win32";
const YTDLP_NAME = IS_WIN ? "yt-dlp.exe" : "yt-dlp";
const YTDLP_PATH = path.join(__dirname, "..", YTDLP_NAME);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Resolve cookies file path
const COOKIES_PATH = process.env.INSTAGRAM_COOKIES_FILE
  ? path.resolve(__dirname, "..", process.env.INSTAGRAM_COOKIES_FILE)
  : path.join(__dirname, "..", "instagram_cookies.txt");

// Write cookies from env var to file if provided
// INSTAGRAM_COOKIES_B64 takes priority, then INSTAGRAM_COOKIES.
// INSTAGRAM_COOKIES_FILE controls WHERE to write (not whether).
const cookiesRaw = process.env.INSTAGRAM_COOKIES_B64 || process.env.INSTAGRAM_COOKIES;
if (cookiesRaw) {
  try {
    const content = process.env.INSTAGRAM_COOKIES_B64
      ? Buffer.from(cookiesRaw, "base64").toString()
      : cookiesRaw;
    fs.writeFileSync(COOKIES_PATH, content, "utf-8");
    console.log(`Instagram cookies written to ${COOKIES_PATH}`);
  } catch (e) {
    console.error("Failed to write Instagram cookies:", e.message);
  }
}

function extractReelId(url) {
  const patterns = [
    /(?:instagram\.com\/reel\/|instagram\.com\/p\/)([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  throw new Error("Invalid Instagram Reel URL");
}

async function findYtDlp() {
  if (fs.existsSync(YTDLP_PATH)) {
    const stat = fs.statSync(YTDLP_PATH);
    if (stat.size > 1024 * 1024) return YTDLP_PATH;
    console.log(`yt-dlp binary too small (${stat.size} bytes), re-downloading...`);
    fs.unlinkSync(YTDLP_PATH);
  }

  for (const name of ["yt-dlp", "yt-dlp.exe"]) {
    try {
      const { stdout } = await execFileAsync(name, ["--version"]);
      if (stdout.trim()) return name;
    } catch {}
  }

  const binaryName = IS_WIN ? "yt-dlp.exe" : "yt-dlp";
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
  console.log(`Downloading yt-dlp (${binaryName})...`);
  const { data } = await axios.get(url, { responseType: "stream" });
  const writer = fs.createWriteStream(YTDLP_PATH, { mode: 0o755 });
  data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  return YTDLP_PATH;
}

function parseEngagementRate(views, likes, comments) {
  return views > 0
    ? (((likes + comments) / views) * 100).toFixed(2)
    : "0.00";
}

async function transcribeAudio(audioPath, durationSec) {
  try {
    const audioData = fs.readFileSync(audioPath);
    const base64Audio = audioData.toString("base64");
    const ext = path.extname(audioPath).toLowerCase();
    const mimeMap = { ".m4a": "audio/mp4", ".webm": "audio/webm", ".mp3": "audio/mp3", ".opus": "audio/ogg", ".aac": "audio/aac", ".wav": "audio/wav" };

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeMap[ext] || "audio/mp4",
          data: base64Audio,
        },
      },
      "Transcribe the speech in this audio word-for-word. Return ONLY the raw transcript text, no timestamps or extra formatting.",
    ]);

    const text = result.response.text().trim();
    if (!text || text.length < 10) return [];

    const words = text.split(/\s+/);
    const avgWordDuration = (durationSec * 1000) / Math.max(words.length, 1);

    return words.map((word, i) => ({
      text: word,
      offset: Math.round(i * avgWordDuration),
      dur: Math.round(avgWordDuration),
    }));
  } catch (err) {
    console.warn("Gemini transcription failed:", err.message);
    return [];
  }
}

let _ytDlpPath = null;
export async function ensureYtDlp() {
  if (!_ytDlpPath) _ytDlpPath = await findYtDlp();
  return _ytDlpPath;
}

async function tryFetchYtDlp(ytDlp, args, url) {
  try {
    const { stdout } = await execFileAsync(ytDlp, [...args, url]);
    return JSON.parse(stdout);
  } catch { return null; }
}

export async function getInstagramData(url) {
  const reelId = extractReelId(url);
  if (!_ytDlpPath) _ytDlpPath = await findYtDlp();
  const ytDlp = _ytDlpPath;

  // Determine cookie strategy
  const useCookiesFile = fs.existsSync(COOKIES_PATH);
  const browser = process.env.INSTAGRAM_BROWSER || "chrome";
  const cookieArg = useCookiesFile
    ? ["--cookies", COOKIES_PATH]
    : ["--cookies-from-browser", browser];

  console.log(`Instagram: using ${useCookiesFile ? "cookies file" : "browser cookies (" + browser + ")"}`);

  let info;

  // Attempt 1: with cookies
  const withCookiesArgs = ["--dump-json", "--no-download", ...cookieArg];
  if (IS_WIN) withCookiesArgs.push("--no-check-certificate");
  info = await tryFetchYtDlp(ytDlp, withCookiesArgs, url);

  // Attempt 2: if browser cookies failed, try without (public reels)
  if (!info && !useCookiesFile) {
    console.log("Instagram: browser cookies failed, retrying without cookies");
    const noCookieArgs = ["--dump-json", "--no-download"];
    if (IS_WIN) noCookieArgs.push("--no-check-certificate");
    info = await tryFetchYtDlp(ytDlp, noCookieArgs, url);
  }

  if (!info) {
    throw new Error(
      "Instagram requires login. " + (IS_WIN
        ? "Log into Instagram in your browser, or set INSTAGRAM_COOKIES_B64 env var."
        : "Export cookies via browser extension and set INSTAGRAM_COOKIES_B64.")
    );
  }

  console.log(`Instagram: metadata fetched for ${reelId}`);

  const metadata = {
    video_id: "B",
    title: info.title || info.description || "",
    creator: info.uploader || info.channel || info.creator || "",
    follower_count: info.channel_follower_count ?? 0,
    views: info.view_count ?? 0,
    likes: info.like_count ?? 0,
    comments: info.comment_count ?? 0,
    upload_date: info.upload_date ?? "",
    duration: info.duration ?? 0,
    hashtags: info.tags ?? [],
    thumbnail: info.thumbnail?.startsWith("data:") ? "" : (info.thumbnail ?? ""),
    engagement_rate: "0.00",
  };

  metadata.engagement_rate = parseEngagementRate(
    metadata.views, metadata.likes, metadata.comments
  );

  let transcript = [];
  const tempDir = path.join(__dirname, "..", "temp");
  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const audioBase = path.join(tempDir, reelId);
    const audioArgs = [
      ...cookieArg, "-f", "bestaudio",
      "--no-check-certificate",
      "--extractor-retries", "3",
      "-o", audioBase,
      url,
    ];
    await execFileAsync(ytDlp, audioArgs);

    const audioFile = fs.readdirSync(tempDir).find((f) => f.startsWith(reelId));
    if (audioFile) {
      const audioPath = path.join(tempDir, audioFile);
      if (fs.statSync(audioPath).size > 0) {
        transcript = await transcribeAudio(audioPath, metadata.duration);
      }
      fs.unlinkSync(audioPath);
    }
  } catch (err) {
    console.warn("Instagram audio transcription failed:", err.message);
  }

  return { transcript, metadata };
}
//  https://www.instagram.com/reel/DY7e9WrTbve/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==