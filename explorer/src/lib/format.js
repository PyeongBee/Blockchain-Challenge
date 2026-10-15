import { formatEther, formatUnits } from "ethers";

export function shortHash(hash, head = 10, tail = 8) {
  if (!hash) return "";
  return hash.length <= head + tail + 2 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function eth(wei) {
  return `${trimDecimals(formatEther(wei ?? 0n))} ETH`;
}

export function gwei(wei) {
  if (wei == null) return "-";
  return `${trimDecimals(formatUnits(wei, "gwei"))} Gwei`;
}

export function tokenAmount(raw, decimals = 18, symbol = "") {
  const [int, frac] = trimDecimals(formatUnits(raw, decimals)).split(".");
  const value = BigInt(int).toLocaleString("en-US") + (frac ? `.${frac}` : "");
  return symbol ? `${value} ${symbol}` : value;
}

// "1.000000000000000000" → "1", "0.123400" → "0.1234"
function trimDecimals(s) {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export function num(n) {
  return n == null ? "-" : BigInt(n).toLocaleString("en-US");
}

export function timeAgo(unixSeconds) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSeconds));
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export function dateTime(unixSeconds) {
  return new Date(Number(unixSeconds) * 1000).toLocaleString("ko-KR");
}

export function percent(part, whole) {
  if (!whole) return "0%";
  return `${((Number(part) / Number(whole)) * 100).toFixed(2)}%`;
}

// 문자열로 그대로 보여줄 수 있게 BigInt/배열/Result를 풀어준다
export function stringify(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(stringify).join(", ")}]`;
  return String(value);
}
