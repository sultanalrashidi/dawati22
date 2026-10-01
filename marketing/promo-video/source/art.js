// Graphic (non-capture) elements for the promo: all line-art in the brand palette.
(() => {
  const { h, ease, inv, clamp, env, lerp, kf } = E;
  const svg = (w, hh, inner, cls = '') => {
    const d = h('div', { class: 'svgwrap ' + cls, html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}">${inner}</svg>` });
    return d;
  };

  // ---------------------------------------------------------------- dock chip (callback question → ✓)
  function dockChip(parent, text) {
    const chk = h('span', { class: 'chk' }, '✓');
    const el = h('div', { class: 'dock-chip' }, h('span', { class: 'q' }, text), chk);
    parent.append(el);
    return {
      el,
      // t0 appear at `from`, travel to `to` by tDock, turn gold, dissolve at tOut
      at(t, { t0, from, to, tDock, tOut, hold = false }) {
        if (t < t0 || t > tOut + 0.45) { el.style.display = 'none'; return; }
        el.style.display = 'inline-flex';
        const tgt = typeof to === 'function' ? to() : to;
        const pIn = ease.outBack(inv(t0, t0 + 0.35, t));
        const pMove = ease.inOut(inv(t0 + 0.2, tDock, t));
        const x = lerp(from[0], tgt[0], pMove), y = lerp(from[1], tgt[1], pMove);
        const done = t >= tDock;
        el.classList.toggle('done', done);
        const pc = ease.outBack(inv(tDock, tDock + 0.3, t));
        chk.style.transform = `scale(${done ? pc : 0})`;
        chk.style.width = done ? '52px' : '0px';
        const out = hold ? 0 : ease.in(inv(tOut, tOut + 0.4, t));
        const pop = done ? 1 + 0.12 * Math.sin(Math.PI * clamp((t - tDock) / 0.3)) : 1;
        el.style.opacity = clamp(pIn) * (1 - out);
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${(0.7 + 0.3 * pIn) * pop * (1 - 0.3 * out)})`;
      },
    };
  }

  // ---------------------------------------------------------------- centred tag chip
  function tag(parent, text, y, cls = '') {
    const wrap = h('div', { class: 'tagwrap', style: { top: y + 'px' } });
    const el = h('div', { class: 'tag ' + cls }, text);
    wrap.append(el);
    parent.append(wrap);
    return {
      el, wrap,
      at(t, t0, t1) {
        const o = env(t, t0, t1, 0.3, 0.3);
        wrap.style.display = o <= 0 ? 'none' : 'block';
        wrap.style.opacity = o;
        el.style.transform = `translateY(${(1 - ease.outQuint(inv(t0, t0 + 0.4, t))) * 14}px)`;
      },
      set(txt) { if (el.textContent !== txt) el.textContent = txt; },
    };
  }

  // ---------------------------------------------------------------- notes page (G2)
  function notesPage(parent, lines, { w = 700 } = {}) {
    const el = h('div', { class: 'notes', style: { width: w + 'px' } });
    const title = h('div', { class: 'notes-title' }, 'قائمة المعازيم');
    el.append(title);
    const ls = lines.map(l => { const d = h('div', { class: 'notes-line' }, l); el.append(d); return d; });
    const pen = h('div', { class: 'pen', html: `<svg viewBox="0 0 700 640" width="${w}" height="${w * 640 / 700}">
      <ellipse class="c1" cx="360" cy="168" rx="85" ry="38" fill="none" stroke="#B3403A" stroke-width="5" stroke-linecap="round" pathLength="1"/>
      <ellipse class="c2" cx="495" cy="428" rx="48" ry="34" fill="none" stroke="#B3403A" stroke-width="5" stroke-linecap="round" pathLength="1"/>
      <path class="c3" d="M425 292 C 365 302, 305 302, 250 294" fill="none" stroke="#B3403A" stroke-width="5" stroke-linecap="round" pathLength="1"/>
      <path class="c4" d="M470 520 q 30 40 80 30" fill="none" stroke="#B3403A" stroke-width="5" stroke-linecap="round" pathLength="1"/>
    </svg>` });
    el.append(pen);
    parent.append(el);
    const circles = [...pen.querySelectorAll('ellipse,path')];
    circles.forEach(c => { c.style.strokeDasharray = '1'; c.style.strokeDashoffset = '1'; c.style.opacity = '.75'; });
    return {
      el, ls, circles,
      lines(t, t0, stagger = 0.12) { ls.forEach((l, i) => { const p = ease.outQuint(inv(t0 + i * stagger, t0 + i * stagger + 0.35, t)); l.style.opacity = p; l.style.transform = `translateX(${(1 - p) * -20}px)`; }); },
      draw(t, times) { circles.forEach((c, i) => { c.style.strokeDashoffset = 1 - ease.inOut(inv(times[i], times[i] + 0.35, t)); }); },
    };
  }

  // ---------------------------------------------------------------- hall doorway (G3)
  function doorway(parent) {
    const d = svg(760, 1000, `
      <defs><radialGradient id="glow" cx="50%" cy="62%" r="60%"><stop offset="0" stop-color="#FFE7B0" stop-opacity=".95"/><stop offset=".55" stop-color="#F6D48E" stop-opacity=".5"/><stop offset="1" stop-color="#F6D48E" stop-opacity="0"/></radialGradient></defs>
      <path d="M150 980 V430 Q150 150 380 90 Q610 150 610 430 V980" fill="url(#glow)" stroke="#A6863B" stroke-width="5"/>
      <path d="M185 980 V440 Q185 185 380 128 Q575 185 575 440 V980" fill="none" stroke="#C9AE6B" stroke-width="2.5"/>
      <path d="M380 128 V980" stroke="#C9AE6B" stroke-width="2" stroke-dasharray="6 10"/>
      <path d="M60 980 H700" stroke="#A6863B" stroke-width="4"/>
      <g stroke="#A6863B" stroke-width="3" fill="none">
        <path d="M70 330 v40 M50 370 h40 l-8 70 h-24 z M62 440 v24 h16 v-24"/>
        <path d="M690 330 v40 M670 370 h40 l-8 70 h-24 z M682 440 v24 h16 v-24"/>
      </g>
      <g fill="#C9AE6B"><circle cx="380" cy="70" r="7"/><circle cx="352" cy="82" r="4"/><circle cx="408" cy="82" r="4"/></g>`, 'doorway');
    parent.append(d);
    return d;
  }

  // ---------------------------------------------------------------- ivory envelope + seal (G4)
  function envelope(parent) {
    const el = h('div', { class: 'env' });
    el.append(svg(640, 420, `
      <defs><linearGradient id="envg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#F4EEE0"/></linearGradient></defs>
      <rect x="6" y="6" width="628" height="408" rx="22" fill="url(#envg)" stroke="#C9AE6B" stroke-width="4"/>
      <path d="M8 16 L320 236 L632 16" fill="none" stroke="#C9AE6B" stroke-width="4"/>
      <path d="M8 410 L250 190 M632 410 L390 190" fill="none" stroke="#E6D9B8" stroke-width="3"/>`));
    const seal = h('div', { class: 'env-seal' }, h('img', { src: 'assets/wallet-logo.png' }));
    el.append(seal);
    parent.append(el);
    return { el, seal };
  }

  // ---------------------------------------------------------------- wallet glyph (G8, generic)
  function walletGlyph(parent) {
    const d = svg(300, 250, `
      <rect x="40" y="30" width="220" height="130" rx="18" fill="#F4EEE0" stroke="#C9AE6B" stroke-width="3" transform="rotate(-6 150 95)"/>
      <rect x="40" y="48" width="220" height="130" rx="18" fill="#EFE5CF" stroke="#C9AE6B" stroke-width="3" transform="rotate(-2 150 113)"/>
      <path d="M20 110 H280 V222 Q280 240 262 240 H38 Q20 240 20 222 Z" fill="#241E12"/>
      <path d="M20 110 H280" stroke="#A6863B" stroke-width="4"/>
      <circle cx="244" cy="176" r="10" fill="#D4AF74"/>`, 'wallet');
    parent.append(d);
    return d;
  }

  // simplified pass card for the wallet beat (G8)
  function miniPass(parent) {
    const el = h('div', { class: 'mini-pass' },
      h('div', { class: 'mp-top' }, h('img', { src: 'assets/wallet-logo.png' }), h('span', {}, 'دعوتي')),
      h('div', { class: 'mp-name' }, 'أم فهد'),
      h('div', { class: 'mp-qr', html: qrSvg() }));
    parent.append(el);
    return el;
  }
  function qrSvg() {
    const r = E.prng(11); let cells = '';
    for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
      const finder = (x < 5 && y < 5) || (x > 11 && y < 5) || (x < 5 && y > 11);
      if (finder) continue;
      if (r() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    const f = (x, y) => `<rect x="${x}" y="${y}" width="5" height="5" fill="none" stroke="#241E12" stroke-width="1"/><rect x="${x + 1.5}" y="${y + 1.5}" width="2" height="2"/>`;
    return `<svg viewBox="-1 -1 19 19" width="120" height="120"><g fill="#241E12">${cells}${f(0.5, 0.5)}${f(11.5, 0.5)}${f(0.5, 11.5)}</g></svg>`;
  }

  // ---------------------------------------------------------------- petals
  function petals(parent, n = 14, seed = 9, area = [0, 0, 1080, 1920]) {
    const r = E.prng(seed);
    const box = h('div', { class: 'petals' });
    const ps = Array.from({ length: n }, () => {
      const d = h('i');
      const s = 18 + r() * 22;
      Object.assign(d.style, { width: s + 'px', height: s * 0.62 + 'px' });
      box.append(d);
      return { d, x: area[0] + r() * (area[2] - area[0]), y: area[1] + r() * (area[3] - area[1]), vy: 40 + r() * 60, vx: -30 + r() * 60, rot: r() * 360, vr: -90 + r() * 180, ph: r() * 6.28 };
    });
    parent.append(box);
    return {
      el: box,
      at(t, o = 1) {
        box.style.opacity = o;
        ps.forEach(p => {
          const y = p.y + p.vy * t, x = p.x + p.vx * t + Math.sin(t * 1.3 + p.ph) * 26;
          p.d.style.transform = `translate(${x}px, ${y}px) rotate(${p.rot + p.vr * t}deg) rotateX(${Math.sin(t * 2 + p.ph) * 60}deg)`;
        });
      },
    };
  }

  // ---------------------------------------------------------------- spark
  function spark(parent) {
    const el = h('div', { class: 'spark' });
    parent.append(el);
    return {
      el,
      at(t, t0, t1, from, to) {
        if (t < t0 || t > t1 + 0.2) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        const p = ease.inOut(inv(t0, t1, t));
        const x = lerp(from[0], to[0], p), y = lerp(from[1], to[1], p) - Math.sin(Math.PI * p) * 220;
        const o = t > t1 ? 1 - inv(t1, t1 + 0.2, t) : 1;
        el.style.opacity = o;
        el.style.transform = `translate(${x}px, ${y}px) scale(${1 + 0.6 * Math.sin(Math.PI * p)})`;
      },
    };
  }

  // ---------------------------------------------------------------- paper plane
  function plane(parent) {
    const d = svg(90, 70, `<path d="M4 34 L86 4 L60 66 L42 42 Z" fill="#FFFDF8" stroke="#A6863B" stroke-width="3" stroke-linejoin="round"/><path d="M86 4 L42 42" stroke="#A6863B" stroke-width="3"/>`, 'plane');
    parent.append(d);
    return d;
  }

  // ---------------------------------------------------------------- payoff table (G9)
  function tableArt(parent) {
    const d = svg(900, 520, `
      <g fill="none" stroke="#A6863B" stroke-width="4" stroke-linecap="round">
        <path d="M40 430 H860"/><path d="M110 430 V510 M790 430 V510"/>
        <path d="M640 420 v-150 M615 270 h50 l-10 -40 h-30 z M600 300 h80 v110 h-80 z M620 300 v110 M660 300 v110 M640 230 v-30"/>
        <path d="M120 150 Q 450 290 780 150" stroke="#C9AE6B" stroke-width="3"/>
      </g>
      <g fill="#FFFDF8" stroke="#C9AE6B" stroke-width="2">
        ${Array.from({ length: 11 }, (_, i) => { const x = 120 + i * 66; const y = 150 + 140 * Math.sin(Math.PI * i / 10) * 0.95; return `<circle cx="${x}" cy="${y}" r="13"/><circle cx="${x}" cy="${y}" r="5" fill="#F2E3B8"/>`; }).join('')}
      </g>
      <g fill="#7B3040"><path d="M230 420 q-60 -50 -10 -70 q30 10 10 70 z"/><path d="M230 420 q60 -50 10 -70 q-30 10 -10 70 z"/><path d="M226 420 l-30 50 M234 420 l30 50" stroke="#7B3040" stroke-width="10" stroke-linecap="round"/></g>
      <rect x="360" y="396" width="190" height="34" rx="10" fill="#241E12"/>`, 'table-art');
    parent.append(d);
    return d;
  }

  // ---------------------------------------------------------------- monogram ring (end card / seal)
  function monogram(parent, size = 260) {
    const el = h('div', { class: 'mono', style: { width: size + 'px', height: size + 'px' } });
    el.append(h('img', { src: 'assets/wallet-logo.png' }));
    const ring = h('div', { class: 'mono-ring', html: `<svg viewBox="0 0 100 100" width="${size + 40}" height="${size + 40}"><circle cx="50" cy="50" r="48" fill="none" stroke="#A6863B" stroke-width="1.2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>` });
    el.append(ring);
    parent.append(el);
    return { el, circ: ring.querySelector('circle') };
  }

  // ---------------------------------------------------------------- mini chat card (G11)
  function miniChat(parent, title, msgs) {
    const el = h('div', { class: 'mini-chat' }, h('div', { class: 'mc-head' }, title));
    const items = msgs.map(m => { const b = h('div', { class: 'mc-msg' }, h('b', {}, m.from), h('span', {}, m.text)); el.append(b); return { ...m, b }; });
    parent.append(el);
    return {
      el,
      at(t, t0, t1) {
        const o = env(t, t0, t1, 0.3, 0.35);
        el.style.display = o <= 0 ? 'none' : 'block';
        el.style.opacity = o;
        el.style.transform = `translateY(${(1 - ease.outQuint(inv(t0, t0 + 0.4, t))) * 30}px)`;
        items.forEach(it => { const p = ease.outBack(inv(it.t, it.t + 0.3, t)); it.b.style.opacity = clamp(p * 1.3); it.b.style.transform = `scale(${0.8 + 0.2 * p})`; });
      },
    };
  }

  window.A = { dockChip, tag, notesPage, doorway, envelope, walletGlyph, miniPass, petals, spark, plane, tableArt, monogram, miniChat, svg };
})();
