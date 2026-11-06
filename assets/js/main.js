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

  // ---- 彩蛋：连点 more 十次，展开归档内容 ----
  // 中途停顿超过 RESET_MS 就重新数，避免"攒够十次"这种误触。
  (function () {
    var hint = document.getElementById('more-hint');
    var label = document.getElementById('more-hint-text');
    var panel = document.getElementById('more-panel');
    if (!hint || !panel) return;

    var NEED = 10;
    var RESET_MS = 1600;
    var count = 0;
    var timer = null;

    function reveal() {
      clearTimeout(timer);
      panel.classList.add('is-open');
      // 面板初始 display:none，淡入观察器不会为它触发，这里手动补上
      Array.prototype.forEach.call(panel.querySelectorAll('.card'), function (el) {
        el.classList.add('is-visible');
      });
      hint.classList.add('is-done');
      hint.setAttribute('aria-expanded', 'true');
      hint.setAttribute('aria-label', '归档内容已展开');
      if (label) label.textContent = 'archived';
      hint.disabled = true;
    }

    hint.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) return;
      count += 1;
      hint.classList.remove('tick');
      void hint.offsetWidth; // 强制重排，让脉冲动画每次都能重播
      hint.classList.add('tick');
      if (count >= NEED) {
        reveal();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(function () {
        count = 0;
      }, RESET_MS);
    });
  })();

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
