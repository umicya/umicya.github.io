// umicya · whims — 主题切换 + 轻量交互
(function () {
  'use strict';

  var root = document.documentElement;
  var STORAGE_KEY = 'theme';

  // 三态：auto / light / dark。默认 auto（跟随系统）。
  function currentTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme'); // auto：交给 CSS media query
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
    renderToggle(theme);
  }

  function renderToggle(theme) {
    var icon = document.getElementById('theme-icon');
    var label = document.getElementById('theme-label');
    if (!icon || !label) return;
    var map = {
      auto: { icon: '🌗', label: 'auto' },
      light: { icon: '☀️', label: 'light' },
      dark: { icon: '🌙', label: 'dark' },
    };
    var v = map[theme] || map.auto;
    icon.textContent = v.icon;
    label.textContent = v.label;
  }

  function cycleTheme() {
    var t = currentTheme();
    var next = t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto';
    applyTheme(next);
  }

  function init() {
    // 初始化时：若用户没手动选过（auto），不做额外设置，交给 media query；
    // 若选过 light/dark，head 内联脚本已提前锁定，这里再同步一下 UI。
    applyTheme(currentTheme());

    var toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.addEventListener('click', cycleTheme);
  }

  // 年份
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 淡入动画
  var revealTargets = document.querySelectorAll(
    '.hero-title, .hero-sub, .hero-note, .card, .about-text, .about-list, .overline, .section-head'
  );
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  init();
})();
