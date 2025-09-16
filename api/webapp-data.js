import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const body = await parseJson(req);

    // IP автоматически берем с запроса
    body.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Отправляем все в bot-webhook.js
    await fetch(process.env.BOT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
}

// --- JSON парсер ---
async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}
