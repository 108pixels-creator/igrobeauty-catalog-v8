/* IGRObeauty — общая интерактивность каталога v8: панель, меню, счётчик в карточке, полоса разделов (фильтры живут в render.js) */
(function () {
  'use strict';
  var body = document.body;

  /* ---------- панель «Фильтры» ---------- */
  /* пока панель открыта, всё под затемнением недоступно ни мыши, ни клавиатуре */
  var BACKDROP = ['.ig-topbar', '.ig-header', '.ig-mainnav', '#page', '.ig-footer'];
  function setInert(on) {
    BACKDROP.forEach(function (s) {
      var el = document.querySelector(s);
      if (!el) return;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
  }
  function openDrawer(id, focusKey) {
    var d = document.getElementById(id);
    var scrim = document.querySelector('.ig-scrim');
    if (!d) return;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    if (scrim) scrim.classList.add('is-open');
    body.style.overflow = 'hidden';
    setInert(true);
    /* фокус уходит в панель: на нужную группу, если открыли чипом «Тип продукта», иначе на кнопку закрытия */
    var group = focusKey && d.querySelector('[data-facet-group="' + focusKey + '"]');
    var target = (group && group.querySelector('.igro-accordion__trigger')) || d.querySelector('.ig-drawer__close');
    if (target) target.focus({ preventScroll: true });
    /* панель открывается прокрученной так, что заголовок нужной группы стоит первой строкой; обычное открытие — с начала */
    var pane = d.querySelector('.ig-drawer__body');
    if (pane) pane.scrollTop = group ? pane.scrollTop + group.getBoundingClientRect().top - pane.getBoundingClientRect().top : 0;
  }
  function closeAll() {
    var wasOpen = document.querySelector('.ig-drawer.is-open');
    document.querySelectorAll('.ig-drawer.is-open').forEach(function (d) {
      d.classList.remove('is-open');
      d.setAttribute('aria-hidden', 'true');
    });
    var scrim = document.querySelector('.ig-scrim');
    if (scrim) scrim.classList.remove('is-open');
    body.style.overflow = '';
    setInert(false);
    /* фокус возвращается на кнопку «Фильтры» */
    if (wasOpen) {
      var back = document.querySelector('.ig-filters-btn');
      if (back) back.focus({ preventScroll: true });
    }
  }

  /* ---------- выпадающее меню каталога ---------- */
  var catalogBtn = document.querySelector('[data-toggle="mega"]');
  var megaEl = document.getElementById('mega');
  var mainnav = document.querySelector('.ig-mainnav');
  var megaByHover = false;
  function megaOpen() { return !!megaEl && megaEl.classList.contains('is-open'); }
  /* контур выбранного раздела (до 27.10 – тёмная плашка): переезжает к пункту; instant — без анимации (первое открытие, смена размера окна) */
  function moveMarker(cat, instant) {
    var cats = cat && cat.parentNode;
    if (!cats) return;
    if (instant) cats.classList.add('is-instant');
    cats.style.setProperty('--marker-y', cat.offsetTop + 'px');
    cats.style.setProperty('--marker-h', cat.offsetHeight + 'px');
    if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { cats.classList.remove('is-instant'); }); });
  }
  function setMega(open) {
    if (!megaEl) return;
    if (open && !megaOpen()) {
      moveMarker(megaEl.querySelector('.ig-mega__cat.is-active'), true);
    }
    megaEl.classList.toggle('is-open', open);
    megaEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (catalogBtn) catalogBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) megaByHover = false;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;

    var openBtn = t.closest('[data-open]');
    if (openBtn) { openDrawer('drawer-' + openBtn.getAttribute('data-open'), openBtn.getAttribute('data-focus')); return; }

    /* «Показать» и «Сбросить» закрывают панель (сброс применяется сразу) */
    if (t.closest('[data-apply]')) { closeAll(); return; }
    if (t.closest('[data-close]')) { closeAll(); return; }

    /* «Каталог» (03.11) – ссылка на главную каталога: клик ведёт туда, меню раскрывается наведением
       (с клавиатуры – стрелкой вниз) */
    if (t.closest('[data-toggle="mega"]')) return;
    if (t.closest('[data-mega-close]')) { setMega(false); if (catalogBtn) catalogBtn.focus(); return; }
    if (megaOpen() && !t.closest('#mega')) setMega(false);
    var catBtn = t.closest('.ig-mega__cat');
    if (catBtn) { showMegaPanel(catBtn); return; }

    /* «В корзину», счётчик, избранное и «Сообщить о поступлении» новой карточки — в render.js (design-lab, 21.10) */

    /* стрелки рядов (чипы групп, баннеры подкатегорий) листают целую страницу ряда */
    var arr = t.closest('[data-scroll]');
    if (arr) {
      var wrap = arr.closest('.ig-directions__wrap');
      var track = wrap && wrap.querySelector('.ig-directions__track');
      if (track) pageScroll(wrap, track, parseInt(arr.getAttribute('data-scroll') || '1', 10));
      return;
    }
  });

  /* листание ряда страницей: вперёд — первый не до конца видный справа элемент встаёт к левому краю,
     сразу за стрелкой «назад»; назад — последний не до конца видный слева элемент встаёт к правому краю,
     перед стрелкой «вперёд». Края и стрелки учитываются, дальше края ряда не листаем */
  function pageScroll(wrap, track, dir) {
    var cs = getComputedStyle(track);
    var padL = parseFloat(cs.scrollPaddingLeft) || parseFloat(cs.paddingLeft) || 0;
    var padR = parseFloat(cs.scrollPaddingRight) || parseFloat(cs.paddingRight) || 0;
    var tr = track.getBoundingClientRect();
    var GAP = 8;
    /* сколько места у края занимает стрелка (у скрытой стрелки размеры есть, у стрелок на телефоне — нет) */
    var la = wrap.querySelector('.ig-directions__arrow--left'), ra = wrap.querySelector('.ig-directions__arrow--right');
    var lr = la ? la.getBoundingClientRect() : null, rr = ra ? ra.getBoundingClientRect() : null;
    var resL = lr && lr.width ? Math.max(0, lr.right - (tr.left + padL)) + GAP : 0;
    var resR = rr && rr.width ? Math.max(0, (tr.right - padR) - rr.left) + GAP : 0;
    var x = track.scrollLeft, w = track.clientWidth, max = track.scrollWidth - w;
    var items = Array.prototype.map.call(track.children, function (el) {
      var r = el.getBoundingClientRect();
      return { l: r.left - tr.left + x, r: r.right - tr.left + x };
    });
    var target, i;
    if (dir > 0) {
      var edgeR = x + w - padR - resR;
      var next = null;
      for (i = 0; i < items.length; i++) if (items[i].r > edgeR + 1) { next = items[i]; break; }
      target = next ? next.l - padL - resL : max;
    } else {
      var edgeL = x + padL + resL;
      var prev = null;
      for (i = items.length - 1; i >= 0; i--) if (items[i].l < edgeL - 1) { prev = items[i]; break; }
      target = prev ? prev.r - (w - padR - resR) : 0;
    }
    /* элемент шире видимой части — тогда листаем на ширину видимой части */
    if (Math.abs(target - x) < 2) target = x + dir * (w - padL - padR - resL - resR);
    track.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: 'smooth' });
  }

  function parsePrice(txt) { return parseInt((txt || '').replace(/[^0-9]/g, ''), 10) || 0; }
  function fmtPrice(n) { return n.toLocaleString('ru-RU') + '\u00a0₽'; }
  function unitPrice(card) {
    var pe = card && card.querySelector('.ig-card__price');
    return pe ? parseInt(pe.getAttribute('data-unit') || '', 10) || parsePrice(pe.textContent) : 0;
  }
  function updatePrice(card, qty) {
    var pe = card && card.querySelector('.ig-card__price');
    if (!pe || !/\d/.test(pe.textContent)) return;
    var unit = parseInt(pe.getAttribute('data-unit') || '', 10);
    if (!unit) { unit = parsePrice(pe.textContent); pe.setAttribute('data-unit', unit); }
    pe.textContent = fmtPrice(unit * qty);
  }

  function showMegaPanel(catBtn) {
    if (!megaEl || catBtn.classList.contains('is-active')) return;
    megaEl.querySelectorAll('.ig-mega__cat').forEach(function (c) { c.classList.remove('is-active'); });
    catBtn.classList.add('is-active');
    moveMarker(catBtn, false);
    var key = catBtn.getAttribute('data-cat');
    megaEl.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== key; });
  }
  window.addEventListener('resize', function () {
    if (megaEl) moveMarker(megaEl.querySelector('.ig-mega__cat.is-active'), true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' && catalogBtn && e.target === catalogBtn && megaEl) {
      e.preventDefault();
      setMega(true);
      var firstCat = megaEl.querySelector('.ig-mega__cat.is-active') || megaEl.querySelector('.ig-mega__cat');
      if (firstCat) firstCat.focus();
      return;
    }
    if (e.key === 'Escape') {
      closeAll();
      if (megaOpen()) { setMega(false); if (catalogBtn) catalogBtn.focus(); }
    }
  });

  /* каталог и табы мега-меню раскрываются по наведению */
  if (catalogBtn && megaEl && mainnav) {
    catalogBtn.addEventListener('mouseenter', function () {
      if (!megaOpen()) { setMega(true); megaByHover = true; }
    });
    mainnav.addEventListener('mouseleave', function () { setMega(false); });
    mainnav.querySelectorAll('.ig-navlink').forEach(function (link) {
      if (link === catalogBtn) return;
      link.addEventListener('mouseenter', function () { setMega(false); });
    });
    megaEl.querySelectorAll('.ig-mega__cat').forEach(function (cat) {
      cat.addEventListener('mouseenter', function () { showMegaPanel(cat); });
    });
  }

  /* значения быстрых фильтров начинаются по левому краю первого чипа бренда (--qf-indent),
     подписи строк выровнены вправо и кончаются по правому краю кнопки «Фильтры» (--qf-label-w) */
  var alignQf = function () {
    document.querySelectorAll('.ig-qf').forEach(function (qf) {
      var toolbar = document.querySelector('.ig-toolbar');
      var left = toolbar && toolbar.querySelector('.ig-toolbar__left');
      if (!left) return;
      var chip = left.querySelector('.igro-tag');
      var btn = left.querySelector('.ig-filters-btn');
      /* чипов в строке может не быть (в разделе один бренд) — тогда отступ считаем от кнопки «Фильтры» */
      var indent = chip
        ? chip.getBoundingClientRect().left - left.getBoundingClientRect().left
        : (btn ? btn.getBoundingClientRect().right - left.getBoundingClientRect().left + 16 : 0);
      if (indent > 0) qf.style.setProperty('--qf-indent', Math.round(indent) + 'px');
      if (btn) qf.style.setProperty('--qf-label-w', Math.round(btn.getBoundingClientRect().right - left.getBoundingClientRect().left) + 'px');
    });
  };
  alignQf();
  window.addEventListener('resize', alignQf);
  window.addEventListener('load', alignQf);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignQf);
  var qfHost = document.getElementById('ig-qf');
  var tbHost = document.getElementById('ig-tb');
  if (window.MutationObserver && qfHost && tbHost) {
    var mo = new MutationObserver(function () { alignQf(); });
    mo.observe(qfHost, { childList: true, subtree: true });
    mo.observe(tbHost, { childList: true, subtree: true });
  }

  /* полоса направлений: стрелки и запомненная позиция прокрутки */
  document.querySelectorAll('.ig-directions__wrap').forEach(function (wrap) {
    var track = wrap.querySelector('.ig-directions__track');
    var leftBtn = wrap.querySelector('.ig-directions__arrow--left');
    var rightBtn = wrap.querySelector('.ig-directions__arrow--right');
    if (!track) return;
    var update = function () {
      var max = track.scrollWidth - track.clientWidth;
      if (leftBtn) leftBtn.hidden = track.scrollLeft <= 1;
      if (rightBtn) rightBtn.hidden = track.scrollLeft >= max - 1;
      /* затемнение краёв ряда баннеров: слева — когда ряд прокручен, справа — пока он не дошёл до конца */
      wrap.classList.toggle('is-scrolled', track.scrollLeft > 1);
      wrap.classList.toggle('is-end', track.scrollLeft >= max - 1);
    };
    /* позиция полосы принадлежит конкретной странице: возврат в категорию
       из другого раздела всегда открывает табы с начала */
    var key = 'ig-dirs-scroll:' + location.pathname + location.search;
    var save = function () { try { sessionStorage.setItem(key, String(Math.round(track.scrollLeft))); } catch (err) {} };
    var max = track.scrollWidth - track.clientWidth;
    var saved = null;
    try {
      if (sessionStorage.getItem('ig-dirs-last') === key) saved = sessionStorage.getItem(key);
      else sessionStorage.removeItem(key);
      sessionStorage.setItem('ig-dirs-last', key);
    } catch (err2) {}
    var prevBehavior = track.style.scrollBehavior;
    track.style.scrollBehavior = 'auto';
    if (saved !== null && !isNaN(parseFloat(saved))) track.scrollLeft = Math.max(0, Math.min(max, parseFloat(saved)));
    track.addEventListener('scroll', function () { update(); save(); });
    window.addEventListener('resize', update);
    track.addEventListener('click', save);
    window.addEventListener('pagehide', save);
    var act = track.querySelector('[aria-current="page"]');
    if (act) {
      var pad = 24, l = act.offsetLeft, r = l + act.offsetWidth;
      if (l < track.scrollLeft + pad || r > track.scrollLeft + track.clientWidth - pad) {
        track.scrollLeft = Math.max(0, Math.min(max, l - (track.clientWidth - act.offsetWidth) / 2));
      }
    }
    requestAnimationFrame(function () { track.style.scrollBehavior = prevBehavior || ''; });
    update();
  });

  /* ---------- шапка поверх баннера: три состояния (эксперимент design-lab, 21.10.2026) ----------
     1. Полная — пока страница в начале: квадратный логотип, поиск, меню. Не закреплена: уходит вверх
        вместе со страницей (сдвиг transform, слот шапки нулевой высоты прилипает к верху окна).
     2. Компактная — как только полная ушла из виду (прокрутка ниже её низа): выезжает сверху, горизонтальный
        логотип и иконки (is-compact). Прокрутка вниз — меню спрятано (is-collapsed).
     3. Компактная с меню — прокрутка вверх ниже первого экрана: под компактной строкой выезжают меню и
        панель фильтров; в полную шапка возвращается, только когда страница снова в начале.
     is-clear — страница в самом верху: шапка прозрачная; is-on-dark — баннер тёмный, текст белый.
     --mast-h — высота полной шапки (на столько баннер уходит под неё); --tb-top — где встаёт панель фильтров */
  var mast = document.querySelector('[data-mast]');
  if (mast) {
    var docEl = document.documentElement;
    var heroEl = document.querySelector('#page > .ig-cathero, #page > .ig-hero');
    /* тёмный баннер: сцена категории или фон подкатегории с пометкой ig-hero--dark (render.js, HERO_DARK) */
    /* 04.11: сцена категории со светлым фоном (ig-cathero--light, render.js CATHERO_LIGHT – «Косметология») – шапка с тёмным текстом */
    mast.classList.toggle('is-on-dark', !!(heroEl && ((heroEl.classList.contains('ig-cathero') && !heroEl.classList.contains('ig-cathero--light')) || heroEl.classList.contains('ig-hero--dark'))));
    var lastY = window.scrollY, mastTick = false;
    var mastSlot = mast.parentNode;
    var mastNav = mast.querySelector('.ig-mainnav');
    var fullH = mast.offsetHeight, compactH = 60, navH = 40, navTopFull = 0;
    /* телефон (v8, 24.11, Figma C-1/C-2): сжатая шапка – строка 56 px «бургер – поиск – телефон», при прокрутке
       вверх – строка логотипа и поиск под ней (ещё 56 px); полоса категорий – только в полной шапке */
    var mqPhone = window.matchMedia('(max-width: 767px)');
    var PHONE_ROW = 56;
    var setMastH = function () {
      if (mast.classList.contains('is-compact')) return;
      if (mqPhone.matches) { compactH = PHONE_ROW; navH = PHONE_ROW; }
      fullH = mast.offsetHeight;
      docEl.style.setProperty('--mast-h', fullH + 'px');
      var inner = mastNav && mastNav.querySelector('.ig-mainnav__inner');
      if (inner && inner.offsetHeight) navH = inner.offsetHeight;
      /* верх плашки меню в полной шапке – от верха шапки */
      if (inner) navTopFull = inner.getBoundingClientRect().top - mast.getBoundingClientRect().top;
    };
    /* высота компактной строки — когда шапка досжалась */
    mast.addEventListener('transitionend', function (e) {
      if (e.target === mastNav && mast.classList.contains('is-collapsed') && !mqPhone.matches) compactH = mast.offsetHeight;
    });
    var isCompact = function () { return mast.classList.contains('is-compact'); };
    var isCollapsed = function () { return mast.classList.contains('is-collapsed'); };
    var collapseMast = function (on) {
      if (isCollapsed() === on) return;
      if (on && megaOpen()) setMega(false);
      mast.classList.toggle('is-collapsed', on);
    };
    var setCompact = function (on) {
      if (isCompact() === on) return;
      if (megaOpen()) setMega(false);
      if (on) {
        /* компактная выезжает сверху */
        mast.style.transform = '';
        mast.classList.add('is-compact', 'was-compact', 'is-entering');
        mast.getBoundingClientRect();
        requestAnimationFrame(function () { mast.classList.remove('is-entering'); });
      } else {
        /* компактная не уезжает, а пропадает сразу (27.10): переход – в момент, когда меню полной шапки
           доехало до места меню компактной, поэтому под ней уже стоит такое же меню полной шапки */
        mast.classList.add('no-anim');
        /* was-compact снимается тоже: иначе после no-anim запускалась анимация смены логотипа – «ИГРО» моргало (27.10) */
        mast.classList.remove('is-compact', 'is-entering', 'was-compact');
        mast.getBoundingClientRect();
        requestAnimationFrame(function () { requestAnimationFrame(function () { mast.classList.remove('no-anim'); }); });
      }
    };
    /* где стоит панель фильтров: под компактной строкой и меню */
    var tbTop = function () { return compactH + navH; };
    /* низ видимой шапки — до него панель фильтров стоит на месте */
    var mastBottom = function () {
      if (isCompact()) return isCollapsed() ? compactH : compactH + navH;
      return Math.max(0, mastSlot.getBoundingClientRect().top) + fullH - fullOffset;
    };
    var fullOffset = 0;

    /* панель фильтров (референс goldapple.ru/volosy): пока её место ниже шапки — стоит на месте; ушла под
       шапку — закрепляется под компактной шапкой с меню, секция держит её высоту (страница не прыгает).
       Прокрутка вниз — уезжает вверх вместе с меню, вверх — выезжает */
    var tbSec = document.querySelector('.ig-toolbar');
    var tbPanel = tbSec && tbSec.querySelector('[data-tbpanel]');
    var tbStuck = false;
    var slideFrom = function (fromTop) {
      var d = fromTop - tbPanel.getBoundingClientRect().top;
      if (Math.abs(d) < 1) return;
      tbPanel.classList.add('is-instant');
      tbPanel.style.transform = 'translateY(' + Math.round(d) + 'px)';
      tbPanel.getBoundingClientRect();
      tbPanel.classList.remove('is-instant');
      tbPanel.style.transform = '';
    };
    var placeTb = function () {
      if (!tbPanel) return;
      docEl.style.setProperty('--tb-top', tbTop() + 'px');
      var hide = isCompact() && isCollapsed();
      /* прокрутка вниз (шапка свёрнута): панель уезжает вместе со страницей под шапку и закрепляется спрятанной,
         только когда целиком ушла под неё – без пустого места в странице (замечание 23.10);
         прокрутка вверх (шапка с меню): закрепляется, как только её место ушло под шапку, и выезжает */
      var secRect = tbSec.getBoundingClientRect();
      var stick = hide ? secRect.bottom < mastBottom() : secRect.top < mastBottom() - 1;
      if (stick === tbStuck) {
        if (stick) tbPanel.classList.toggle('is-hidden', hide);
        return;
      }
      tbStuck = stick;
      var wasTop = tbPanel.getBoundingClientRect().top;
      var wasShown = !tbPanel.classList.contains('is-hidden');
      if (stick) {
        tbSec.style.height = tbPanel.offsetHeight + 'px';
        if (hide) {
          /* место панели уже под шапкой — закрепляется сразу спрятанной */
          tbPanel.classList.add('is-instant', 'is-stuck', 'is-hidden');
          requestAnimationFrame(function () { requestAnimationFrame(function () { tbPanel.classList.remove('is-instant'); }); });
        } else {
          tbPanel.classList.add('is-stuck');
          tbPanel.classList.remove('is-hidden');
          slideFrom(wasTop);
        }
      } else {
        tbPanel.classList.remove('is-stuck', 'is-hidden');
        tbSec.style.height = '';
        if (wasShown) slideFrom(wasTop);
      }
    };
    /* фильтры поменялись в закреплённой панели — место в странице под её новую высоту */
    if (tbPanel && window.ResizeObserver) {
      new ResizeObserver(function () { if (tbStuck) tbSec.style.height = tbPanel.offsetHeight + 'px'; }).observe(tbPanel);
    }
    var onMastScroll = function () {
      mastTick = false;
      var y = Math.max(0, window.scrollY), dy = y - lastY;
      /* естественное место шапки – под плашкой со скидкой (offsetTop у прилипшего слота уже сдвинут) */
      var bar = document.querySelector('.ig-topbar');
      var slotTop = bar ? bar.offsetHeight : 0;
      /* полная шапка ушла из виду целиком — компактная; при прокрутке вверх компактная с меню держится, пока
         меню полной шапки не доедет до места меню компактной (верх плашки – 60 px от верха окна), и пропадает
         без анимации – под ней на той же высоте уже меню полной шапки (27.10; до того её копия уезжала вверх,
         граница была по низу шапок) */
      var compact = isCompact()
        ? (mqPhone.matches
            /* телефон: сжатая с логотипом держится, пока полная не встала на место целиком – строки логотипа
               и поиска у них на одной высоте, при смене добавляется только полоса категорий */
            ? y > slotTop + (isCollapsed() ? fullH - compactH : 0)
            : y > slotTop + (isCollapsed() ? fullH : navTopFull) - compactH)
        : y > slotTop + fullH;
      setCompact(compact);
      /* полная шапка всегда прозрачная (белая – только при наведении, фокусе или открытом каталоге), компактная – белая */
      mast.classList.toggle('is-clear', !compact);
      if (compact) {
        fullOffset = 0;
        if (dy > 0) collapseMast(true);
        else if (dy < 0) collapseMast(false);
      } else {
        collapseMast(false);
        /* полная шапка уходит вверх вместе со страницей */
        fullOffset = Math.min(fullH, Math.max(0, y - slotTop));
        mast.style.transform = fullOffset ? 'translateY(' + (-fullOffset) + 'px)' : '';
      }
      lastY = y;
      placeTb();
      /* низ видимой шапки – под ним на телефоне встают уведомления (v8, 24.11) */
      docEl.style.setProperty('--mhead-b', Math.round(mastBottom()) + 'px');
    };
    window.addEventListener('scroll', function () {
      if (!mastTick) { mastTick = true; requestAnimationFrame(onMastScroll); }
    }, { passive: true });
    window.addEventListener('resize', function () { setMastH(); placeTb(); });
    window.addEventListener('load', setMastH);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setMastH);
    setMastH();
    onMastScroll();
    /* иконка поиска в компактной шапке — наверх, к полю поиска */
    mast.addEventListener('click', function (e) {
      if (!e.target.closest('[data-search-open]')) return;
      var input = mast.querySelector('.igro-search__input');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function () { if (input) input.focus({ preventScroll: true }); }, 350);
    });
  }

  /* главная (03.11): лента «Лучшее предложение» – стрелки листают на ширину ленты, у края стрелка гаснет */
  var offers = document.querySelector('[data-offers-track]');
  if (offers) {
    var offWrap = offers.parentNode;
    var offArrows = function () {
      var max = offers.scrollWidth - offers.clientWidth - 8;   /* запас на округление ширины колонок */
      offWrap.querySelector('[data-offers="-1"]').disabled = offers.scrollLeft <= 8;
      offWrap.querySelector('[data-offers="1"]').disabled = offers.scrollLeft >= max;
    };
    offWrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-offers]');
      if (b) offers.scrollBy({ left: +b.getAttribute('data-offers') * offers.clientWidth, behavior: 'smooth' });
    });
    offers.addEventListener('scroll', offArrows, { passive: true });
    window.addEventListener('resize', offArrows);
    offArrows();
  }
  /* ---------- меню телефона (v8, 24.11.2026) – Figma 3655:30226, экраны C-3…C-6 ----------
     Шторка снизу на подложке House 45 %: «Меню» (вход, плитки разделов сайта, телефоны) → «Каталог» (разделы) →
     раздел («Все товары раздела» и подкатегории) → подкатегория («Все товары подкатегории» и группы).
     Следующий экран въезжает справа, предыдущий уходит влево (C-5); «‹» – назад. Закрывают крестик, подложка,
     Esc и свайп шторки вниз. Открывают бургер (экран «Меню») и «Каталог» в полосе категорий (сразу «Каталог») */
  (function () {
    var D = window.IG_DATA;
    var mq = window.matchMedia('(max-width: 767px)');
    if (!D || !D.nodes || !document.querySelector('[data-mburger]')) return;
    var q = new URLSearchParams(location.search), keep = [];
    if (q.get('cards') === 'sku') keep.push('cards=sku');
    ['mf', 'mfs'].forEach(function (k) { if (q.get(k)) keep.push(k + '=' + encodeURIComponent(q.get(k))); });
    var href = function (h) { return !h || h === '#' || !keep.length ? (h || '#') : h + (h.indexOf('?') > -1 ? '&' : '?') + keep.join('&'); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    /* разделы – подписи и порядок как в полосе категорий и в макете C-4 */
    var CATS = [['Для волос', 'hair'], ['Депиляция', 'depilation'], ['Брови и ресницы', 'brows'], ['Косметология', 'cosmetology'],
      ['Ногтевой сервис', 'nails'], ['Загар', 'tanning'], ['Одноразовая продукция', 'disposable'], ['Дезинфекция', 'disinfection']];
    var catLabel = {};
    CATS.forEach(function (c) { catLabel[c[1]] = c[0]; });
    /* разделы сайта – из строки меню десктопа (Акции … Контакты) */
    var siteLinks = Array.prototype.map.call(document.querySelectorAll('.ig-mainnav__list--end .ig-navlink'), function (a) {
      return [a.textContent.trim(), a.getAttribute('href') || '#'];
    });
    var tel = Array.prototype.map.call(document.querySelectorAll('.ig-topbar__contacts a[href^="tel:"]'), function (a) { return a.textContent.trim(); });
    var PHONES = ['+7 (495) 109-33-33', '+7 (495) 988-58-59'];   /* как в макете C-3 (в плашке десктопа – первый номер дважды) */
    if (tel[0]) PHONES[0] = tel[0];
    var addrEl = document.querySelector('.ig-topbar__contacts > span');
    var ADDR = addrEl ? addrEl.textContent.trim().replace(/\.$/, '') : 'Москва, ул. Мельникова д.3к2';
    var PRO = document.querySelector('.ig-home__pro');
    var PRO_HREF = PRO ? PRO.getAttribute('href') : '#';

    var SVG_X = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
    var SVG_BACK = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M12.5 4l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    var SVG_USER = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="6.5" r="3.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3.5 17.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
    var SVG_RIGHT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5l4.5 4.5L6 12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    var SVG_GRID = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect width="5" height="5" rx="1" fill="currentColor"/><rect x="7" width="5" height="5" rx="1" fill="currentColor"/><rect y="7" width="5" height="5" rx="1" fill="currentColor"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor"/></svg>';
    var CHEV = '<span class="ig-msheet__chev" aria-hidden="true">›</span>';

    var sheet = document.createElement('div');
    sheet.className = 'ig-msheet';
    sheet.hidden = true;
    sheet.innerHTML = '<div class="ig-msheet__scrim" data-msheet-close></div>' +
      '<div class="ig-msheet__panel" role="dialog" aria-modal="true" aria-label="Меню">' +
      '<div class="ig-msheet__grab" aria-hidden="true"></div><div class="ig-msheet__views"></div></div>';
    document.body.appendChild(sheet);
    var panel = sheet.querySelector('.ig-msheet__panel');
    var viewsEl = sheet.querySelector('.ig-msheet__views');
    var stack = [];   /* [{ key, el }] */
    var opener = null;

    var head = function (title, back) {
      return '<div class="ig-msheet__head">' +
        (back ? '<button type="button" class="ig-msheet__back" data-msheet-back aria-label="Назад">' + SVG_BACK + '</button>' : '') +
        '<h2 class="ig-msheet__title">' + esc(title) + '</h2>' +
        '<button type="button" class="ig-msheet__close" data-msheet-close aria-label="Закрыть меню">' + SVG_X + '</button></div>';
    };
    var proBtn = '<div class="ig-msheet__foot"><a class="ig-msheet__pill" href="' + esc(PRO_HREF) + '">Работаем с профессионалами&nbsp;»</a></div>';
    var row = function (label, opts) {
      var cls = 'ig-msheet__row' + (opts.accent ? ' ig-msheet__row--accent' : '');
      return opts.go
        ? '<li><button type="button" class="' + cls + '" data-msheet-go="' + esc(opts.go) + '"><span>' + esc(label) + '</span>' + CHEV + '</button></li>'
        : '<li><a class="' + cls + '" href="' + esc(href(opts.href)) + '"><span>' + esc(label) + '</span>' + CHEV + '</a></li>';
    };
    var build = function (key, back) {
      var p = key.split(':'), html;
      if (p[0] === 'menu') {
        html = head('Меню', back) + '<div class="ig-msheet__body">' +
          '<a class="ig-msheet__login" href="#">' + SVG_USER + '<span>Вход / Регистрация</span>' + SVG_RIGHT + '</a>' +
          '<div class="ig-msheet__tiles">' +
          '<button type="button" class="ig-msheet__tile ig-msheet__tile--main" data-msheet-go="catalog">' + SVG_GRID + '<span>Каталог</span></button>' +
          siteLinks.map(function (l) { return '<a class="ig-msheet__tile" href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('') +
          '</div>' +
          '<div class="ig-msheet__contacts">' +
          PHONES.map(function (t) { return '<a class="ig-msheet__pill ig-msheet__pill--phone" href="tel:' + t.replace(/[^\d+]/g, '') + '">' + esc(t) + '</a>'; }).join('') +
          '<p class="ig-msheet__addr">' + esc(ADDR) + '</p></div></div>';
      } else if (p[0] === 'catalog') {
        html = head('Каталог', back) + '<div class="ig-msheet__body"><ul class="ig-msheet__list ig-msheet__list--cats">' +
          CATS.map(function (c) { return row(c[0], { go: 'cat:' + c[1] }); }).join('') + '</ul></div>' + proBtn;
      } else {
        var n = D.nodes[p[1]];
        if (!n) return null;
        var title = p[0] === 'cat' ? (catLabel[n.id] || n.title) : n.title;
        html = head(title, back) + '<div class="ig-msheet__body"><ul class="ig-msheet__list">' +
          row(p[0] === 'cat' ? 'Все товары раздела' : 'Все товары подкатегории', { href: n.href, accent: true }) +
          (n.kids || []).map(function (id) {
            var k = D.nodes[id];
            if (!k) return '';
            return (k.kids && k.kids.length) ? row(k.title, { go: 'sub:' + k.id }) : row(k.title, { href: k.href });
          }).join('') + '</ul></div>' + proBtn;
      }
      var v = document.createElement('section');
      v.className = 'ig-msheet__view';
      v.setAttribute('data-key', key);
      v.innerHTML = html;
      return v;
    };
    var calm = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
    var focusIn = function (v) {
      var f = v.querySelector('.ig-msheet__back') || v.querySelector('.ig-msheet__close');
      if (f) f.focus({ preventScroll: true });
    };
    /* переход между экранами: новый справа, старый влево; назад – наоборот */
    var push = function (key, instant) {
      var v = build(key, stack.length > 0);
      if (!v) return;
      var prev = stack.length ? stack[stack.length - 1].el : null;
      viewsEl.appendChild(v);
      stack.push({ key: key, el: v });
      panel.setAttribute('aria-label', v.querySelector('.ig-msheet__title').textContent);
      if (!prev || instant || calm()) {
        if (prev) prev.classList.add('is-left');
        focusIn(v);
        return;
      }
      v.classList.add('is-right');
      v.getBoundingClientRect();
      v.classList.remove('is-right');
      prev.classList.add('is-left');
      focusIn(v);
    };
    var pop = function () {
      if (stack.length < 2) return;
      var cur = stack.pop().el, prev = stack[stack.length - 1].el;
      panel.setAttribute('aria-label', prev.querySelector('.ig-msheet__title').textContent);
      prev.classList.remove('is-left');
      var done = function () { if (cur.parentNode) cur.parentNode.removeChild(cur); };
      if (calm()) done();
      else { cur.classList.add('is-right'); cur.addEventListener('transitionend', done, { once: true }); setTimeout(done, 500); }
      focusIn(prev);
    };
    var isOpen = function () { return !sheet.hidden && sheet.classList.contains('is-open'); };
    var open = function (keys, from) {
      if (!mq.matches) return;
      opener = from || null;
      /* уведомления закрываются – иначе ложатся поверх меню */
      Array.prototype.forEach.call(document.querySelectorAll('.igro-toast-region__item'), function (li) { li.remove(); });
      viewsEl.innerHTML = '';
      stack = [];
      keys.forEach(function (k) { push(k, true); });
      sheet.hidden = false;
      panel.style.transform = '';
      document.documentElement.classList.add('has-msheet');
      sheet.getBoundingClientRect();
      sheet.classList.add('is-open');
      focusIn(stack[stack.length - 1].el);   /* фокус – когда шторка уже видна */
      var b = document.querySelector('[data-mburger]');
      if (b) b.setAttribute('aria-expanded', 'true');
    };
    var close = function (fromDrag) {
      if (sheet.hidden) return;
      sheet.classList.remove('is-open');
      panel.style.transform = fromDrag === true ? 'translateY(100%)' : '';   /* после свайпа – вниз с того места, где отпустили */
      document.documentElement.classList.remove('has-msheet');
      var b = document.querySelector('[data-mburger]');
      if (b) b.setAttribute('aria-expanded', 'false');
      var hide = function () { if (!sheet.classList.contains('is-open')) sheet.hidden = true; };
      if (calm()) hide(); else setTimeout(hide, 320);
      if (opener) opener.focus({ preventScroll: true });
    };

    /* открытие – раньше остальных обработчиков (фаза перехвата): ссылка «Каталог» на телефоне не уводит на страницу */
    document.addEventListener('click', function (e) {
      var t = e.target;
      var burger = t.closest('[data-mburger]');
      if (burger) { e.preventDefault(); e.stopPropagation(); if (isOpen()) close(); else open(['menu'], burger); return; }
      var cat = mq.matches && t.closest('.ig-mast [data-toggle="mega"]');
      if (cat) { e.preventDefault(); e.stopPropagation(); open(['menu', 'catalog'], cat); }
    }, true);
    sheet.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-msheet-close]')) { close(); return; }
      if (t.closest('[data-msheet-back]')) { pop(); return; }
      var go = t.closest('[data-msheet-go]');
      if (go) { push(go.getAttribute('data-msheet-go')); return; }
      var a = t.closest('a[href]');
      if (a && a.getAttribute('href') === '#') { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); if (stack.length > 1 && e.shiftKey) pop(); else close(); }
    }, true);
    mq.addEventListener('change', function () { if (!mq.matches) close(); });

    /* свайп вниз за ручку и строку заголовка – шторка едет за пальцем; дальше 100 px или быстро – закрывается */
    var drag = null;
    panel.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.ig-msheet__grab, .ig-msheet__head') || e.target.closest('button')) return;
      drag = { y: e.clientY, t: Date.now(), dy: 0 };
      panel.setPointerCapture(e.pointerId);
      panel.classList.add('is-dragging');
    });
    panel.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.dy = Math.max(0, e.clientY - drag.y);
      panel.style.transform = 'translateY(' + drag.dy + 'px)';
    });
    var endDrag = function () {
      if (!drag) return;
      var fast = drag.dy > 30 && drag.dy / Math.max(1, Date.now() - drag.t) > 0.6;
      var far = drag.dy > 100;
      panel.classList.remove('is-dragging');
      drag = null;
      if (far || fast) close(true); else panel.style.transform = '';
    };
    panel.addEventListener('pointerup', endDrag);
    panel.addEventListener('pointercancel', endDrag);
  })();
})();
