import type {
  CompositionResponse,
  ConfigResponse,
  RenderResponse,
  VideoUploadResponse
} from "@/contracts/api";
import type { Direction, MixSettings } from "@/domain/contracts";

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Request failed"
    );
  }
  return data as T;
};

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Request failed"
    );
  }
  return data as T;
};

export const fetchConfig = () => getJson<ConfigResponse>("/api/v1/config");

/**
 * Upload entry point. Automatically picks the right transport:
 *
 *  - `direct`   → Browser uploads straight to Vercel Blob using a
 *                 one-time token (required on Vercel for any reel bigger
 *                 than the serverless body cap). Then we register the
 *                 resulting URL server-side.
 *  - `multipart` → Browser POSTs FormData to our own API route, which
 *                  persists bytes via the storage abstraction. Used in
 *                  local dev and when Blob is not configured.
 */
export const uploadVideoFile = async (payload: {
  file: File;
  durationSec?: number;
  width?: number;
  height?: number;
  uploadMode?: "direct" | "multipart";
}): Promise<VideoUploadResponse> => {
  const mode = payload.uploadMode ?? (await detectUploadMode());
  return mode === "direct"
    ? uploadDirect(payload)
    : uploadMultipart(payload);
};

let _cachedUploadMode: "direct" | "multipart" | null = null;
async function detectUploadMode(): Promise<"direct" | "multipart"> {
  if (_cachedUploadMode) return _cachedUploadMode;
  try {
    const cfg = await fetchConfig();
    _cachedUploadMode = cfg.upload.mode;
    return _cachedUploadMode;
  } catch {
    _cachedUploadMode = "multipart";
    return "multipart";
  }
}

async function uploadMultipart(payload: {
  file: File;
  durationSec?: number;
  width?: number;
  height?: number;
}): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.durationSec && Number.isFinite(payload.durationSec)) {
    formData.append("durationSec", String(payload.durationSec));
  }
  if (payload.width && Number.isFinite(payload.width)) {
    formData.append("width", String(Math.round(payload.width)));
  }
  if (payload.height && Number.isFinite(payload.height)) {
    formData.append("height", String(Math.round(payload.height)));
  }

  const response = await fetch("/api/v1/videos/upload", {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(await describeFailure(response, "Multipart upload"));
  }
  return (await response.json()) as VideoUploadResponse;
}

async function uploadDirect(payload: {
  file: File;
  durationSec?: number;
  width?: number;
  height?: number;
}): Promise<VideoUploadResponse> {
  // Import the Blob client lazily so it doesn't ship to users running in
  // multipart mode. The client talks to our /upload-token route to get a
  // short-lived token, then PUTs bytes directly to Vercel Blob.
  const { upload } = await import("@vercel/blob/client");

  const safeName = payload.file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  const pathname = `uploads/${Date.now()}-${safeName}`;

  const blob = await upload(pathname, payload.file, {
    access: "public",
    handleUploadUrl: "/api/v1/videos/upload-token",
    contentType: payload.file.type || "video/mp4"
  });

  const response = await fetch("/api/v1/videos/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: blob.url,
      pathname: blob.pathname,
      filename: payload.file.name || pathname,
      mimeType: payload.file.type || "video/mp4",
      sizeBytes: payload.file.size,
      durationSec: payload.durationSec,
      width: payload.width,
      height: payload.height
    })
  });
  if (!response.ok) {
    throw new Error(await describeFailure(response, "Register"));
  }
  return (await response.json()) as VideoUploadResponse;
}

/**
 * Build a user-actionable error message from a failed Response. Tries JSON
 * first (our routes return `{ error }`), then falls back to text + status
 * so the real cause (413 request-too-large, HTML error page, etc.) is
 * visible in the UI instead of a useless "Upload failed".
 */
async function describeFailure(response: Response, label: string): Promise<string> {
  const status = `${response.status} ${response.statusText || ""}`.trim();
  const raw = await response.text().catch(() => "");
  if (raw) {
    try {
      const data = JSON.parse(raw);
      const msg =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.message === "string"
            ? data.message
            : null;
      if (msg) return `${label} failed (${status}): ${msg}`;
    } catch {
      // not JSON — probably an HTML error page from a platform edge.
    }
    const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, 300);
    return `${label} failed (${status}): ${trimmed || "no response body"}`;
  }
  return `${label} failed (${status}).`;
}

export const createComposition = (payload: {
  videoAssetId: `vid_${string}`;
  direction?: Direction;
  candidateCount?: number;
}) => postJson<CompositionResponse>("/api/v1/compositions", payload);

export const getComposition = (compositionId: `cmp_${string}`) =>
  getJson<CompositionResponse>(`/api/v1/compositions/${compositionId}`);

export const selectCandidate = (payload: {
  compositionId: `cmp_${string}`;
  candidateId: `gsc_${string}`;
}) =>
  postJson<CompositionResponse>(
    `/api/v1/compositions/${payload.compositionId}/select`,
    { candidateId: payload.candidateId }
  );

export const createRender = (payload: {
  compositionId: `cmp_${string}`;
  mix: MixSettings;
}) => postJson<RenderResponse>("/api/v1/renders", payload);

export const getRender = (renderJobId: `rnd_${string}`) =>
  getJson<RenderResponse>(`/api/v1/renders/${renderJobId}`);
