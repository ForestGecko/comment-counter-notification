(async function () {
  const config = window.OVERLAY_CONFIG;
  const counter = new OverlayCounter(config.serviceId);
  const panel = document.getElementById('notification');
  const query = new URLSearchParams(location.search);
  const preview = query.get('preview') === '1';
  let hideTimer;
  let audio;
  let lastSound = -Infinity;
  for (const key of ['top', 'right']) document.documentElement.style.setProperty(`--${key}`, `${config[key]}px`);
  document.documentElement.style.setProperty('--scale', config.scale);

  function render() {
    document.getElementById('viewer-count').textContent = counter.viewers ?? '—';
    document.getElementById('comment-count').textContent = counter.comments;
  }
  async function sound(event, force = false) {
    const enabled = { comment: config.soundOnComment, up: config.soundOnViewerIncrease, down: config.soundOnViewerDecrease };
    if (!config.sound || (!force && (!enabled[event] || performance.now() - lastSound < config.soundCooldownMs))) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      await audio.resume();
      if (audio.state !== 'running') { console.warn('通知音: OBS の対話画面で音声を有効にしてください。'); return; }
      lastSound = performance.now();
      const notes = { comment: [880, 1175], up: [660, 880], down: [660, 440] }[event];
      notes.forEach((frequency, i) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + i * 0.11;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, config.volume)) * 0.35, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.15);
      });
    } catch (error) { console.warn('通知音を再生できませんでした', error); }
  }
  function update(event) {
    render();
    if (!event) return;
    panel.classList.add('visible');
    panel.setAttribute('aria-hidden', 'false');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
    }, config.displayMs);
    void sound(event);
  }
  // OBS の「対話」で一度クリックすると自動再生制限を解除できる。
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-event]')) void sound('comment', true);
  });
  if (preview) {
    document.body.classList.add('preview');
    document.getElementById('preview-controls').hidden = false;
    counter.viewers = 3;
    counter.comments = 14;
    update('comment');
    document.querySelectorAll('[data-event]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const kind = button.dataset.event;
      if (kind === 'sound') { void sound('comment', true); return; }
      if (kind === 'comment') counter.comments++;
      else counter.viewers = Math.max(0, counter.viewers + (kind === 'up' ? 1 : -1));
      update(kind);
    }));
    return;
  }
  if (!window.OneSDK) { console.error('わんコメのテンプレートフォルダーから起動してください。'); return; }
  try {
    await OneSDK.setup({ permissions: ['comments', 'meta', 'services', 'clear'], mode: 'all' });
    OneSDK.subscribe({ action: 'services', callback: services => update(counter.services(services)) });
    OneSDK.subscribe({ action: 'meta', callback: meta => update(counter.meta(meta)) });
    OneSDK.subscribe({ action: 'comments', callback: comments => update(counter.receive(comments)) });
    OneSDK.subscribe({ action: 'clear', callback: () => { counter.clear(); update('comment'); } });
    await OneSDK.ready();
    // 枠を先に確定してからコメントを受信する。
    if (typeof OneSDK.getServices === 'function') {
      try { update(counter.services(await OneSDK.getServices())); }
      catch (error) { console.warn('配信枠の初期取得に失敗しました', error); }
    }
    await OneSDK.connect();
  } catch (error) { console.error('わんコメへの接続に失敗しました', error); }
})();
