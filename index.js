const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

// --- Настройки ---
const BOT_TOKEN = process.env.BOT_TOKEN || 'ВАШ_ТОКЕН_ОТ_BOTFATHER';
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID || 'ID_ЧАТА_ПРОДАВЦА';
const WEBAPP_URL = 'https://check-secure.vercel.app';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- 1. Команда /start ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Привет! Для продолжения нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть WebApp', web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// --- 2. API для WebApp ---
app.post('/webapp-data', (req, res) => {
  const { telegramId, username, firstName, ip, geo, fingerprint, result } = req.body;

  const message = `
Пользователь: ${firstName} (@${username})
Telegram ID: ${telegramId}
IP: ${ip} (${geo?.country || 'неизвестно'}, ${geo?.region || 'неизвестно'})
Fingerprint: ${fingerprint}
Результат проверки: ${result}
  `;

  bot.sendMessage(SELLER_CHAT_ID, message);

  res.json({ status: 'ok' });
});

// --- 3. Запуск сервера ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
