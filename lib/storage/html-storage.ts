import { ref, uploadString, getDownloadURL, getBytes } from "firebase/storage";
import { getFirebaseStorage } from "@lib/firebase/client";

const HTML_CONTENT_TYPE = "text/html; charset=utf-8";

export async function uploadHtml(path: string, html: string): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error("Firebase Storage is not configured");
  const objectRef = ref(storage, path);
  await uploadString(objectRef, html, "raw", { contentType: HTML_CONTENT_TYPE });
  return path;
}

export async function downloadHtml(path: string): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error("Firebase Storage is not configured");
  const objectRef = ref(storage, path);
  const bytes = await getBytes(objectRef);
  return new TextDecoder("utf-8").decode(bytes);
}

export async function getHtmlDownloadUrl(path: string): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error("Firebase Storage is not configured");
  return getDownloadURL(ref(storage, path));
}

export function sessionHtmlPath(userId: string, sessionId: string): string {
  return `mockups/${userId}/${sessionId}/active.html`;
}

export function reviewHtmlPath(reviewId: string): string {
  return `reviews/${reviewId}/active.html`;
}

export function shareHtmlPath(shareId: string): string {
  return `shares/${shareId}/active.html`;
}

/** Inline HTML in Firestore when under this size; otherwise use Storage. */
export const INLINE_HTML_MAX_BYTES = 400_000;

export function shouldStoreHtmlInStorage(html: string): boolean {
  return new TextEncoder().encode(html).length > INLINE_HTML_MAX_BYTES;
}
