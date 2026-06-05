import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDLP_PATH = path.join(__dirname, "..", "yt-dlp.exe");

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

  console.log("Downloading yt-dlp...");
  const { data } = await axios.get(
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
    { responseType: "stream" }
  );
  const writer = fs.createWriteStream(YTDLP_PATH);
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

export async function getInstagramData(url) {
  const reelId = extractReelId(url);
  const ytDlp = await findYtDlp();

  const args = ["--dump-json", "--no-download", "--no-check-certificate"];

  const cookiesFile = process.env.INSTAGRAM_COOKIES_FILE;
  if (cookiesFile && fs.existsSync(cookiesFile)) {
    args.push("--cookies", cookiesFile);
  } else {
    const browser = process.env.INSTAGRAM_BROWSER || "chrome";
    args.push("--cookies-from-browser", browser);
  }

  let info;
  try {
    const { stdout } = await execFileAsync(ytDlp, [...args, url]);
    info = JSON.parse(stdout);
  } catch (err) {
    throw new Error(
      "Instagram requires login. To fix:\n" +
      "1. Log into Instagram in your browser\n" +
      '2. Set INSTAGRAM_BROWSER in .env (e.g. INSTAGRAM_BROWSER=edge)\n' +
      "3. Or export cookies to a txt file and set INSTAGRAM_COOKIES_FILE"
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
  try {
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const audioPath = path.join(tempDir, `${reelId}.mp3`);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

    await execFileAsync(ytDlp, [
      ...args,
      "-x", "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-check-certificate",
      "-o", audioPath,
      url,
    ]);

    if (fs.existsSync(audioPath)) {
      transcript = [{ text: "[Audio downloaded — pending transcription via Gemini]", offset: 0, dur: metadata.duration * 1000 }];
      metadata._audioPath = audioPath;
    }
  } catch {}

  return { transcript, metadata };
}
