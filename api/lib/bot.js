import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- Команда /start ---
bot.start(async (ctx) => {
  const id = ctx.from.id;
  const tgData = {
    telegram_id: id,
    first_name: ctx.from.first_name || "",
    last_name: ctx.from.last_name || "",
    username: ctx.from.username || "",
  };

  // Сохраняем данные в Supabase
  await supabase.from("users").upsert([tgData], { onConflict: ["telegram_id"] });

  // Отправляем кнопку с ссылкой на сайт
  ctx.reply("Привет! Для продолжения нажми кнопку ниже:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть сайт", url: `https://check-secure.vercel.app?tid=${id}` }]
      ]
    }
  });
});

// --- Локальный запуск ---
if (process.env.NODE_ENV !== "production") {
  bot.launch();
}

export default bot;
