#!/usr/bin/env node
/**
 * build_schedule.mjs
 * - Downloads a Google Calendar ICS (or reads local file) and generates data/schedule.json
 * - No external dependencies
 *
 * Event title format:
 *   {1:Y}エンドフィールド #4
 *   {2:T}参加型ゲーム
 * Where:
 *   1 -> member id (maps to person)
 *   Y -> YouTube, T -> Twitch
 * After "}" -> title shown on the site
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const OUT_JSON = path.resolve("data/schedule.json");

const MEMBERS = {
  "1": {
    name: "もにぃ",
    avatar: "images/monii.png",
    youtube: "https://www.youtube.com/channel/UCU_nJbpHRZyZKtH7DO170MQ",
    twitch: "https://www.twitch.tv/monii_friends"
  },
  "2": {
    name: "仁成ウツメ",
    avatar: "images/utsume.png",
    youtube: "https://www.youtube.com/channel/UCs3VAhs3IFq8czVg2OGVQtg",
    twitch: ""
  }
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(u, { headers: { "User-Agent": "lunariafactory-schedule-bot/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(fetchText(next));
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      res.setEncoding("utf8");
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
  });
}

function unfoldIcs(text) {
  // RFC5545 line folding: lines that start with space or tab are continuation
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

function parseDateValue(raw, tzid) {
  // raw examples:
  //  - 20260212T210000
  //  - 20260212T120000Z
  //  - 20260212 (all-day)
  const mAllDay = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (mAllDay) return null; // skip all-day for streaming schedule

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(raw);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  const isUtc = !!m[7];

  if (isUtc) return new Date(Date.UTC(y, mo - 1, d, hh, mm, ss));

  // If TZID is provided, assume it's that time zone; for now we mainly expect Asia/Tokyo.
  // Node's Date doesn't accept arbitrary TZ without libs, so:
  // - If TZID is Asia/Tokyo (or missing), treat raw as JST and convert to UTC by subtracting 9 hours.
  const assumeJst = !tzid || tzid === "Asia/Tokyo";
  if (assumeJst) return new Date(Date.UTC(y, mo - 1, d, hh - 9, mm, ss));

  // Fallback: treat as local time in UTC (best-effort)
  return new Date(Date.UTC(y, mo - 1, d, hh, mm, ss));
}

function formatJstParts(date) {
  const dtfDate = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const dtfTime = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const partsDate = dtfDate.formatToParts(date);
  const partsTime = dtfTime.formatToParts(date);

  const get = (parts, type) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get(partsDate, "year");
  const mo = get(partsDate, "month");
  const d = get(partsDate, "day");
  const w = get(partsDate, "weekday");

  return {
    dateText: `${y}/${mo}/${d}（${w}）`,
    timeText: `${get(partsTime, "hour")}:${get(partsTime, "minute")}`
  };
}

function parseTitle(summary) {
  // {1:Y}エンドフィールド #4
  const m = /^\{(\d+):([A-Za-z])\}(.*)$/.exec(summary.trim());
  if (!m) return { memberId: "", platform: "", title: summary.trim() };

  const memberId = m[1];
  const platform = m[2].toUpperCase();
  const title = m[3].trim() || "配信";
  return { memberId, platform, title };
}

function pickLink(memberId, platform, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  const m = MEMBERS[memberId];
  if (!m) return "";
  if (platform === "T") return m.twitch || "";
  return m.youtube || "";
}

function parseIcs(icsText) {
  const lines = unfoldIcs(icsText);
  const events = [];
  let cur = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { raw: {} };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;

    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);

    // left can be like "DTSTART;TZID=Asia/Tokyo"
    const [name, ...paramsArr] = left.split(";");
    const params = {};
    for (const p of paramsArr) {
      const [k, v] = p.split("=");
      if (k && v) params[k.toUpperCase()] = v;
    }

    const key = name.toUpperCase();
    cur.raw[key] = { value, params };
  }

  return events;
}

function toScheduleJson(icsText) {
  const now = new Date();
  const parsed = parseIcs(icsText);

  const items = [];
  for (const e of parsed) {
    const summary = e.raw["SUMMARY"]?.value ?? "";
    if (!summary) continue;

    const { memberId, platform, title } = parseTitle(summary);

    const tzStart = e.raw["DTSTART"]?.params?.TZID || "";
    const tzEnd = e.raw["DTEND"]?.params?.TZID || "";
    const start = parseDateValue(e.raw["DTSTART"]?.value ?? "", tzStart);
    if (!start) continue;

    // optional link from event URL or location
    const explicitUrl = e.raw["URL"]?.value || e.raw["LOCATION"]?.value || "";

    // skip past events (allow 2 minutes grace)
    if (start.getTime() < now.getTime() - 2 * 60 * 1000) continue;

    const { dateText, timeText } = formatJstParts(start);

    const who = MEMBERS[memberId] ? {
      id: memberId,
      name: MEMBERS[memberId].name,
      avatar: MEMBERS[memberId].avatar
    } : { id: memberId || "0", name: "Lunaria Factory", avatar: "images/sample2.png" };

    const link = pickLink(memberId, platform, explicitUrl);

    items.push({
      startUtc: start.toISOString(),
      dateText,
      timeText,
      title,
      memberId: who.id,
      platform: platform || "Y",
      link,
      who
    });
  }

  items.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  // keep next 30 items max
  const events = items.slice(0, 30);
  const next = events.length ? events[0] : null;

  return {
    generatedAtUtc: new Date().toISOString(),
    next,
    events
  };
}

async function main() {
  const icsUrl = process.env.CALENDAR_ICS_URL || "";
  const icsFile = process.env.CALENDAR_ICS_FILE || "";

  if (!icsUrl && !icsFile) {
    console.error("ERROR: CALENDAR_ICS_URL or CALENDAR_ICS_FILE is required.");
    process.exit(2);
  }

  let icsText = "";
  if (icsFile) {
    icsText = fs.readFileSync(icsFile, "utf8");
  } else {
    icsText = await fetchText(icsUrl);
  }

  const json = toScheduleJson(icsText);
  ensureDir(path.dirname(OUT_JSON));
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2), "utf8");
  console.log(`Wrote ${OUT_JSON} (events=${json.events.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
