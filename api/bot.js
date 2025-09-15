import { Telegraf } from 'telegraf';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

// --- Настройки ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const WEBAPP_URL = 'https://check-secure.vercel.app';

// --- Создаем бота через webhook ---
const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
  ctx.reply('Привет! Для продолжения нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть WebApp', web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// --- Express сервер ---
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Endpoint для Telegram webhook
app.post('/api/bot', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('ok');
  } catch (e) {
    console.error(e);
    res.status(500).send('error');
  }
});

// Endpoint для WebApp
app.post('/webapp-data', (req, res) => {
  const { telegramId, username, firstName, ip, geo, fingerprint, result } = req.body;

  const message = `
Пользователь: ${firstName} (@${username})
Telegram ID: ${telegramId}
IP: ${ip} (${geo?.country || 'неизвестно'}, ${geo?.region || 'неизвестно'})
Fingerprint: ${fingerprint}
Результат проверки: ${result}
  `;

  bot.telegram.sendMessage(SELLER_CHAT_ID, message);

  res.json({ status: 'ok' });
});

// Экспорт для Vercel
export default app;
