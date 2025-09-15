import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
  ctx.reply('Привет! Для продолжения нажми кнопку ниже:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть WebApp', web_app: { url: 'https://check-secure.vercel.app/index.html' } }]
      ]
    }
  });
});

// Webhook handler для Vercel
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

// Helper для парсинга JSON
async function json(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}
