import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
export const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;

const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
  ctx.reply('Привет! Для продолжения нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть WebApp', web_app: { url: 'https://check-secure.vercel.vercel.app/index.html' } }]
      ]
    }
  });
});

// Webhook handler для Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
