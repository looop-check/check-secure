const data = {
  telegramId: null, // в JS невозможно получить ID автоматически, будет передаваться через сервер после /start
  browser: navigator.userAgent.match(/(firefox|msie|chrome|safari|trident)/gi)?.[0] || 'неизвестно',
  os: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'неизвестно',
  language: navigator.language,
  screen: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

fetch('/api/webapp-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})
.then(res => res.json())
.then(resp => console.log('Данные успешно отправлены на сервер:', resp))
.catch(err => console.error('Ошибка отправки данных:', err));
