// api/telegram-webhook.js
import bot from "./lib/bot.js"; // путь к твоему файлу с telegraf bot
// НЕ импортируй launch() в lib/bot.js для продакшна — там уже условие NODE_ENV !== 'production'

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  try {
    // читаем тело (Vercel уже парсит JSON, но для safety):
    const body = req.body && Object.keys(req.body).length ? req.body : await new Promise((resolve, reject) => {
      let d = "";
      req.on("data", c => d += c.toString());
      req.on("end", () => resolve(JSON.parse(d || "{}")));
      req.on("error", reject);
    });

    console.log("telegram webhook got update:", JSON.stringify(body).slice(0, 2000));
    await bot.handleUpdate(body);
    res.status(200).send("OK");
  } catch (err) {
    console.error("telegram webhook error:", err);
    res.status(500).send("Error");
  }
}
