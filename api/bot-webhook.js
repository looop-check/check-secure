import fetch from "node-fetch";
import geoip from "geoip-lite";
import { createClient } from "@supabase/supabase-js";
import bot from "./lib/bot.js"; // поправил путь: api -> lib

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// helper
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = await parseJson(req);
    const { telegramId, browser, os, language, screen, timezone } = body || {};

    if (!telegramId) {
      return res.status(400).json({ status: "error", message: "telegramId is required" });
    }

    // Получаем данные пользователя из Supabase
    const { data: tgData, error } = await supabase
      .from("users")
      .select("telegram_id, first_name, last_name, username")
      .eq("telegram_id", String(telegramId))
      .single();

    if (error || !tgData) {
      console.error("Supabase: telegramId not found", error);
      return res.status(400).json({ status: "error", message: "Telegram ID не найден" });
    }

    // IP (на Vercel в x-forwarded-for)
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = ipHeader ? ipHeader.split(",")[0].trim() : (req.socket && req.socket.remoteAddress) || "неизвестно";

    // geo
    const geo = geoip.lookup(ip) || {};
    const country = geo.country || "неизвестно";
    const region = geo.region || "неизвестно";
    const city = geo.city || "неизвестно";

    // VPN/ISP через vpnapi.io
    let isp = "неизвестно";
    let vpnWarning = "";
    if (VPNAPI_KEY && ip && ip !== "неизвестно") {
      try {
        const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`, { timeout: 10000 });
        const vpnData = await vpnResp.json();
        isp = vpnData.network?.autonomous_system_organization || isp;
        
        const { vpn, proxy, tor } = vpnData.security || {};

        if (vpn) vpnWarning = "⚠ VPN";
        else if (proxy) vpnWarning = "⚠ Proxy";
        else if (tor) vpnWarning = "⚠ Tor";

      } catch (e) {
        console.error("VPNAPI error:", e);
      }
    }

    // Формируем безопасный HTML (удобнее, чем Markdown для user-generated strings)
    const messageHtml = `
<b>🟢 Новый пользователь</b>

<b>👤 Telegram:</b> ${escapeHtml(tgData.first_name || "")} ${escapeHtml(tgData.last_name || "")} (@${escapeHtml(tgData.username || "нет")})
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

    // Отправляем продавцу
    await bot.telegram.sendMessage(SELLER_CHAT_ID, messageHtml, { parse_mode: "HTML" });

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
