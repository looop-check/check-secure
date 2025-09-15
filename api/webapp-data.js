import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import geoip from 'geoip-lite';
import { bot, SELLER_CHAT_ID } from './bot';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/webapp-data', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);

  const { telegramId, username, firstName, userAgent, language, screen, timezone, fingerprint, result } = req.body;

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

  bot.telegram.sendMessage(SELLER_CHAT_ID, message);
  res.json({ status: 'ok' });
});

export default app;
