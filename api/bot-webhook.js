// api/bot-webhook.js
import fetch from "node-fetch";
import geoip from "geoip-lite";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import bot from "./lib/bot.js"; // нужен для отправки сообщения продавцу

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const VPNAPI_KEY = process.env.VPNAPI_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// утилиты
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeIp(raw) {
  if (!raw) return "неизвестно";
  const first = raw.split(",")[0].trim();
  if (first.includes("::ffff:")) return first.split("::ffff:").pop();
  return first;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    // токен из заголовка
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(403).json({ status: "error", message: "Token required" });
    }
    const token = auth.split(" ")[1];

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.error("JWT verify error:", e);
      return res.status(403).json({ status: "error", message: "Invalid or expired token" });
    }

    const telegramId = payload?.tid;
    if (!telegramId) {
      return res.status(400).json({ status: "error", message: "telegramId not in token" });
    }

    const body = await parseJson(req);
    const { browser, os, language, screen, timezone } = body || {};

    // достаём из базы
    const { data: tgData, error } = await supabase
      .from("users")
      .select("telegram_id, first_name, last_name, username")
      .eq("telegram_id", String(telegramId))
      .single();

    if (error || !tgData) {
      console.error("Supabase: telegramId not found", error);
      return res.status(400).json({ status: "error", message: "Telegram ID не найден" });
    }

    // IP и гео
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = normalizeIp(ipHeader || (req.socket && req.socket.remoteAddress) || "");
    const geo = geoip.lookup(ip) || {};
    const country = geo.country || "неизвестно";
    const region = geo.region || "неизвестно";
    const city = geo.city || "неизвестно";

    // VPNAPI
    let isp = "неизвестно";
    let vpnWarning = "";
    if (VPNAPI_KEY && ip && ip !== "неизвестно") {
      try {
        const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`, { timeout: 10000 });
        const vpnData = await vpnResp.json();
        isp = vpnData.network?.autonomous_system_organization || isp;
        const { vpn, proxy, tor } = vpnData.security || {};
        if (vpn) vpnWarning = "⚠ Использует VPN";
        else if (proxy) vpnWarning = "⚠ Использует Proxy";
        else if (tor) vpnWarning = "⚠ Использует Tor";
      } catch (e) {
        console.error("VPNAPI error:", e);
      }
    }

    // сообщение для продавца
    const messageHtml = `
<b>👤 Telegram:</b> ${escapeHtml(tgData?.first_name || "")} ${escapeHtml(tgData?.last_name || "")} (@${escapeHtml(tgData?.username || "нет")})
<b>🆔 ID:</b> ${escapeHtml(String(telegramId))}

<b>🌍 IP:</b> ${escapeHtml(ip)}
<b>📌 Страна:</b> ${escapeHtml(country)}
<b>🏙 Регион:</b> ${escapeHtml(region)}
<b>🏘 Город:</b> ${escapeHtml(city)}
<b>🏢 Провайдер:</b> ${escapeHtml(isp)}

${vpnWarning ? `<b>${escapeHtml(vpnWarning)}</b>\n` : ""}
<b>💻 ОС:</b> ${escapeHtml(os || "неизвестно")}
<b>🌐 Язык:</b> ${escapeHtml(language || "неизвестно")}
<b>⏰ Часовой пояс:</b> ${escapeHtml(timezone || "неизвестно")}
`;

    if (SELLER_CHAT_ID) {
      try {
        await bot.telegram.sendMessage(SELLER_CHAT_ID, messageHtml, { parse_mode: "HTML" });
      } catch (e) {
        console.warn("notify seller error:", e);
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("bot-webhook handler error:", err);
    return res.status(500).json({ status: "error", message: "internal error" });
  }
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
