// api/telegram-webhook.js
// безопасный webhook — динамически импортирует bot и поддерживает оба формата экспорта

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // динамически импортируем bot (поддерживаем ESM default и CommonJS)
  let bot;
  try {
    const mod = await import("./lib/bot.js");
    bot = mod?.default ?? mod;
  } catch (e) {
    console.error("Failed to import bot module:", e);
    return res.status(500).send("Server error (import bot)");
  }

  try {
    // Vercel обычно уже парсит JSON в req.body; fallback — ручной парсинг
    const body = req.body && Object.keys(req.body).length ? req.body : await new Promise((resolve, reject) => {
      let d = "";
      req.on("data", c => d += c.toString());
      req.on("end", () => {
        try { resolve(JSON.parse(d || "{}")); } catch (err) { reject(err); }
      });
      req.on("error", reject);
    });

    console.log("telegram webhook got update:", JSON.stringify(body).slice(0, 2000));

    if (bot && typeof bot.handleUpdate === "function") {
      await bot.handleUpdate(body);
      return res.status(200).send("OK");
    } else {
      console.error("bot module imported but has no handleUpdate");
      return res.status(500).send("Server error (bot not usable)");
    }
  } catch (err) {
    console.error("telegram webhook error:", err);
    return res.status(500).send("Error");
  }
}
