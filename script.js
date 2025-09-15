const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || {};

const data = {
  telegramId: tgUser.id,
  username: tgUser.username || '',
  firstName: tgUser.first_name || '',
  userAgent: navigator.userAgent,
  language: navigator.language,
  screen: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  fingerprint: null,
  result: 'проверка пройдена'
};

fetch('https://check-secure.vercel.app/api/webapp-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(resp => console.log('Данные успешно отправлены на сервер:', resp))
.catch(err => console.error('Ошибка отправки данных:', err));
