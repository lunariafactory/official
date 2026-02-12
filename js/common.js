// js/common.js
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export async function fetchJson(url, { noStore = true } = {}) {
  const res = await fetch(url, { cache: noStore ? "no-store" : "default" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
  return await res.json();
}

export function resolveMemberLink(member, platform) {
  if (!member) return "";
  const p = String(platform || "").toUpperCase();

  if (p === "Y") return String(member.youtube ?? "").trim();
  if (p === "T") return String(member.twitch ?? "").trim();
  if (p === "X") return String(member.X ?? "").trim();

  // どうしても見つからない人（4番みたいに link だけのケース）救済
  return String(member.link ?? "").trim();
}

export function platformLabel(p) {
  const x = String(p || "").toUpperCase();
  if (x === "T") return "Twitch";
  if (x === "X") return "X";
  return "YouTube";
}

export function platformIconSvg(p) {
  const x = String(p || "").toUpperCase();
  if (x === "T") {
    return `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h18v11l-5 5h-4l-2 2H8v-2H5V6L4 3Zm3 3v10h3v2l2-2h5l3-3V6H7Zm9 2h2v5h-2V8Zm-5 0h2v5h-2V8Z" fill="#7b3cff"/>
      </svg>`;
  }
  if (x === "X") {
    return `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.7 3H21l-6.6 7.5L22 21h-6.2l-4.9-6.4L5.3 21H3l7.1-8.1L2 3h6.3l4.4 5.8L18.7 3Zm-1.1 16h1.3L7.2 4.9H5.8l11.8 14.1Z" fill="#111"/>
      </svg>`;
  }
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31.7 31.7 0 0 0 2 12a31.7 31.7 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 22 12a31.7 31.7 0 0 0-.4-4.8Z" fill="#ff2e2e"/>
      <path d="M10.2 15.3V8.7L15.8 12l-5.6 3.3Z" fill="#fff"/>
    </svg>`;
}
