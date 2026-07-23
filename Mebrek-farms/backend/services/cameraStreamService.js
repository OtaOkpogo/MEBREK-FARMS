/**
 * cameraStreamService.js
 *
 * Owns everything related to turning a private RTSP feed into a
 * browser-playable HLS stream, without ever exposing RTSP credentials
 * or the RTSP URL outside this file.
 *
 * Responsibilities:
 *  - Load private camera credentials (rtspUsername/rtspPassword/streamUrl)
 *  - Build the internal RTSP URL
 *  - Spawn/track an ffmpeg process per camera
 *  - Write HLS segments to a backend-only temp directory
 *  - Serve those segments safely (path-traversal-checked)
 *  - Idle-timeout and clean up streams nobody is watching
 *
 * FIELD NAMES (matches actual Camera schema):
 *   nvrIp, rtspPort, channel        — public-ish connection info
 *   nvrUsername / nvrPassword       — select: false
 *   rtspUsername / rtspPassword     — select: false (preferred if set)
 *   streamUrl                       — select: false, optional manual
 *                                      override (full rtsp:// URL)
 *   isDeleted, isEnabled            — camera state
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const Camera = require("../models/Camera");

// Backend-only scratch space for HLS segments. Never served by static
// middleware directly — only via the checked serveSegment() below.
const HLS_ROOT = path.join(__dirname, "..", "tmp", "hls");

// Hikvision channel stream suffix: "01" = main stream (full res, higher
// bitrate), "02" = sub stream (lower res, much lighter — better for
// multi-camera grid views). Change to "02" if you want the lighter feed.
const STREAM_TYPE_SUFFIX = "01";

// How long to keep an ffmpeg process alive with no one requesting
// segments before we tear it down.
const IDLE_TIMEOUT_MS = 60 * 1000;

// How often to sweep for idle streams.
const SWEEP_INTERVAL_MS = 15 * 1000;

/**
 * In-memory registry of active streams.
 * key: cameraId (string)
 * value: {
 *   process: ChildProcess,
 *   dir: string,
 *   startedAt: number,
 *   lastAccessedAt: number,
 *   ready: boolean,          // true once index.m3u8 exists
 *   readyPromise: Promise,   // resolves when playlist first appears
 * }
 */
const activeStreams = new Map();

function ensureHlsRoot() {
  if (!fs.existsSync(HLS_ROOT)) {
    fs.mkdirSync(HLS_ROOT, { recursive: true });
  }
}

/**
 * Builds the internal RTSP URL from private camera fields.
 * This value must NEVER be sent to the client, logged at info level,
 * or included in any thrown error message that reaches an API response.
 *
 * Priority:
 *   1. `streamUrl` if explicitly set — treated as a manual override
 *      (full rtsp:// URL), with credentials injected into it.
 *   2. Otherwise, built from nvrIp + rtspPort + channel, Hikvision-style:
 *      rtsp://user:pass@ip:port/Streaming/Channels/{channel}{STREAM_TYPE_SUFFIX}
 *
 * Credentials priority: rtspUsername/rtspPassword if set, else falls
 * back to nvrUsername/nvrPassword.
 */
function buildRtspUrl(camera) {
  const { nvrIp, rtspPort, channel, streamUrl } = camera;
  const username = camera.rtspUsername || camera.nvrUsername || "";
  const password = camera.rtspPassword || camera.nvrPassword || "";

  if (streamUrl) {
    try {
      const url = new URL(streamUrl);
      if (username) url.username = encodeURIComponent(username);
      if (password) url.password = encodeURIComponent(password);
      return url.toString();
    } catch (err) {
      throw new Error("Camera streamUrl is not a valid RTSP URL");
    }
  }

  if (!nvrIp) {
    throw new Error("Camera has no nvrIp or streamUrl configured");
  }
  if (!channel) {
    throw new Error("Camera has no channel configured");
  }

  const port = rtspPort || 554;
  const auth = username
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    : "";
  const channelPath = `${channel}${STREAM_TYPE_SUFFIX}`;

  return `rtsp://${auth}${nvrIp}:${port}/Streaming/Channels/${channelPath}`;
}

/**
 * Starts (or reuses) an ffmpeg RTSP->HLS process for a camera.
 * Returns the relative HLS path the client should hit, e.g.
 * "/api/cameras/<id>/stream/index.m3u8" is built by the controller —
 * this just returns { cameraId } once the playlist is ready.
 */
async function startStream(cameraId) {
  ensureHlsRoot();

  const existing = activeStreams.get(cameraId);
  if (existing) {
    existing.lastAccessedAt = Date.now();
    if (existing.ready) return;
    return existing.readyPromise;
  }

  // Load private fields explicitly — they're select:false by default.
  const camera = await Camera.findById(cameraId).select(
    "+nvrUsername +nvrPassword +rtspUsername +rtspPassword +streamUrl"
  );

  if (!camera) {
    throw new Error("CAMERA_NOT_FOUND");
  }
  if (camera.isDeleted) {
    throw new Error("CAMERA_DELETED");
  }
  if (!camera.isEnabled) {
    throw new Error("CAMERA_DISABLED");
  }

  const rtspUrl = buildRtspUrl(camera);

  const dir = path.join(HLS_ROOT, String(cameraId));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const playlistPath = path.join(dir, "index.m3u8");

  // -rtsp_transport tcp: more reliable than UDP through NAT/firewalls.
  // -fflags nobuffer / -flags low_delay: reduce latency.
  // HLS flags: short segments, small rolling window, delete old segments.
  const args = [
    "-rtsp_transport", "tcp",
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-i", rtspUrl,
    "-c:v", "copy",          // try passthrough first; see note below
    "-c:a", "aac",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "6",
    "-hls_flags", "delete_segments+omit_endlist",
    "-hls_segment_filename", path.join(dir, "seg_%03d.ts"),
    playlistPath,
  ];

  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

  let resolveReady, rejectReady;
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const entry = {
    process: ffmpeg,
    dir,
    startedAt: Date.now(),
    lastAccessedAt: Date.now(),
    ready: false,
    readyPromise,
  };
  activeStreams.set(cameraId, entry);

  // ffmpeg logs go to stderr by default. Redact anything that might
  // contain the RTSP URL before logging.
  const redact = (chunk) =>
    chunk.toString().replace(/rtsp:\/\/[^\s]+/gi, "rtsp://[redacted]");

  ffmpeg.stderr.on("data", (chunk) => {
    // Uncomment for debugging; kept quiet by default to avoid noisy logs.
    // console.log(`[ffmpeg ${cameraId}]`, redact(chunk));
  });

  ffmpeg.on("error", (err) => {
    activeStreams.delete(cameraId);
    rejectReady(new Error("Failed to start ffmpeg process"));
  });

  ffmpeg.on("exit", (code) => {
    if (activeStreams.get(cameraId)?.process === ffmpeg) {
      activeStreams.delete(cameraId);
    }
    if (!entry.ready) {
      rejectReady(new Error(`ffmpeg exited before producing output (code ${code})`));
    }
  });

  // Poll for the playlist file rather than parsing ffmpeg stdout —
  // simpler and format-agnostic.
  const pollStart = Date.now();
  const POLL_TIMEOUT_MS = 15000;
  const poll = setInterval(() => {
    if (fs.existsSync(playlistPath)) {
      clearInterval(poll);
      entry.ready = true;
      resolveReady();
    } else if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
      clearInterval(poll);
      if (!entry.ready) {
        ffmpeg.kill("SIGKILL");
        activeStreams.delete(cameraId);
        rejectReady(new Error("Timed out waiting for stream to start"));
      }
    }
  }, 300);

  return readyPromise;
}

/**
 * Serves a specific HLS file (playlist or segment) for a camera,
 * guarding against path traversal via the :file param.
 * Returns the absolute file path to send, or null if invalid/not found.
 */
function resolveSegmentPath(cameraId, file) {
  // Only allow expected filename shapes.
  const isValidName = /^(index\.m3u8|seg_\d{3}\.ts)$/.test(file);
  if (!isValidName) return null;

  const entry = activeStreams.get(cameraId);
  if (!entry) return null;

  const filePath = path.join(entry.dir, file);
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(entry.dir);

  // Defense in depth: even though the regex above should prevent it,
  // never serve a path that escapes the camera's own HLS directory.
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    return null;
  }
  if (!fs.existsSync(resolved)) return null;

  entry.lastAccessedAt = Date.now();
  return resolved;
}

function stopStream(cameraId) {
  const entry = activeStreams.get(cameraId);
  if (!entry) return;
  entry.process.kill("SIGTERM");
  activeStreams.delete(cameraId);
  fs.rmSync(entry.dir, { recursive: true, force: true });
}

function isStreamActive(cameraId) {
  return activeStreams.has(cameraId);
}

// Periodically kill streams nobody has requested segments from recently.
setInterval(() => {
  const now = Date.now();
  for (const [cameraId, entry] of activeStreams.entries()) {
    if (now - entry.lastAccessedAt > IDLE_TIMEOUT_MS) {
      stopStream(cameraId);
    }
  }
}, SWEEP_INTERVAL_MS).unref();

// Best-effort cleanup on process exit so we don't leave orphaned ffmpeg
// processes if the Node process is killed.
function stopAllStreams() {
  for (const cameraId of activeStreams.keys()) {
    stopStream(cameraId);
  }
}
process.on("SIGINT", stopAllStreams);
process.on("SIGTERM", stopAllStreams);

module.exports = {
  startStream,
  resolveSegmentPath,
  stopStream,
  isStreamActive,
};
