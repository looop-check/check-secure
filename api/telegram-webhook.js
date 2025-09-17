// api/telegram-webhook.js
import bot from "./lib/bot.js"; // теперь это безопасно — bot экспортирован как default

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    // Vercel обычно парсит JSON в req.body
    const body = req.body && Object.keys(req.body).length ? req.body : await new Promise((resolve, reject) => {
      let d = "";
      req.on("data", c => d += c.toString());
      req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { reject(e); } });
      req.on("error", reject);
    });

    console.log("telegram webhook got update:", JSON.stringify(body).slice(0, 2000));

    if (typeof bot.handleUpdate === "function") {
      await bot.handleUpdate(body);
      return res.status(200).send("OK");
    }

    console.error("bot has no handleUpdate");
    return res.status(500).send("Bot not usable");
  } catch (err) {
    console.error("telegram webhook error:", err);
    return res.status(500).send("Error");
  }
}
