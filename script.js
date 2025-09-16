// получаем tid из URL, если есть
const urlParams = new URLSearchParams(window.location.search);
const telegramId = urlParams.get("tid") || null;

const data = {
  telegramId,
  browser: navigator.userAgent,
  os: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || "неизвестно",
  language: navigator.language,
  screen: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

fetch("/api/bot-webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
})
  .then((res) => res.json().then(j => ({ status: res.status, body: j })))
  .then(({ status, body }) => {
    if (status === 200) {
      console.log("Данные успешно отправлены:", body);
      // можно показать пользователю сообщение, что проверка отправлена
    } else {
      console.error("Ошибка от сервера:", body);
    }
  })
  .catch((err) => console.error("Ошибка отправки данных:", err));
