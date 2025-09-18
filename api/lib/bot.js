import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SELLER_CHAT_ID = process.env.SELLER_CHAT_ID;
const VPNAPI_KEY = process.env.VPNAPI_KEY;

if (!BOT_TOKEN || !CHANNEL_ID || !SUPABASE_URL || !SUPABASE_KEY || !SELLER_CHAT_ID) {
  throw new Error("Environment variables missing");
}

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 🔹 Проверка подписки через страну и VPN
async function validateUser(ip) {
  const geo = ip ? await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,query`) : { countryCode: null, query: ip };
  let country = "неизвестно";
  let vpnWarning = "";

  if (geo && geo.countryCode) country = geo.countryCode;

  if (VPNAPI_KEY && ip) {
    try {
      const vpnResp = await fetch(`https://vpnapi.io/api/${ip}?key=${VPNAPI_KEY}`, { timeout: 10000 });
      const vpnData = await vpnResp.json();
      const { vpn, proxy, tor } = vpnData.security || {};
      if (vpn) vpnWarning = "⚠ Использует VPN";
      else if (proxy) vpnWarning = "⚠ Использует Proxy";
      else if (tor) vpnWarning = "⚠ Использует Tor";
    } catch (e) {
      console.error("VPNAPI error:", e);
    }
  }

  const ok = country === "RU" && !vpnWarning;
  return { ok, country, vpnWarning };
}

// 🔹 Генерация одноразовой ссылки и запись в Supabase
async function generateInvite(telegram_id) {
  const linkData = await bot.telegram.createChatInviteLink(CHANNEL_ID, { member_limit: 1, expire_date: Math.floor(Date.now()/1000)+3600 });
  await supabase.from("invites").insert({
    telegram_id,
    invite_link: linkData.invite_link
  });
  return linkData.invite_link;
}

// /start
bot.start(async (ctx) => {
  try {
    const id = ctx.from.id;
    const ip = ctx.from.ip || ""; // желательно прокинуть через вебхук, если есть

    const { ok, vpnWarning } = await validateUser(ip);

    const tgData = {
      telegram_id: String(id),
      first_name: ctx.from.first_name || "",
      last_name: ctx.from.last_name || "",
      username: ctx.from.username || "",
    };
    await supabase.from("users").upsert([tgData], { onConflict: ["telegram_id"] });

    if (!ok) {
      await bot.telegram.sendMessage(SELLER_CHAT_ID,
        `Попытка входа пользователя с ограничением:\n${JSON.stringify(tgData)}\n${vpnWarning || "Страна не RU"}`
      );
      return ctx.reply("❌ Доступ запрещён. Попробуйте позже.");
    }

    const invite_link = await generateInvite(id);

    await ctx.reply("✅ Доступ одобрен! Перейдите по ссылке ниже (одноразово):", {
      reply_markup: { inline_keyboard: [[{ text: "Войти в канал", url: invite_link }]] }
    });

    await bot.telegram.sendMessage(SELLER_CHAT_ID,
      `Пользователь разрешён:\n<b>${tgData.first_name} ${tgData.last_name}</b> (@${tgData.username})\nID: ${id}\nVPN: ${vpnWarning || "нет"}\nInvite: ${invite_link}`,
      { parse_mode: "HTML" }
    );

  } catch (e) {
    console.error("bot /start error:", e);
    ctx.reply("⚠ Ошибка. Попробуйте снова позже.");
  }
});

// Отслеживание входа через одноразовую ссылку
bot.on("chat_member", async (ctx) => {
  const member = ctx.chatMember;
  if (!member || !member.new_chat_member) return;

  const userId = member.new_chat_member.user.id;

  // Проверяем Supabase invites
  const { data } = await supabase.from("invites").select("*").eq("telegram_id", String(userId)).eq("used", false).limit(1).single();

  if (!data) {
    // Неавторизованный, кикаем
    try { await bot.telegram.kickChatMember(CHANNEL_ID, userId); } catch(e){ console.error(e); }
    return;
  }

  // Отмечаем как использованную
  await supabase.from("invites").update({ used: true }).eq("id", data.id);
});

if (process.env.NODE_ENV !== "production") {
  bot.launch().then(() => console.log("Bot launched locally"));
}

export default bot;
