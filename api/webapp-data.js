import { Telegraf } from 'telegraf';
import geoip from 'geoip-lite';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const bot = new Telegraf(BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = await json(req);
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);

  const message = `
Пользователь: ${body.firstName} (@${body.username})
Telegram ID: ${body.telegramId}
IP: ${ip}
Страна: ${geo?.country || 'неизвестно'}, Регион: ${geo?.region || 'неизвестно'}
Browser: ${body.userAgent}
Language: ${body.language}
Screen: ${body.screen}
Timezone: ${body.timezone}
Fingerprint: ${body.fingerprint}
Результат проверки: ${body.result}
  `;

  await bot.telegram.sendMessage(SELLER_CHAT_ID, message);
  res.status(200).json({ status: 'ok' });
}

// Helper для парсинга JSON
async function json(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}
