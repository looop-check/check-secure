import { Telegraf } from 'telegraf';
import geoip from 'geoip-lite';
import UAParser from 'ua-parser-js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;

const bot = new Telegraf(BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = await parseJson(req);
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);

  // VPN-проверка: IP и часовой пояс не совпадают
  const vpnWarning = geo && geo.timezone && geo.timezone !== body.timezone
    ? '⚠ Пользователь может использовать VPN'
    : '';

  // Парсим браузер
  const parser = new UAParser(body.userAgent);
  const browserName = parser.getBrowser().name || 'неизвестно';
  const osName = parser.getOS().name || 'неизвестно';

  // Результат проверки страны (можно оставить как есть)
  const allowedCountries = ['RU', 'BY', 'KZ'];
  const result = geo && allowedCountries.includes(geo.country) ? 'проверка пройдена' : 'не пройден';

  const message = `
🟢 *Новый пользователь*

🌍 *IP:* ${ip}
📌 *Страна:* ${geo?.country || 'неизвестно'}
🏙 *Регион:* ${geo?.region || 'неизвестно'}
⏰ *Часовой пояс (браузер):* ${body.timezone}
${vpnWarning}

🖥 *Браузер:* ${browserName}
💻 *ОС:* ${osName}
🌐 *Язык:* ${body.language || 'неизвестно'}
📺 *Экран:* ${body.screen || 'неизвестно'}
🔑 *Fingerprint (Цифровой отпечаток):* ${body.fingerprint || 'неизвестно'}
✅ *Результат проверки:* ${result}
`;

  await bot.telegram.sendMessage(SELLER_CHAT_ID, message, { parse_mode: 'Markdown' });
  res.status(200).json({ status: 'ok' });
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}
