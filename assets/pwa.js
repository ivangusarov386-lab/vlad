(() => {
  const base = new URL('../', document.currentScript.src);
  const install = document.querySelector('.pwa-install');
  const help = document.querySelector('.pwa-help');
  const status = document.querySelector('.pwa-install-status');
  const update = document.querySelector('.pwa-update');
  const offline = document.querySelector('.pwa-offline');
  const standalone = window.matchMedia('(display-mode: standalone)');
  const isInstalled = () => standalone.matches || navigator.standalone === true;
  let prompt = null;
  let waitingWorker = null;
  let reloadForUpdate = false;

  const setStatus = message => {
    status.textContent = message;
    status.hidden = !message;
  };
  const renderInstall = () => {
    install.hidden = isInstalled();
    if (isInstalled()) setStatus('Flowpass открыт как приложение.');
  };
  renderInstall();
  if (standalone.addEventListener) standalone.addEventListener('change', renderInstall);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
    renderInstall();
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    install.hidden = true;
    setStatus('Flowpass установлен. Ищите значок на главном экране или в списке приложений.');
  });
  install.addEventListener('click', async () => {
    if (!prompt) {
      help.open = true;
      help.scrollIntoView({block: 'center', behavior: 'auto'});
      return;
    }
    const current = prompt;
    prompt = null;
    install.disabled = true;
    try {
      await current.prompt();
      const result = await current.userChoice;
      if (result.outcome === 'accepted') setStatus('Установка подтверждена. Дождитесь появления значка Flowpass.');
    } catch {
      help.open = true;
    } finally {
      install.disabled = false;
    }
  });

  let connectionCheck = 0;
  const showConnection = async () => {
    const check = ++connectionCheck;
    if (!navigator.onLine) {offline.hidden = false;return;}
    // A device can have Wi-Fi while the Internet is unreachable. HEAD is not
    // served by our worker's cache, so it checks actual access to this site.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(new URL('manifest.webmanifest', base), {
        method: 'HEAD', cache: 'no-store', signal: controller.signal,
      });
      if (check === connectionCheck) offline.hidden = response.ok;
    } catch {
      if (check === connectionCheck) offline.hidden = false;
    } finally {
      clearTimeout(timeout);
    }
  };
  window.addEventListener('online', showConnection);
  window.addEventListener('offline', showConnection);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') showConnection();
  });
  showConnection();

  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const showUpdate = worker => {
    waitingWorker = worker;
    update.hidden = false;
  };
  update.querySelector('button').addEventListener('click', () => {
    if (!waitingWorker) return;
    reloadForUpdate = true;
    update.querySelector('button').disabled = true;
    waitingWorker.postMessage({type: 'ACTIVATE_UPDATE'});
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadForUpdate) {
      reloadForUpdate = false;
      window.location.reload();
    }
  });
  navigator.serviceWorker.register(new URL('sw.js', base), {
    scope: base.pathname, updateViaCache: 'none',
  }).then(registration => {
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  }).catch(() => {
    if (!navigator.serviceWorker.controller) {
      setStatus('Офлайн-версия пока не сохранена. Откройте сайт при устойчивом подключении и обновите страницу.');
    }
  });
})();
