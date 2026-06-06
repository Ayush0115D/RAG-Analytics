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

// Write Instagram cookies to file from env var (so yt-dlp can use them)
const COOKIES_PATH = process.env.INSTAGRAM_COOKIES_FILE || path.join(__dirname, "..", "instagram_cookies.txt");
const cookiesRaw = process.env.INSTAGRAM_COOKIES || process.env.INSTAGRAM_COOKIES_B64;
if (cookiesRaw && !fs.existsSync(COOKIES_PATH)) {
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
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/mp3",
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

export async function getInstagramData(url) {
  const reelId = extractReelId(url);
  const ytDlp = await findYtDlp();

  // Build cookie args
  let cookieArgs = [];
  if (fs.existsSync(COOKIES_PATH)) {
    cookieArgs = ["--cookies", COOKIES_PATH];
    console.log("Instagram: using cookies file");
  } else if (!IS_WIN) {
    throw new Error(
      "Instagram cookies file not found. Steps:\n" +
      "1. Install 'cookies.txt' browser extension\n" +
      "2. Log into Instagram, export cookies\n" +
      "3. Set INSTAGRAM_COOKIES_B64 on Render"
    );
  } else {
    const browser = process.env.INSTAGRAM_BROWSER || "chrome";
    cookieArgs = ["--cookies-from-browser", browser];
    console.log(`Instagram: trying browser cookies (${browser})`);
  }

  const metaArgs = ["--dump-json", "--no-download", ...cookieArgs];
  if (IS_WIN) metaArgs.push("--no-check-certificate");

  let info;
  try {
    const { stdout } = await execFileAsync(ytDlp, [...metaArgs, url]);
    info = JSON.parse(stdout);
    console.log(`Instagram: metadata fetched for ${reelId}`);
  } catch (err) {
    throw new Error(err.stderr?.includes("cookies") || err.stderr?.includes("login")
      ? "Instagram requires login. " + (IS_WIN
          ? "Log into Instagram in your browser, or set INSTAGRAM_COOKIES_FILE."
          : "Export cookies via browser extension and set INSTAGRAM_COOKIES_B64.")
      : `Instagram failed: ${err.stderr?.slice(0, 200) || err.message}`
    );
  }

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
    thumbnail: info.thumbnail ?? "",
    engagement_rate: "0.00",
  };

  metadata.engagement_rate = parseEngagementRate(
    metadata.views, metadata.likes, metadata.comments
  );

  let transcript = [];
  const tempDir = path.join(__dirname, "..", "temp");
  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const audioPath = path.join(tempDir, `${reelId}.mp3`);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

    // Audio download args (no --no-download flag)
    const audioArgs = [
      ...cookieArgs, "-x", "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-check-certificate",
      "-o", audioPath,
      url,
    ];
    await execFileAsync(ytDlp, audioArgs);

    if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
      transcript = await transcribeAudio(audioPath, metadata.duration);
    }
  } catch (err) {
    console.warn("Instagram audio transcription failed:", err.message);
  } finally {
    const audioPath = path.join(tempDir, `${reelId}.mp3`);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }

  return { transcript, metadata };
}
//  https://www.instagram.com/reel/DY7e9WrTbve/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==