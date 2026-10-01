// Reusable promo building blocks on top of engine.js
(() => {
  const { h, kf, env, ease, inv, clamp, lerp, arNum } = E;

  // Stylised, unbranded messenger bubble (graphic — not a WhatsApp UI clone)
  function bubble(parent, text, { side = 'in', w = null, size = 44, tone = 'cool' } = {}) {
    const el = h('div', { class: `bubble ${side} ${tone}` }, h('span', {}, text));
    if (w) el.style.maxWidth = w + 'px';
    el.style.fontSize = size + 'px';
    parent.append(el);
    return el;
  }

  // Unread badge that counts up
  function badge(parent) {
    const el = h('div', { class: 'badge' }, '٣');
    parent.append(el);
    return { el, set(n) { el.textContent = n >= 99 ? '+٩٩' : arNum(n); } };
  }

  // Answer chip: question with a gold check appearing (callback to the hook)
  function answerChip(parent, text) {
    const check = h('span', { class: 'chk' }, '✓');
    const el = h('div', { class: 'answer-chip' }, h('span', { class: 'q' }, text), check);
    parent.append(el);
    return {
      el,
      at(lt, t0, t1 = 99) {
        const a = ease.outBack(inv(t0, t0 + 0.45, lt));
        const o = env(lt, t0, t1, 0.3, 0.3);
        el.style.opacity = o;
        el.style.transform = `translateY(${(1 - a) * 30}px) scale(${0.9 + 0.1 * a})`;
        const c = ease.outBack(inv(t0 + 0.35, t0 + 0.75, lt));
        check.style.transform = `scale(${c})`;
        el.classList.toggle('done', lt > t0 + 0.4);
      },
    };
  }

  // Small label chip (e.g. «مع خيار بباركود»)
  function chip(parent, text, cls = '') {
    const el = h('div', { class: 'chip ' + cls }, text);
    parent.append(el);
    return {
      el,
      at(lt, t0, t1 = 99, dy = 16) {
        const p = ease.outQuint(inv(t0, t0 + 0.5, lt));
        el.style.opacity = env(lt, t0, t1, 0.35, 0.3);
        el.style.transform = `translateY(${(1 - p) * dy}px)`;
      },
    };
  }

  // Progress stepper: التصميم ← البيانات ← المعاينة ← التفعيل
  function stepper(parent, labels) {
    const el = h('div', { class: 'stepper' });
    const items = labels.map((l, i) => {
      const it = h('div', { class: 'step' }, h('b', {}, arNum(i + 1)), h('span', {}, l));
      el.append(it);
      if (i < labels.length - 1) el.append(h('i', { class: 'step-line' }));
      return it;
    });
    parent.append(el);
    return { el, set(active) { items.forEach((it, i) => { it.classList.toggle('on', i === active); it.classList.toggle('past', i < active); }); } };
  }

  // Brand wordmark + monogram
  function wordmark(parent, size = 240, color = 'var(--fg)') {
    const el = h('div', { class: 'wordmark', style: { fontSize: size + 'px', color } }, 'دعوتي');
    parent.append(el);
    return el;
  }

  // Super in a soft ivory card, top safe band
  function superCard(parent, text, { top = 270, size = 70, cls = '' } = {}) {
    const card = h('div', { class: 'super-card ' + cls, style: { top: top + 'px' } });
    parent.append(card);
    const w = E.words(card, text, 'super-text');
    w.el.style.fontSize = size + 'px';
    return {
      card, w,
      at(lt, t0, t1, opts = {}) {
        const o = env(lt, t0 - 0.05, t1, 0.25, 0.3);
        card.style.opacity = o;
        card.style.display = o <= 0 ? 'none' : 'block';
        const s = ease.outQuint(inv(t0 - 0.05, t0 + 0.35, lt));
        card.style.transform = `translateX(-50%) translateY(${(1 - s) * 20}px) scale(${0.97 + 0.03 * s})`;
        w.at(lt - t0, { stagger: 0.06, dur: 0.45, y: 22, blur: 6, ...opts });
      },
    };
  }

  // A 16:10 envelope art card with soft shadow
  function artCard(parent, src, w = 700) {
    const el = h('div', { class: 'art-card' }, h('img', { src }));
    el.style.width = w + 'px';
    parent.append(el);
    return el;
  }

  window.C = { bubble, badge, answerChip, chip, stepper, wordmark, superCard, artCard };
})();

// ---------------------------------------------------------------- chat phone (graphic)
(() => {
  const { h, ease, inv, clamp, arNum } = E;
  // msgs: [{t, text, from, side:'in'|'out'}] ; renders inside a phone screen element
  function chatScreen(screen, { title = 'العائلة 🤍', sub = 'أم خالد، سارة، خالتي منيرة، +٣٤', msgs = [], scale = 1 } = {}) {
    const root = h('div', { class: 'chat-screen' });
    const head = h('div', { class: 'chat-head' },
      h('div', { class: 'chat-ava' }, '👨‍👩‍👧'),
      h('div', { class: 'chat-titles' }, h('b', {}, title), h('small', {}, sub)));
    const list = h('div', { class: 'chat-list' });
    root.append(head, list);
    screen.append(root);
    const items = msgs.map(m => {
      const el = h('div', { class: 'chat-msg ' + (m.side || 'in') },
        m.from ? h('div', { class: 'from' }, m.from) : null,
        h('div', { class: 'txt' }, m.text),
        h('div', { class: 'time' }, m.time || '٩:٤١ م'));
      list.append(el);
      return { ...m, el, hgt: 0 };
    });
    let measured = false;
    return {
      root,
      at(lt) {
        if (!measured) { items.forEach(it => { it.hgt = it.el.offsetHeight + 18; }); measured = true; }
        let offset = 0;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          const p = ease.outBack(inv(it.t, it.t + 0.32, lt));
          const q = ease.outQuint(inv(it.t, it.t + 0.35, lt));
          it.el.style.opacity = clamp(p * 1.4);
          it.el.style.transform = `translateY(${-offset}px) scale(${0.85 + 0.15 * clamp(p, 0, 1.2)})`;
          if (lt >= it.t) offset += it.hgt * q;
        }
      },
    };
  }
  window.C.chatScreen = chatScreen;
})();
