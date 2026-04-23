import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

/**
 * File-storage abstraction.
 *
 * On Vercel (or anywhere BLOB_READ_WRITE_TOKEN is set) we persist artifacts in
 * Vercel Blob and return public HTTPS URLs. In local dev without a Blob token,
 * we fall back to writing into `public/<pathname>` and returning site-relative
 * URLs — so `npm run dev` keeps working without any external setup.
 *
 * The abstraction hides these two modes behind a single put/fetch interface so
 * the rest of the server code never branches on "am I on Vercel?".
 */

export type StoredFile = {
  /** Public URL usable from the browser (Blob CDN URL or /pathname). */
  url: string;
  /** Logical path, e.g. "uploads/abc.mp4" — used as the Blob key. */
  pathname: string;
};

export const hasBlobStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function putBuffer(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<StoredFile> {
  const cleanPath = pathname.replace(/^\/+/, "");
  if (hasBlobStore()) {
    const blob = await put(cleanPath, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24
    });
    return { url: blob.url, pathname: cleanPath };
  }

  // Local dev fallback: write under public/ so Next serves it statically.
  const abs = path.join(process.cwd(), "public", cleanPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body);
  return { url: `/${cleanPath}`, pathname: cleanPath };
}

/**
 * Resolve any of (a) a site-relative /pathname, (b) an absolute https URL,
 * or (c) an absolute file path into a readable local file path.
 *
 * Site-relative URLs map directly to the `public/` folder. External URLs are
 * streamed into the OS tmpdir so ffmpeg/ffprobe can read them as regular
 * files. Callers are responsible for cleanup of returned tmp files.
 */
export async function fetchToTmp(url: string, suffix = ""): Promise<string> {
  if (url.startsWith("/")) {
    return path.join(process.cwd(), "public", url.replace(/^\//, ""));
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return url; // already an absolute fs path
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not fetch ${url} (${res.status}).`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const os = await import("node:os");
  const crypto = await import("node:crypto");
  const tmpPath = path.join(
    os.tmpdir(),
    `evva-${crypto.randomUUID()}${suffix}`
  );
  await writeFile(tmpPath, buffer);
  return tmpPath;
}
