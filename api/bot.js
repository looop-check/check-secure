import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
export const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;

export const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
  ctx.reply('Привет! Для продолжения нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть WebApp', web_app: { url: 'https://check-secure.vercel.app.vercel.app/index.html' } }]
      ]
    }
  });
});

// Запуск бота через webhook/polling
bot.launch();
