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

export const uploadVideoFile = async (payload: {
  file: File;
  durationSec?: number;
}): Promise<VideoUploadResponse> => {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.durationSec && Number.isFinite(payload.durationSec)) {
    formData.append("durationSec", String(payload.durationSec));
  }

  const response = await fetch("/api/v1/videos/upload", {
    method: "POST",
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Upload failed"
    );
  }
  return data as VideoUploadResponse;
};

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
