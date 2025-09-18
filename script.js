(function(){
  const TTL_SEC = 10; // жизнь токена (сек)
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

  // show detected
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

  // payload отправки (сервер читает token из body или заголовка)
  const payload = {
    token,
    browser: navigator.userAgent || 'неизвестно',
    os: detectOS(),
    language: navigator.language || 'неизвестно',
    screen: detectScreen(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'неизвестно'
  };

  const ENDPOINT = '/api/bot-webhook';

  // countdown UI
  let remaining = TTL_SEC;
  $countdown.textContent = `Оставшееся время токена: ${remaining}s`;

  const timerId = setInterval(()=> {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerId);
      $countdown.textContent = 'Токен истёк';
    } else {
      $countdown.textContent = `Оставшееся время токена: ${remaining}s`;
    }
  }, 1000);

  let sent = false; // защита от двойной отправки

  async function sendData() {
    if (sent) return;
    sent = true;

    $statusText.textContent = 'Отправка...';
    $message.textContent = 'Отправляем данные на сервер...';

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // дублируем, на случай если сервер читает из заголовка
        },
        body: JSON.stringify(payload),
      });

      let json;
      try { json = await res.json(); } catch(e) { json = { status: 'error' }; }

      if (!res.ok) {
        // развернутый вывод ошибки в UI для отладки/пользователя
        $statusText.textContent = 'Ошибка';
        $statusText.className = 'err';
        const msg = json?.message || `Сервер вернул ${res.status}`;
        $message.innerHTML = msg;
        $actions.style.display = 'flex';
        clearInterval(timerId);
        // лог в консоль для дебага
        console.error('POST', ENDPOINT, '->', res.status, json);
        return;
      }

      $statusText.textContent = 'Готово';
      $statusText.className = 'ok';
      $message.innerHTML = json?.message || 'Данные успешно отправлены.';
      $countdown.textContent = '';
      $actions.style.display = 'flex';
      if (json?.ip) $ip.textContent = json.ip;
      clearInterval(timerId);
      console.log('POST success', json);
    } catch (err) {
      console.error('Network error:', err);
      $statusText.textContent = 'Ошибка сети';
      $statusText.className = 'err';
      $message.innerHTML = 'Не удалось отправить данные — проверьте соединение и попробуйте снова.';
      $actions.style.display = 'flex';
      clearInterval(timerId);
    }
  }

  // auto-send on load
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
    alert('Если ошибка сохраняется: вернитесь в чат с ботом и нажмите /start заново.');
  });

})();
