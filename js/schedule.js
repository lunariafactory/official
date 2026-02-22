// js/schedule.js
import {
  esc, fetchJson,
  resolveMemberLink, platformLabel, platformIconSvg
} from "./common.js";

const SCHEDULE_URL = "https://lunaria-schedule.lunariafactory.workers.dev/data/schedule.json";
const MEMBERS_URL = "data/members.json";

function renderEmpty(msg, sub) {
  return `
    <div class="empty">
      ${esc(msg)}
      <div class="sub">${esc(sub)}</div>
    </div>`;
}

function renderRow(ev, members) {
  const date = ev.dateText ? ev.dateText : "";
  const time = ev.timeText ? ev.timeText : "";
  const topic = ev.title ? ev.title : "配信";

  const memberId = String(ev.memberId ?? "");
  const platform = String(ev.platform ?? "Y").toUpperCase();
  const member = members?.[memberId] ?? null;

  const whoName = member?.name ?? "Lunaria Factory";
  const avatar = member?.avatar ?? "images/sample2.png";
  const link = resolveMemberLink(member, platform);

  const linkBtn = link
    ? `<a class="iconBtn" href="${esc(link)}" target="_blank" rel="noopener noreferrer"
         aria-label="${esc(platformLabel(platform))}">
         ${platformIconSvg(platform)}
       </a>`
    : "";

  return `
    <div class="row">
      <div class="when">
        <div class="date">${esc(date)}</div>
        <div class="time">${esc(time)}</div>
      </div>

      <div class="info">
        <p class="topic">${esc(topic)}</p>
        <div class="who">
          <div class="avatar avatar--large"><img src="${esc(avatar)}" alt="${esc(whoName)}"></div>
          <div class="whoName">${esc(whoName)}</div>
        </div>
      </div>

      <div class="links">
        ${linkBtn}
      </div>
    </div>`;
}

async function loadList() {
  const root = document.getElementById("scheduleRows");

  try {
    const [members, data] = await Promise.all([
      fetchJson(MEMBERS_URL),
      fetchJson(SCHEDULE_URL)
    ]);

    const events = (data && Array.isArray(data.events)) ? data.events : [];

    if (!events.length) {
      root.innerHTML = renderEmpty("現在、公開されている配信予定はありません", "予定が決まり次第、ここに追加されます。");
      return;
    }

    root.innerHTML = events.map(ev => renderRow(ev, members)).join("");
  } catch (e) {
    root.innerHTML = renderEmpty("配信予定を読み込めませんでした", "しばらくしてから再読み込みしてね。");
  }
}

loadList();
