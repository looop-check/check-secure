import bot from "./lib/bot.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = req.body && Object.keys(req.body).length ? req.body : await new Promise((resolve, reject) => {
      let d = "";
      req.on("data", c => d += c.toString());
      req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { reject(e); } });
      req.on("error", reject);
    });

    if (typeof bot.handleUpdate === "function") {
      await bot.handleUpdate(body);
      return res.status(200).send("OK");
    }

    return res.status(500).send("Bot not usable");
  } catch (err) {
    console.error("telegram webhook error:", err);
    return res.status(500).send("Error");
  }
}
