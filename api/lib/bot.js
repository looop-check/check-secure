// api/lib/bot.js
import jwt from "jsonwebtoken";
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");

const CHANNEL_ID = process.env.CHANNEL_ID;
if (!CHANNEL_ID) throw new Error("CHANNEL_ID is not set");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

const SITE_URL = process.env.SITE_URL || "https://check-secure.vercel.app/";

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Генерация одноразовой ссылки в канал
export async function generateInvite(telegram_id) {
  const linkData = await bot.telegram.createChatInviteLink(CHANNEL_ID, {
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + 3600,
  });

  await supabase.from("invites").insert({
    telegram_id,
    invite_link: linkData.invite_link,
    used: false,
  });

  return linkData.invite_link;
}

// /start — сохраняет пользователя и отправляет ссылку на сайт с JWT
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

    const token = jwt.sign({ tid: String(id) }, JWT_SECRET, { expiresIn: process.env.TOKEN_EXPIRY || "15m" });
    const url = `${SITE_URL}?token=${encodeURIComponent(token)}`;

    await ctx.reply("Привет! Для продолжения проверки нажми кнопку ниже:", {
      reply_markup: { inline_keyboard: [[{ text: "Пройти проверку", url }]] },
    });
  } catch (e) {
    console.error("bot /start error:", e);
    await ctx.reply("⚠ Ошибка. Попробуй снова позже.");
  }
});

// Отслеживание новых участников канала
bot.on("chat_member", async (ctx) => {
  const member = ctx.chatMember;
  if (!member || !member.new_chat_member) return;

  const userId = member.new_chat_member.user.id;
  const newStatus = member.new_chat_member.status;

  // Нас интересуют только новые обычные участники
  if (newStatus !== "member") return;

  // Проверяем одноразовую ссылку в БД
  const { data } = await supabase.from("invites")
    .select("*")
    .eq("telegram_id", String(userId))
    .eq("used", false)
    .limit(1)
    .single();

  if (!data) {
    // Чужой пользователь — кик
    try {
      await bot.telegram.kickChatMember(CHANNEL_ID, userId, { revoke_messages: true });
      console.log(`Кикнули чужого пользователя ${userId}`);
    } catch(e){
      console.error("Kick error:", e);
    }
    return;
  }

  // Если всё верно — помечаем ссылку как использованную
  await supabase.from("invites").update({ used: true }).eq("id", data.id);
});

// Локальный запуск для разработки
if (process.env.NODE_ENV !== "production") {
  bot.launch().then(() => console.log("Bot launched locally"));
}

export default bot;
