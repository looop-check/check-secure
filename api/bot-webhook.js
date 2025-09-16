import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const WEBAPP_URL = 'https://check-secure.vercel.app/index.html';

const bot = new Telegraf(BOT_TOKEN);

// /start
bot.start((ctx) => {
  ctx.reply('Привет! Для продолжения нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть WebApp', web_app: { url: WEBAPP_URL } }]
      ]
    }
  });
});

// Вебхук для Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const body = await json(req);
      await bot.handleUpdate(body);
      res.status(200).send('OK');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}

async function json(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}

export { bot, SELLER_CHAT_ID };
