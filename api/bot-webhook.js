import fetch from "node-fetch";
import geoip from "geoip-lite";
import { createClient } from "@supabase/supabase-js";
import bot from "./lib/bot.js";

const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = await parseJson(req);
    const { telegramId, browser, os, language, screen, timezone } = body;

    // Получаем данные пользователя из Supabase
    const { data: tgData, error } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (error || !tgData) {
      return res.status(400).json({ status: "error", message: "Telegram ID не найден" });
    }

    // IP и гео
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    const country = geo?.country || "неизвестно";
    const region = geo?.region || "неизвестно";
    const city = geo?.city || "неизвестно";

    // VPN/ISP через VPNAPI
    let isp = "неизвестно";
    let vpnWarning = "";
    try {
      const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`);
      const vpnData = await vpnResp.json();
      if (vpnData.security) {
        isp = vpnData.network?.autonomous_system_organization || isp;
        if (vpnData.security.vpn || vpnData.security.proxy || vpnData.security.tor) {
          vpnWarning = "⚠ Пользователь использует VPN/Proxy/Tor";
        }
      }
    } catch (e) {
      console.error("Ошибка VPNAPI:", e);
    }

    const message = `
🟢 *Новый пользователь*

👤 Telegram: ${tgData.first_name} ${tgData.last_name} (@${tgData.username})
🌍 IP: ${ip}
📌 Страна: ${country}
🏙 Регион: ${region}
🏘 Город: ${city}
🏢 Провайдер: ${isp}
${vpnWarning}

🖥 Браузер: ${browser || "неизвестно"}
💻 ОС: ${os || "неизвестно"}
🌐 Язык: ${language || "неизвестно"}
📺 Экран: ${screen || "неизвестно"}
⏰ Таймзона: ${timezone || "неизвестно"}
`;

    await bot.telegram.sendMessage(SELLER_CHAT_ID, message, { parse_mode: "Markdown" });

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error" });
  }
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", () => resolve(JSON.parse(body)));
    req.on("error", reject);
  });
}
