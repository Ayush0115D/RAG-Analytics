import axios from "axios";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function extractVideoId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  throw new Error("Invalid YouTube URL");
}

function parseNum(str) {
  if (!str) return 0;
  const n = Number(String(str).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export function normalizeSupadataTranscript(content) {
  const segments = typeof content === "string" ? [{ text: content }] : Array.isArray(content) ? content : [];
  return segments.map((segment) => ({
    text: String(segment.text || "").trim(),
    offset: Number(segment.offset) || 0,
    dur: Number(segment.duration) || 0,
  })).filter((segment) => segment.text);
}

async function requestSupadataTranscript(videoId) {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;

  const { data, status } = await axios.get("https://api.supadata.ai/v1/transcript", {
    params: {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      mode: process.env.SUPADATA_MODE || "auto",
      lang: process.env.SUPADATA_LANG || "en",
    },
    headers: { "x-api-key": apiKey },
    timeout: 20000,
  });

  if (status === 202 || data.jobId) {
    if (!data.jobId) throw new Error("Supadata started a transcript job without returning its job ID");
    return { jobId: data.jobId };
  }
  return { transcript: normalizeSupadataTranscript(data.content) };
}

export async function getSupadataTranscriptJob(jobId) {
  if (!process.env.SUPADATA_API_KEY) throw new Error("SUPADATA_API_KEY is not configured");
  if (!jobId || !/^[\w-]+$/.test(jobId)) throw new Error("Invalid transcript job ID");

  const { data } = await axios.get(`https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`, {
    headers: { "x-api-key": process.env.SUPADATA_API_KEY },
    timeout: 10000,
  });

  if (data.status === "failed") throw new Error(data.error || "Transcript processing failed");
  if (data.status === "completed") {
    const transcript = normalizeSupadataTranscript(data.content);
    if (transcript.length === 0) throw new Error("No speech was found in the video");
    return { status: data.status, transcript };
  }
  if (data.status === "queued" || data.status === "active") return { status: data.status };
  throw new Error(data.error || `Unexpected transcript job status: ${data.status}`);
}

async function fetchTranscript(videoId) {
  if (!process.env.SUPADATA_API_KEY) {
    console.error("YouTube transcript unavailable: SUPADATA_API_KEY is not configured");
    return {
      transcript: [],
      source: "supadata",
      error: "YouTube transcription is not configured. Add SUPADATA_API_KEY to the backend environment.",
    };
  }

  try {
    const result = await requestSupadataTranscript(videoId);
    if (result.jobId) return { transcript: [], jobId: result.jobId, source: "supadata" };
    if (result.transcript.length > 0) {
      console.log("Transcript via Supadata:", result.transcript.length);
      return { transcript: result.transcript, source: "supadata" };
    }
    return {
      transcript: [],
      source: "supadata",
      error: "Supadata returned no transcript. Check that the video is public and supports transcription.",
    };
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error("Supadata transcript failed:", message);
    return { transcript: [], source: "supadata", error: `Supadata transcript failed: ${message}` };
  }
}

export async function getYouTubeData(url) {
  const videoId = extractVideoId(url);
  const API_KEY = process.env.YOUTUBE_API_KEY;

  const meta = { title: "", creator: "", follower_count: 0, views: 0, likes: 0, comments: 0, upload_date: "", duration: 0, hashtags: [], thumbnail: "" };

  if (API_KEY) {
    try {
      const { data } = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: { part: "statistics,snippet,contentDetails", id: videoId, key: API_KEY },
      });
      const item = data.items?.[0];
      if (item) {
        const s = item.statistics || {}, sn = item.snippet || {}, cd = item.contentDetails || {};
        meta.title = sn.title || ""; meta.creator = sn.channelTitle || ""; meta.views = parseNum(s.viewCount); meta.likes = parseNum(s.likeCount); meta.comments = parseNum(s.commentCount);
        meta.upload_date = sn.publishedAt?.slice(0, 10) || ""; meta.hashtags = (sn.tags || []).slice(0, 10);
        meta.thumbnail = sn.thumbnails?.maxres?.url || sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || "";
        const d = cd.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (d) meta.duration = parseInt(d[1] || "0") * 3600 + parseInt(d[2] || "0") * 60 + parseInt(d[3] || "0");
        try { const { data: ch } = await axios.get("https://www.googleapis.com/youtube/v3/channels", { params: { part: "statistics", id: sn.channelId, key: API_KEY } }); if (ch.items?.[0]) meta.follower_count = parseNum(ch.items[0].statistics?.subscriberCount); } catch {}
      }
    } catch {}
  }

  if (!meta.views && !meta.title) {
    try {
      const { data: html } = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        timeout: 15000,
      });
      const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
      if (m) {
        const pr = JSON.parse(m[1]), vd = pr.videoDetails;
        if (vd) { meta.title = meta.title || vd.title || ""; meta.creator = meta.creator || vd.author || ""; meta.views = meta.views || parseNum(vd.viewCount); meta.duration = meta.duration || parseNum(vd.lengthSeconds); meta.thumbnail = meta.thumbnail || vd.thumbnail?.thumbnails?.at(-1)?.url || ""; }
        if (pr.microformat?.playerMicroformatRenderer) meta.upload_date = meta.upload_date || pr.microformat.playerMicroformatRenderer.publishDate || "";
      }
    } catch {}
  }

  meta.engagement_rate = meta.views > 0 ? (((meta.likes + meta.comments) / meta.views) * 100).toFixed(2) : "0.00";

  const transcriptResult = await fetchTranscript(videoId);
  return {
    transcript: transcriptResult.transcript,
    metadata: meta,
    transcript_job_id: transcriptResult.jobId,
    transcript_source: transcriptResult.source,
    transcript_error: transcriptResult.transcript.length === 0 && !transcriptResult.jobId
      ? transcriptResult.error || (process.env.SUPADATA_API_KEY
        ? "No transcript was found. Check that the video is public and that Supadata supports it."
        : "No transcript was available. Configure SUPADATA_API_KEY on the backend for production transcript extraction.")
      : undefined,
  };
}
