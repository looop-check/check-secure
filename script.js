// script.js
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

if (!token) {
  console.error("Token not found in URL — access denied");
  // можно показать сообщение пользователю
  // document.body.innerHTML = "Доступ по ссылке";
  throw new Error("token missing");
}

const data = {
  // можно не отправлять telegramId, сервер сам возьмёт tid из токена
  browser: navigator.userAgent,
  os: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || "неизвестно",
  language: navigator.language,
  screen: `${screen.width}x${screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

fetch("/api/bot-webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify(data),
})
  .then((res) => res.json().then(j => ({ status: res.status, body: j })))
  .then(({ status, body }) => {
    if (status === 200) {
      console.log("Данные успешно отправлены:", body);
    } else {
      console.error("Ошибка от сервера:", body);
      // показать пользователю дружелюбное сообщение, если хотим
    }
  })
  .catch((err) => console.error("Ошибка отправки данных:", err));
