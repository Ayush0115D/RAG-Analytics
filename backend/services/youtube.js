import { YoutubeTranscript } from "youtube-transcript";
import axios from "axios";

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  throw new Error("Invalid YouTube URL");
}

function parseNum(str) {
  if (!str) return 0;
  const n = Number(String(str).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

async function scrapePage(videoId) {
  const { data: html } = await axios.get(
    `https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }
  );

  const meta = {
    title: "",
    creator: "",
    follower_count: 0,
    views: 0,
    likes: 0,
    comments: 0,
    upload_date: "",
    duration: 0,
    hashtags: [],
    thumbnail: "",
  };

  const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
  if (prMatch) {
    try {
      const pr = JSON.parse(prMatch[1]);
      const vd = pr.videoDetails;
      if (vd) {
        meta.title = vd.title || "";
        meta.creator = vd.author || "";
        meta.views = parseNum(vd.viewCount);
        meta.duration = parseNum(vd.lengthSeconds);
        meta.thumbnail = vd.thumbnail?.thumbnails?.at(-1)?.url || "";
      }
      const mf = pr.microformat?.playerMicroformatRenderer;
      if (mf) {
        meta.upload_date = mf.publishDate || "";
      }
    } catch {}
  }

  const diMatch = html.match(/ytInitialData\s*=\s*(\{.+?)\};\s*\n/);
  /* ytInitialData is too large for simple regex; likes/comments
     require the YouTube Data API for reliable extraction. */

  return meta;
}

export async function getYouTubeData(url) {
  const videoId = extractVideoId(url);
  const meta = await scrapePage(videoId);

  let transcript = [];
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);
    transcript = raw.map((t) => ({
      text: t.text,
      offset: t.offset,
      dur: t.duration,
    }));
  } catch {
    transcript = [];
  }

  meta.engagement_rate =
    meta.views > 0
      ? (((meta.likes + meta.comments) / meta.views) * 100).toFixed(2)
      : "0.00";

  return { transcript, metadata: meta };
}
