import fetch from "node-fetch";
import geoip from "geoip-lite";
import bot, { users } from "../bot.js";

const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = await parseJson(req);

    // Берём Telegram-данные пользователя
    const tgData = users[body.telegramId] || { firstName: "", lastName: "", username: "" };

    // IP и гео
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);

    // VPN/ISP инфо через VPNAPI
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

    // Проверка страны
    const allowedCountries = ["RU", "BY", "KZ"];
    const result = geo && allowedCountries.includes(geo.country) ? "проверка пройдена" : "не пройден";

    // Формируем сообщение
    const message = `
🟢 *Новый пользователь*

👤 Telegram: ${tgData.firstName} ${tgData.lastName} (@${tgData.username})
🌍 IP: ${ip}
📌 Страна: ${geo?.country || "неизвестно"}
🏙 Регион: ${geo?.region || "неизвестно"}
🏢 Провайдер: ${isp}
${vpnWarning}

🖥 Браузер: ${body.browser || "неизвестно"}
💻 ОС: ${body.os || "неизвестно"}
🌐 Язык: ${body.language || "неизвестно"}
📺 Экран: ${body.screen || "неизвестно"}
⏰ Таймзона: ${body.timezone || "неизвестно"}
✅ Результат проверки: ${result}
`;

    await bot.telegram.sendMessage(SELLER_CHAT_ID, message, { parse_mode: "Markdown" });

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(JSON.parse(body)));
    req.on("error", reject);
  });
}
