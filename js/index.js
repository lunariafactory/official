// js/index.js
import {
  esc, fetchJson,
  resolveMemberLink, platformLabel, platformIconSvg
} from "./common.js";

const SCHEDULE_URL = "https://lunaria-schedule.lunariafactory.workers.dev/data/schedule.json";
const MEMBERS_URL = "data/members.json";

// index.htmlのPICK UP（4人分）を members.json から埋める
async function applyPickupMembers(members) {
  const map = [
    { id: "1", root: document.querySelector('[data-pickup="1"]') },
    { id: "2", root: document.querySelector('[data-pickup="2"]') },
    { id: "3", root: document.querySelector('[data-pickup="3"]') },
    { id: "4", root: document.querySelector('[data-pickup="4"]') }
  ];

  for (const item of map) {
    const root = item.root;
    if (!root) continue;

    const m = members?.[item.id];
    if (!m) continue;

    // name
    const nameEl = root.querySelector(".name");
    if (nameEl) nameEl.textContent = m.name ?? "";

    // avatar
    const img = root.querySelector(".thumb img");
    if (img) {
      img.src = m.avatar ?? img.src;
      img.alt = m.name ?? img.alt;
    }

    // links (URLが無い場合は「消さずに非表示」にする)
    setSocialLink(root, "Y", String(m.youtube ?? "").trim());
    setSocialLink(root, "T", String(m.twitch ?? "").trim());
    setSocialLink(root, "X", String(m.X ?? "").trim());
  }
}

function setSocialLink(root, code, url) {
  const a = root.querySelector(`a[data-social="${code}"]`);
  if (!a) return;

  if (url) {
    a.href = url;
    a.style.display = "";
    a.style.pointerEvents = "";
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  } else {
    // href空のままだとクリックで変な挙動することがあるので確実に無効化
    a.removeAttribute("href");
    a.style.pointerEvents = "none";
    a.style.display = "none";
  }
}

function pickNextUpcoming(events) {
  const now = Date.now();
  for (const e of events) {
    const t = Date.parse(e.startUtc ?? "");
    if (!Number.isNaN(t) && t >= now) return e;
  }
  return null;
}

async function loadScheduleAndRender(members) {
  const sub = document.getElementById("scheduleSub");
  const box = document.getElementById("scheduleItems");

  try {
    const data = await fetchJson(SCHEDULE_URL, { noStore: true });
    const events = Array.isArray(data?.events) ? data.events : [];

    if (events.length === 0) {
      sub.textContent = "配信予定はありません";
      box.innerHTML =
        '<div class="item"><div class="plus">＋</div><div class="itemText">配信予定はありません</div></div>';
      return;
    }

    const next = pickNextUpcoming(events);
    if (!next) {
      sub.textContent = "本日の配信はありません";
      box.innerHTML =
        '<div class="item"><div class="plus">＋</div><div class="itemText">本日の配信はありません</div></div>';
      return;
    }

    const memberId = String(next.memberId ?? "");
    const platform = String(next.platform ?? "Y").toUpperCase();
    const member = members?.[memberId] ?? null;

    const whoName = member?.name ?? "Lunaria Factory";
    const avatar = member?.avatar ?? "images/sample2.png";
    const link = resolveMemberLink(member, platform);

    sub.textContent = "次の配信";

    const left = `
      <div class="lfWhen">
        <div class="lfDate">${esc(next.dateText ?? "予定")}</div>
        <div class="lfTime">${esc(next.timeText ?? "--:--")}</div>
      </div>`;

    const main = `
      <div class="lfMain">
        <img class="lfAvatar" src="${esc(avatar)}" alt="${esc(whoName)}">
        <div class="lfText">
          <div class="lfName">${esc(whoName)}</div>
          <div class="lfTitle">${esc(next.title ?? "配信")}（${esc(platformLabel(platform))}）</div>
        </div>
      </div>`;

    const right = link
      ? `<div class="lfLink">
           <span class="iconBtn" aria-label="${esc(platformLabel(platform))}">
             ${platformIconSvg(platform)}
           </span>
         </div>`
      : `<div class="lfLink"></div>`;

    const card = `<div class="lfNext">${left}${main}${right}</div>`;

    box.innerHTML = link
      ? `<a class="lfTap" href="${esc(link)}" aria-label="配信を開く" target="_blank" rel="noopener noreferrer">${card}</a>`
      : card;

  } catch (e) {
    sub.textContent = "配信予定を読み込めませんでした";
    box.innerHTML =
      '<div class="item"><div class="plus">＋</div><div class="itemText">配信予定を読み込めませんでした</div></div>';
  }
}

async function main() {
  const members = await fetchJson(MEMBERS_URL, { noStore: true });
  await applyPickupMembers(members);
  await loadScheduleAndRender(members);
}

main();
