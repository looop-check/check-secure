import geoip from 'geoip-lite';
import { bot, SELLER_CHAT_ID } from './bot-webhook';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = await req.json();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);

  const { telegramId, username, firstName, userAgent, language, screen, timezone, fingerprint, result } = body;

  const message = `
Пользователь: ${firstName} (@${username})
Telegram ID: ${telegramId}
IP: ${ip}
Страна: ${geo?.country || 'неизвестно'}, Регион: ${geo?.region || 'неизвестно'}
Browser: ${userAgent}
Language: ${language}
Screen: ${screen}
Timezone: ${timezone}
Fingerprint: ${fingerprint}
Результат проверки: ${result}
  `;

  await bot.telegram.sendMessage(SELLER_CHAT_ID, message);
  res.status(200).json({ status: 'ok' });
}
