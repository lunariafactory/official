// js/streamers.js
import { fetchJson } from "./common.js";

const MEMBERS_URL = "data/members.json";

function setSocialLink(root, code, url) {
  const a = root.querySelector(`a[data-social="${code}"]`);
  if (!a) return;

  const u = String(url ?? "").trim();
  if (u) {
    a.href = u;
    a.style.display = "";
    a.style.pointerEvents = "";
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  } else {
    a.removeAttribute("href");
    a.style.pointerEvents = "none";
    a.style.display = "none";
  }
}

async function main() {
  const members = await fetchJson(MEMBERS_URL, { noStore: true });

  const rows = document.querySelectorAll(".row[data-member]");
  for (const row of rows) {
    const id = String(row.getAttribute("data-member") ?? "");
    const m = members?.[id];
    if (!m) continue;

    const nameEl = row.querySelector(".name");
    if (nameEl) nameEl.textContent = m.name ?? "";

    const img = row.querySelector(".avatar img");
    if (img) {
      img.src = m.avatar ?? img.src;
      img.alt = m.name ?? img.alt;
    }

    setSocialLink(row, "Y", m.youtube);
    setSocialLink(row, "T", m.twitch);
    setSocialLink(row, "X", m.X);
  }
}

main().catch(() => {
  // 読み込み失敗してもページは崩さない（静かに）
});
