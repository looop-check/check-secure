import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");

const bot = new Telegraf(BOT_TOKEN);

// Supabase client used inside bot (for /start saving)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// /start — сохраняем в supabase и отправляем ссылку с tid
bot.start(async (ctx) => {
  try {
    const id = ctx.from.id;
    const tgData = {
      telegram_id: String(id),
      first_name: ctx.from.first_name || "",
      last_name: ctx.from.last_name || "",
      username: ctx.from.username || "",
    };

    await supabase.from("users").upsert([tgData], { onConflict: ["telegram_id"] });

    const url = `https://check-secure.vercel.app?tid=${encodeURIComponent(id)}`;

    await ctx.reply("Привет! Для продолжения проверки нажми кнопку ниже:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть сайт", url }]],
      },
    });
  } catch (e) {
    console.error("bot /start error:", e);
  }
});

// Запуск локально (Vercel будет импортировать без запуска)
if (process.env.NODE_ENV !== "production") {
  bot.launch().then(() => console.log("Bot launched (dev)"));
}

export default bot;
