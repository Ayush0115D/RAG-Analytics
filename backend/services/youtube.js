import { YoutubeTranscript } from "youtube-transcript";
import ytdl from "@distube/ytdl-core";
import axios from "axios";

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
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

export async function getYouTubeData(url) {
  const videoId = extractVideoId(url);
  const API_KEY = process.env.YOUTUBE_API_KEY;

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

  // Use YouTube Data API v3 for reliable statistics
  if (API_KEY) {
    try {
      const { data } = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: {
            part: "statistics,snippet,contentDetails",
            id: videoId,
            key: API_KEY,
          },
        }
      );
      const item = data.items?.[0];
      if (item) {
        const s = item.statistics || {};
        const sn = item.snippet || {};
        const cd = item.contentDetails || {};

        meta.title = sn.title || "";
        meta.creator = sn.channelTitle || "";
        meta.views = parseNum(s.viewCount);
        meta.likes = parseNum(s.likeCount);
        meta.comments = parseNum(s.commentCount);
        meta.upload_date = sn.publishedAt?.slice(0, 10) || "";
        meta.hashtags = (sn.tags || []).slice(0, 10);
        meta.thumbnail =
          sn.thumbnails?.maxres?.url ||
          sn.thumbnails?.high?.url ||
          sn.thumbnails?.default?.url ||
          "";

        // Parse ISO 8601 duration
        const durMatch = cd.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (durMatch) {
          const h = parseInt(durMatch[1] || "0");
          const m = parseInt(durMatch[2] || "0");
          const s = parseInt(durMatch[3] || "0");
          meta.duration = h * 3600 + m * 60 + s;
        }

        // Get subscriber count from channels API
        try {
          const { data: channelData } = await axios.get(
            "https://www.googleapis.com/youtube/v3/channels",
            {
              params: {
                part: "statistics",
                id: sn.channelId,
                key: API_KEY,
              },
            }
          );
          const ch = channelData.items?.[0];
          if (ch) {
            meta.follower_count = parseNum(ch.statistics?.subscriberCount);
          }
        } catch {}
      }
    } catch (err) {
      console.warn("YouTube Data API failed, falling back to scrape:", err.message);
    }
  }

  // Fallback: scrape basic info if API fails or no key
  if (!meta.views && !meta.title) {
    try {
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

      const prMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
      if (prMatch) {
        try {
          const pr = JSON.parse(prMatch[1]);
          const vd = pr.videoDetails;
          if (vd) {
            meta.title = meta.title || vd.title || "";
            meta.creator = meta.creator || vd.author || "";
            meta.views = meta.views || parseNum(vd.viewCount);
            meta.duration = meta.duration || parseNum(vd.lengthSeconds);
            meta.thumbnail =
              meta.thumbnail ||
              vd.thumbnail?.thumbnails?.at(-1)?.url ||
              "";
          }
          const mf = pr.microformat?.playerMicroformatRenderer;
          if (mf) {
            meta.upload_date = meta.upload_date || mf.publishDate || "";
          }
        } catch {}
      }
    } catch {}
  }

  let transcript = [];
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // Method 1: youtube-transcript package
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);
    transcript = raw.map((t) => ({
      text: t.text,
      offset: t.offset,
      dur: t.duration,
    }));
    console.log(`YouTube transcript: ${transcript.length} entries (method 1)`);
  } catch (e1) {
    console.warn("Method 1 failed:", e1.message);
    await delay(1000);

    // Method 2: ytdl-core (fetch caption XML directly)
    try {
      console.log("Trying transcript method 2 (ytdl-core)...");
      const info = await ytdl.getInfo(videoId, {
        requestOptions: { headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" }, timeout: 15000 },
      });
      const tracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks?.length > 0) {
        const track = tracks.find((t) => t.languageCode === "en") || tracks[0];
        const resp = await fetch(track.baseUrl, { headers: { "User-Agent": ua } });
        const xml = await resp.text();
        const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
        transcript = textMatches.map((m, i) => ({
          text: m.replace(/<text[^>]*>/, "").replace(/<\/text>/, "")
            .replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"'),
          offset: i * 5000,
          dur: 5000,
        }));
        console.log(`YouTube transcript: ${transcript.length} entries (method 2)`);
      }
    } catch (e2) { console.warn("Method 2 failed:", e2.message); }

    // Method 3: youtubetranscript.com API
    if (transcript.length === 0) {
      await delay(1000);
      try {
        console.log("Trying transcript method 3 (youtubetranscript.com)...");
        const { data } = await axios.get(`https://youtubetranscript.com/?v=${videoId}`, {
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          timeout: 30000,
        });
        if (data && typeof data === "string") {
          const lines = data.split("\n").filter((l) => l.trim());
          transcript = lines.map((line) => {
            const m = line.match(/^\[(\d+)\s*s\]\s*(.+)$/);
            return m ? { text: m[2], offset: parseInt(m[1]) * 1000, dur: 0 }
                     : { text: line.trim(), offset: 0, dur: 0 };
          });
          console.log(`YouTube transcript: ${transcript.length} entries (method 3)`);
        }
      } catch (e3) { console.warn("Method 3 failed:", e3.message); }

      // Method 4: fetch transcript JSON from youtubetranscript.com API
      if (transcript.length === 0) {
        await delay(1000);
        try {
          console.log("Trying transcript method 4 (youtubetranscript.com /api)...");
          const { data } = await axios.get(`https://youtubetranscript.com/api?vid=${videoId}`, {
            headers: { "User-Agent": ua, "Accept": "application/json" },
            timeout: 30000,
          });
          if (data && Array.isArray(data)) {
            transcript = data.map((item) => ({
              text: item.text,
              offset: Math.round(parseFloat(item.offset) * 1000),
              dur: Math.round(parseFloat(item.duration) * 1000),
            }));
            console.log(`YouTube transcript: ${transcript.length} entries (method 4)`);
          }
        } catch (e4) { console.warn("Method 4 failed:", e4.message); }
      }

      if (transcript.length === 0) {
        console.warn(`YouTube transcript: all 4 methods failed for ${videoId}`);
      }
    }
  }

  meta.engagement_rate =
    meta.views > 0
      ? (((meta.likes + meta.comments) / meta.views) * 100).toFixed(2)
      : "0.00";

  return { transcript, metadata: meta };
}
