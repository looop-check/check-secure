// api/bot-webhook.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import bot, { generateInvite } from "./lib/bot.js";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// HTML-экранирование
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Нормализация IP
function normalizeIp(raw) {
  if (!raw) return "неизвестно";
  const first = raw.split(",")[0].trim();
  if (first.includes("::ffff:")) return first.split("::ffff:").pop();
  return first;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    // Получаем тело запроса
    const body = req.body && Object.keys(req.body).length
      ? req.body
      : await new Promise((resolve, reject) => {
          let d = "";
          req.on("data", c => d += c.toString());
          req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch(e) { reject(e); } });
          req.on("error", reject);
        });

    const { token, browser, os, language, screen, timezone } = body;
    if (!token) return res.status(400).json({ status: "error", message: "Token required" });

    // Проверяем JWT
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch(e) {
      return res.status(403).json({ status: "error", message: "Invalid or expired token" });
    }
    const telegramId = payload.tid;
    if (!telegramId) return res.status(400).json({ status: "error", message: "telegramId not in token" });

    // Достаем данные пользователя из Supabase
    const { data: tgData } = await supabase.from("users")
      .select("telegram_id, first_name, last_name, username")
      .eq("telegram_id", String(telegramId))
      .single();

    // Получаем IP из заголовка или сокета
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = normalizeIp(ipHeader || req.socket.remoteAddress);

    // Инициализация переменных для гео и провайдера
    let country = "неизвестно";
    let countryCode = "XX";
    let region = "неизвестно";
    let city = "неизвестно";
    let isp = "неизвестно";
    let vpnDetected = {};

    // Запрос к VPNAPI
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

    // Определяем одно конкретное предупреждение
    let vpnWarning = "";
    if (vpnDetected.vpn) vpnWarning = "⚠ Использует VPN";
    else if (vpnDetected.proxy) vpnWarning = "⚠ Использует Proxy";
    else if (vpnDetected.tor) vpnWarning = "⚠ Использует Tor";

    // Формируем сообщение для продавца
    const messageHtml = `
<b>👤 Telegram:</b> ${escapeHtml(tgData.first_name)} ${escapeHtml(tgData.last_name)} (@${escapeHtml(tgData.username)})
<b>🆔 ID:</b> ${escapeHtml(String(telegramId))}

<b>🌍 IP:</b> ${escapeHtml(ip)}
<b>📌 Страна:</b> ${escapeHtml(country)}
<b>🏙 Регион:</b> ${escapeHtml(region)}
<b>🏘 Город:</b> ${escapeHtml(city)}
<b>🏢 Провайдер:</b> ${escapeHtml(isp)}
${vpnWarning ? `<b>${vpnWarning}</b>` : ""}

<b>💻 ОС:</b> ${escapeHtml(os || "неизвестно")}
<b>🌐 Язык:</b> ${escapeHtml(language || "неизвестно")}
<b>⏰ Часовой пояс:</b> ${escapeHtml(timezone || "неизвестно")}
`;

    // Отправка продавцу
    if (SELLER_CHAT_ID) {
      try { await bot.telegram.sendMessage(SELLER_CHAT_ID, messageHtml, { parse_mode: "HTML" }); }
      catch(e){ console.warn("notify seller error:", e); }
    }

    // Если VPN/Proxy/Tor или страна запрещена — ссылки не даем
    if (vpnWarning || countryCode !== "RU") return res.status(200).json({ status: "denied" });

    // Иначе генерируем одноразовую ссылку
    const inviteLink = await generateInvite(telegramId);

    return res.status(200).json({ status: "ok", inviteLink, ip, country, countryCode, region, city, isp, vpnDetected });

  } catch(err) {
    console.error("bot-webhook error:", err);
    return res.status(500).json({ status: "error", message: "internal error" });
  }
}
