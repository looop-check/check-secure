// api/lib/bot.js
import jwt from "jsonwebtoken";
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");

const bot = new Telegraf(BOT_TOKEN);

// Supabase клиент (опционально, для хранения пользователей)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// /start — сохраняем в supabase и отправляем ссылку с токеном (без проверки подписки)
bot.start(async (ctx) => {
  try {
    const id = ctx.from.id;
    const tgData = {
      telegram_id: String(id),
      first_name: ctx.from.first_name || "",
      last_name: ctx.from.last_name || "",
      username: ctx.from.username || "",
    };

    try {
      await supabase.from("users").upsert([tgData], { onConflict: ["telegram_id"] });
    } catch (e) {
      console.warn("Supabase upsert error (non-fatal):", e);
    }

    // генерируем JWT (stateless session)
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    const expiresIn = process.env.TOKEN_EXPIRY || "8s"; // короткий TTL — предотвращает пересылку
    const token = jwt.sign({ tid: String(id) }, secret, { expiresIn });

    // ссылка содержит токен
    const urlBase = process.env.SITE_URL || "https://check-secure.vercel.app";
    const url = `${urlBase}?token=${encodeURIComponent(token)}`;

    await ctx.reply("Привет! Для продолжения проверки нажми кнопку ниже:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть сайт", url }]],
      },
    });
  } catch (e) {
    console.error("bot /start error:", e);
    try { await ctx.reply("⚠ Ошибка. Попробуй снова позже."); } catch(_) {}
  }
});

// Локально запускаем, на Vercel — нет
if (process.env.NODE_ENV !== "production") {
  bot.launch().then(() => console.log("Bot launched locally"));
}

export default bot;
