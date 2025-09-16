import { bot, SELLER_CHAT_ID } from './bot-webhook.js';
import geoip from 'geoip-lite';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = await parseJson(req);

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);

  // Проверка VPN через VPNAPI
  const vpnApiKey = process.env.VPNAPI_KEY;
  let vpnWarning = '';
  try {
    const vpnRes = await fetch(`https://vpnapi.io/api/${ip}?key=${vpnApiKey}`);
    const vpnData = await vpnRes.json();
    if (vpnData.security && (vpnData.security.vpn || vpnData.security.proxy || vpnData.security.tor)) {
      vpnWarning = '⚠ Пользователь может использовать VPN/Proxy/Tor';
    }
  } catch (err) {
    console.error('VPNAPI error:', err);
  }

  // Проверка страны
  const allowedCountries = ['RU','BY','KZ'];
  const result = geo && allowedCountries.includes(geo.country) ? 'проверка пройдена' : 'не пройден';

  const message = `
🟢 *Новый пользователь*

Telegram ID: ${body.telegramId || 'неизвестно'}
Username: @${body.username || 'неизвестно'}
Имя: ${body.firstName || 'неизвестно'}
Фамилия: ${body.lastName || 'неизвестно'}

🌍 IP: ${ip}
📌 Страна: ${geo?.country || 'неизвестно'}
🏙 Регион: ${geo?.region || 'неизвестно'}
⏰ Часовой пояс (браузер): ${body.timezone}
${vpnWarning}

🖥 Браузер: ${body.browser}
💻 ОС: ${body.os}
🌐 Язык: ${body.language || 'неизвестно'}
📺 Экран: ${body.screen || 'неизвестно'}
🔑 Fingerprint: ${body.fingerprint || 'неизвестно'}

✅ Результат проверки: ${result}
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
