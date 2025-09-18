// api/bot-webhook.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import bot, { generateInvite } from "./lib/bot.js";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Утилита для экранирования HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = req.body && Object.keys(req.body).length ? req.body : await new Promise((resolve, reject) => {
      let d = "";
      req.on("data", c => d += c.toString());
      req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch(e) { reject(e); } });
      req.on("error", reject);
    });

    const { token, ip, country, region, city, isp, os, language, timezone, vpnDetected } = body;

    if (!token) return res.status(400).json({ status: "error", message: "Token required" });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch(e) {
      return res.status(403).json({ status: "error", message: "Invalid or expired token" });
    }

    const telegramId = payload.tid;
    if (!telegramId) return res.status(400).json({ status: "error", message: "telegramId not in token" });

    // Достаём данные пользователя
    const { data: tgData } = await supabase.from("users")
      .select("telegram_id, first_name, last_name, username")
      .eq("telegram_id", String(telegramId))
      .single();

    // Определяем одно конкретное предупреждение
    let vpnWarning = "";
    if (vpnDetected) {
      if (vpnDetected.vpn) vpnWarning = "⚠ Использует VPN";
      else if (vpnDetected.proxy) vpnWarning = "⚠ Использует Proxy";
      else if (vpnDetected.tor) vpnWarning = "⚠ Использует Tor";
    }

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

    // Если VPN/Proxy/Tor или страна запрещена — ссылки не даём
    if (vpnWarning || country !== "RU") {
      return res.status(200).json({ status: "denied" });
    }

    // Иначе генерируем одноразовую ссылку
    const inviteLink = await generateInvite(telegramId);

    return res.status(200).json({ status: "ok", inviteLink });

  } catch(err) {
    console.error("bot-webhook error:", err);
    return res.status(500).json({ status: "error", message: "internal error" });
  }
}
