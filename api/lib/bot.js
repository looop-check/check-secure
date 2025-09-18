// api/lib/bot.js
import jwt from "jsonwebtoken";
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");

const CHANNEL_ID = process.env.CHANNEL_ID;
if (!CHANNEL_ID) throw new Error("CHANNEL_ID is not set");

const bot = new Telegraf(BOT_TOKEN);

// Supabase клиент
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🔍 Проверка подписки
async function checkSubscription(userId) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      console.error("getChatMember error:", data);
      return false;
    }

    const status = data.result.status;
    return ["creator", "administrator", "member"].includes(status);
  } catch (err) {
    console.error("checkSubscription error:", err);
    return false;
  }
}

// /start — сохраняем в supabase и отправляем ссылку с токеном
bot.start(async (ctx) => {
  try {
    const id = ctx.from.id;

    // сначала проверяем подписку
    const subscribed = await checkSubscription(id);
    if (!subscribed) {
      return ctx.reply(
        "❌ Для доступа подпишись на канал"
      );
    }

    const tgData = {
      telegram_id: String(id),
      first_name: ctx.from.first_name || "",
      last_name: ctx.from.last_name || "",
      username: ctx.from.username || "",
    };

    await supabase.from("users").upsert([tgData], { onConflict: ["telegram_id"] });

    // генерируем JWT (stateless session)
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    const expiresIn = process.env.TOKEN_EXPIRY || "8s";
    const token = jwt.sign({ tid: String(id) }, secret, { expiresIn });

    // ссылка содержит токен
    const url = `https://check-secure.vercel.app?token=${encodeURIComponent(token)}`;

    await ctx.reply("✅ Подписка подтверждена! Для продолжения проверки нажми кнопку ниже:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть сайт", url }]],
      },
    });
  } catch (e) {
    console.error("bot /start error:", e);
    await ctx.reply("⚠ Ошибка. Попробуй снова позже.");
  }
});

// Локально запускаем, на Vercel — нет
if (process.env.NODE_ENV !== "production") {
  bot.launch().then(() => console.log("Bot launched locally"));
}

export default bot;
