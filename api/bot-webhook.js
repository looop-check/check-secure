// api/bot-webhook.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { generateInvite } from "./lib/bot.js";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
    const body = req.body && Object.keys(req.body).length
      ? req.body
      : await new Promise((resolve, reject) => {
          let d = "";
          req.on("data", c => d += c.toString());
          req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch(e) { reject(e); } });
          req.on("error", reject);
        });

    const { token, os, language, timezone } = body;
    if (!token) return res.status(400).json({ status: "error", message: "Token required" });

    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch(e) {
      return res.status(403).json({ status: "error", message: "Invalid or expired token" });
    }
    const telegramId = payload.tid;

    const { data: tgData } = await supabase.from("users")
      .select("telegram_id, first_name, last_name, username")
      .eq("telegram_id", String(telegramId))
      .single();

    const ipHeader = req.headers["x-forwarded-for"];
    const ip = normalizeIp(ipHeader || req.socket.remoteAddress);

    let country = "неизвестно";
    let countryCode = "XX";
    let region = "неизвестно";
    let city = "неизвестно";
    let isp = "неизвестно";
    let vpnDetected = {};

    if (VPNAPI_KEY && ip && ip !== "неизвестно") {
      try {
        const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`, { timeout: 10000 });
        const vpnData = await vpnResp.json();

        country = vpnData.location?.country || country;
        countryCode = vpnData.location?.country_code || countryCode;
        region = vpnData.location?.region || region;
        city = vpnData.location?.city || city;
        isp = vpnData.network?.autonomous_system_organization || isp;
        vpnDetected = vpnData.security || {};
      } catch(e) {
        console.error("VPNAPI error:", e);
      }
    }

    let vpnWarning = "";
    if (vpnDetected.vpn) vpnWarning = "VPN";
    else if (vpnDetected.proxy) vpnWarning = "Proxy";
    else if (vpnDetected.tor) vpnWarning = "Tor";

    // сообщение продавцу
    const messageHtml = `
<b>👤 Telegram:</b> ${escapeHtml(tgData.first_name)} ${escapeHtml(tgData.last_name)} (@${escapeHtml(tgData.username)})
<b>🆔 ID:</b> ${escapeHtml(String(telegramId))}

<b>🌍 IP:</b> ${escapeHtml(ip)}
<b>📌 Страна:</b> ${escapeHtml(country)}
<b>🏙 Регион:</b> ${escapeHtml(region)}
<b>🏘 Город:</b> ${escapeHtml(city)}
<b>🏢 Провайдер:</b> ${escapeHtml(isp)}
${vpnWarning ? `⚠ Использует <b>${vpnWarning}</b>` : ""}

<b>💻 ОС:</b> ${escapeHtml(os || "неизвестно")}
<b>🌐 Язык:</b> ${escapeHtml(language || "неизвестно")}
<b>⏰ Часовой пояс:</b> ${escapeHtml(timezone || "неизвестно")}
`;

    if (SELLER_CHAT_ID) {
      try {
        await (await import("./lib/bot.js")).default.telegram.sendMessage(SELLER_CHAT_ID, messageHtml, { parse_mode: "HTML" });
      } catch(e) {
        console.warn("notify seller error:", e);
      }
    }

// если VPN или страна не RU → отказ
  if (vpnWarning || (countryCode || "").toUpperCase() !== "RU") {
    // Отправляем уведомление пользователю в Telegram (если нужно)
    try {
      const botModule = await import("./lib/bot.js");
      await botModule.default.telegram.sendMessage(
        telegramId,
        vpnWarning 
          ? `⚠ Проверка не пройдена: обнаружен ${vpnWarning}` 
          : "⚠ Проверка не пройдена: доступ разрешён только для пользователей из России."
      );
    } catch(e) {
      console.error("notify user error:", e);
    } 

  return res.status(200).json({ status: "denied" });
}


  const inviteLink = await generateInvite(telegramId, 20);

// возвращаем редирект
  return res.status(200).json({
    status: "ok",
    inviteLink
  });

  } catch(err) {
    console.error("bot-webhook error:", err);
    return res.status(500).json({ status: "error", message: "internal error" });
  }
}