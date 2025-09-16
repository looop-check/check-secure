import { Telegraf } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// --- Хранилище пользователей ---
export const users = {};

// --- Команда /start ---
bot.start((ctx) => {
  const id = ctx.from.id;
  users[id] = {
    telegramId: id,
    firstName: ctx.from.first_name || "",
    lastName: ctx.from.last_name || "",
    username: ctx.from.username || "",
  };

  ctx.reply("Привет! Для продолжения нажми кнопку ниже:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть сайт",
            url: `https://check-secure.vercel.app?tid=${id}`,
          },
        ],
      ],
    },
  });
});

// --- Запуск бота (только локально) ---
if (process.env.NODE_ENV !== "production") {
  bot.launch();
}

export default bot;
