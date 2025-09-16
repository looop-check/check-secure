import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = await parseJson(req);

  // Отправляем всё на bot-webhook
  await fetch(process.env.BOT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  res.status(200).json({ status: 'ok' });
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(JSON.parse(body)));
    req.on('error', reject);
  });
}
