// api/bot-webhook.js
import fetch from "node-fetch";
import geoip from "geoip-lite";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import bot from "./lib/bot.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID; // кому присылать детальную инфу
const VPNAPI_KEY = process.env.VPNAPI_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const CHANNEL_ID = process.env.CHANNEL_ID; // numeric '-100...' или @username
const INVITE_TTL_SECONDS = Number(process.env.INVITE_TTL_SECONDS || 60); // время жизни invite
const INVITE_MEMBER_LIMIT = Number(process.env.INVITE_MEMBER_LIMIT || 1); // одноразовая

if (!JWT_SECRET) throw new Error("JWT_SECRET not set");
if (!CHANNEL_ID) throw new Error("CHANNEL_ID not set");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeIp(raw) {
  if (!raw) return "неизвестно";
  const first = raw.split(",")[0].trim();
  if (first.includes("::ffff:")) return first.split("::ffff:").pop();
  return first;
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    // --- авторизация token ---
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(403).json({ status: "error", message: "Token required (Authorization: Bearer <token>)" });
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

    // тело с данными браузера
    const body = req.body && Object.keys(req.body).length ? req.body : await parseJson(req);
    const { browser, os, language, screen, timezone } = body || {};

    // Получаем данные пользователя из Supabase (опционально)
    let tgData = null;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("telegram_id, first_name, last_name, username")
        .eq("telegram_id", String(telegramId))
        .single();
      if (data) tgData = data;
      else console.warn("Supabase: user not found:", error);
    } catch (e) {
      console.warn("Supabase select error (non-fatal):", e);
    }

    // IP и гео
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = normalizeIp(ipHeader || (req.socket && req.socket.remoteAddress) || "");
    const geo = geoip.lookup(ip) || {};
    const country = geo.country || "неизвестно";
    const region = geo.region || "неизвестно";
    const city = geo.city || "неизвестно";

    // --- Ограничение по стране: пускаем только из России ---
    const allowedCountries = (process.env.ALLOWED_COUNTRIES || "RU").split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!geo || !geo.country || !allowedCountries.includes(geo.country)) {
      console.warn(`Access denied for IP=${ip}, geo=${JSON.stringify(geo)}`);
      return res.status(403).json({ status: "error", message: "Доступ разрешён только из России" });
    }

    // VPN/ISP инфо через VPNAPI (опционально)
    let isp = "неизвестно";
    let vpnWarning = "";
    if (VPNAPI_KEY && ip && ip !== "неизвестно") {
      try {
        const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`);
        const vpnData = await vpnResp.json();
        isp = vpnData.network?.autonomous_system_organization || isp;
        const { vpn, proxy, tor } = vpnData.security || {};
        if (vpn) vpnWarning = "⚠ Использует VPN";
        else if (proxy) vpnWarning = "⚠ Использует Proxy";
        else if (tor) vpnWarning = "⚠ Использует Tor";
      } catch (e) {
        console.warn("VPNAPI error (non-fatal):", e);
      }
    }

    // --- Если всё ок — создаём одноразовую invite ссылку и отправляем пользователю ---
    let inviteLink;
    try {
      const expireDate = Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS;
      // Telegraf: bot.telegram.createChatInviteLink(chatId, options)
      const invite = await bot.telegram.createChatInviteLink(CHANNEL_ID, {
        expire_date: expireDate,
        member_limit: INVITE_MEMBER_LIMIT,
        name: `verify-${telegramId}-${Date.now()}`
      });
      inviteLink = invite && (invite.invite_link || invite.link || invite.inviteLink) || null;
      if (!inviteLink) throw new Error("Invite link not returned");
    } catch (e) {
      console.error("createChatInviteLink error:", e);
      return res.status(500).json({
        status: "error",
        message: "Не удалось создать приглашение. Убедитесь, что бот — админ канала и имеет право создавать приглашения."
      });
    }

    // Отправляем invite пользователю (личное сообщение)
    try {
      const userMessage = `Верификация пройдена ✅\nНажмите на ссылку, чтобы присоединиться к каналу (ссылка будет активна ${INVITE_TTL_SECONDS}s):\n\n${inviteLink}`;
      await bot.telegram.sendMessage(String(telegramId), userMessage);
    } catch (e) {
      console.error("sendMessage to user error:", e);
      // не прерываем — всё равно уведомим продавца о попытке
      // но сообщим клиенту об ошибке
      return res.status(500).json({ status: "error", message: "Не удалось отправить приглашение пользователю" });
    }

    // Отправляем детальную информацию продавцу (опционально)
    try {
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
        await bot.telegram.sendMessage(SELLER_CHAT_ID, messageHtml, { parse_mode: "HTML" });
      }
    } catch (e) {
      console.warn("notify seller error (non-fatal):", e);
    }

    // (Опционально) логируем invite в Supabase
    try {
      await supabase.from("invites").insert([{
        telegram_id: String(telegramId),
        ip,
        country,
        region,
        city,
        isp,
        vpn_warning: vpnWarning || null,
        invite_link: inviteLink,
        invite_expires_at: new Date(Date.now() + INVITE_TTL_SECONDS * 1000).toISOString()
      }]);
    } catch (e) {
      // не критично
      console.warn("Supabase insert invite error (non-fatal):", e);
    }

    return res.status(200).json({ status: "ok", invite: inviteLink });
  } catch (err) {
    console.error("bot-webhook handler error:", err);
    return res.status(500).json({ status: "error", message: "internal error" });
  }
}
