import { timingSafeEqual } from "node:crypto";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isHostAllowed(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const [name, p] = host.split(":");
  return LOCAL_HOSTS.has(name ?? "") && p === String(port);
}

export function isOriginAllowed(origin: string | undefined, port: number): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname) && Boolean(url.port);
  } catch {
    return false;
  }
}

function tokenFromUrl(url: string): string | null {
  const q = url.indexOf("?");
  if (q === -1) return null;
  return new URLSearchParams(url.slice(q + 1)).get("token");
}

export function isRequestAuthorized(
  headers: { authorization?: string | undefined },
  url: string,
  token: string
): boolean {
  const path = url.split("?")[0] ?? url;
  if (path === "/health") return true;
  const header = headers.authorization;
  if (header && header.startsWith("Bearer ") && safeEqual(header.slice(7), token)) return true;
  const q = tokenFromUrl(url);
  return q !== null && safeEqual(q, token);
}
