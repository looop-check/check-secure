// api/lib/bot.js — фрагмент /start
import jwt from "jsonwebtoken";
// ... остальное

bot.start(async (ctx) => {
  try {
    const id = ctx.from.id;
    const tgData = {
      telegram_id: String(id),
      first_name: ctx.from.first_name || "",
      last_name: ctx.from.last_name || "",
      username: ctx.from.username || "",
    };

    // сохраняем (если нужно)
    await supabase.from("users").upsert([tgData], { onConflict: ["telegram_id"] });

    // генерируем JWT (stateless session)
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    const expiresIn = process.env.TOKEN_EXPIRY || "15m"; // например 15 минут
    const token = jwt.sign({ tid: String(id) }, secret, { expiresIn });

    // ссылка содержит токен — на клиенте script.js будет брать token из URL
    const url = `https://check-secure.vercel.app?token=${encodeURIComponent(token)}`;

    await ctx.reply("Привет! Для продолжения проверки нажми кнопку ниже:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть сайт", url }]],
      },
    });
  } catch (e) {
    console.error("bot /start error:", e);
  }
});
