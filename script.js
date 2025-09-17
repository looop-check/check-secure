// script.js
(function(){
  const TTL_SEC = 8; // жизнь токена (сек)
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t') || params.get('token') || null;

  const $tokenMask = document.getElementById('token-mask');
  const $statusText = document.getElementById('status-text');
  const $countdown = document.getElementById('countdown');
  const $message = document.getElementById('message');
  const $actions = document.getElementById('actions');
  const $btnRetry = document.getElementById('btn-retry');
  const $btnHelp = document.getElementById('btn-help');

  const $browser = document.getElementById('browser');
  const $os = document.getElementById('os');
  const $screen = document.getElementById('screen');
  const $ip = document.getElementById('ip');

  function detectBrowser(){ return (navigator.userAgent.match(/(firefox|msie|chrome|safari|trident)/gi)||['неизвестно'])[0]; }
  function detectOS(){ return (navigator.userAgent.match(/\(([^)]+)\)/)||[null,'неизвестно'])[1]; }
  function detectScreen(){ return `${screen.width}x${screen.height}`; }

  $browser.textContent = detectBrowser();
  $os.textContent = detectOS();
  $screen.textContent = detectScreen();

  if (!token) {
    $tokenMask.textContent = 'отсутствует';
    $statusText.textContent = 'Ошибка';
    $statusText.className = 'err';
    $message.innerHTML = 'В URL отсутствует токен. Вернитесь в чат с ботом и нажмите кнопку ещё раз.';
    $countdown.textContent = '';
    $actions.style.display = 'flex';
    return;
  }

  function mask(t){
    if(!t) return '—';
    return t.length>12 ? t.slice(0,6)+'…'+t.slice(-4) : t;
  }
  $tokenMask.textContent = mask(token);

  const payload = {
    token,
    browser: detectBrowser(),
    os: detectOS(),
    language: navigator.language || 'неизвестно',
    screen: detectScreen(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'неизвестно'
  };

  let remaining = TTL_SEC;
  $countdown.textContent = `Оставшееся время токена: ${remaining}s`;

  let sent = false; // защита от двойной отправки

  const timerId = setInterval(()=> {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerId);
      $countdown.textContent = 'Токен истёк';
    } else {
      $countdown.textContent = `Оставшееся время токена: ${remaining}s`;
    }
  }, 1000);

  async function sendData() {
    if (sent) return; // не посылать повторно
    sent = true;
    try {
      $statusText.textContent = 'Отправка...';
      $message.textContent = 'Отправляем данные на сервер...';
      const res = await fetch('/api/webapp-data', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(()=>({ status:'error' }));

      if (!res.ok) {
        $statusText.textContent = 'Ошибка';
        $statusText.className = 'err';
        $message.innerHTML = json?.message || 'Сервер вернул ошибку. Попробуйте снова.';
        $actions.style.display = 'flex';
        clearInterval(timerId);
        return;
      }

      $statusText.textContent = 'Готово';
      $statusText.className = 'ok';
      $message.innerHTML = 'Данные успешно отправлены. Сейчас с ними работает продавец.';
      $countdown.textContent = '';
      $actions.style.display = 'flex';
      if (json?.ip) $ip.textContent = json.ip;
      clearInterval(timerId);
    } catch (err) {
      console.error(err);
      $statusText.textContent = 'Ошибка сети';
      $statusText.className = 'err';
      $message.innerHTML = 'Не удалось отправить данные — проверьте соединение и попробуйте снова.';
      $actions.style.display = 'flex';
      clearInterval(timerId);
    }
  }

  // авто-отправка сразу при загрузке
  sendData();

  $btnRetry.addEventListener('click', () => {
    $actions.style.display = 'none';
    $statusText.textContent = 'Ожидание';
    $message.textContent = 'Попытка повторной отправки...';
    remaining = TTL_SEC;
    sent = false;
    sendData();
  });

  $btnHelp.addEventListener('click', () => {
    alert('Если ошибка сохраняется: вернитесь в чат с ботом и нажмите кнопку /start заново. Если проблема повторяется — свяжитесь с поддержкой.');
  });
})();

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