export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Resolve WebSocket URL at runtime so localhost / 127.0.0.1 both work. */
function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  const base = apiOrigin();
  if (base.startsWith("https://")) {
    return `${base.replace("https://", "wss://")}/ws`;
  }
  if (base.startsWith("http://")) {
    return `${base.replace("http://", "ws://")}/ws`;
  }
  return "ws://127.0.0.1:8000/ws";
}
