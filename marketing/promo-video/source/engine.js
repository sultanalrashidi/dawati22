// Tiny deterministic motion engine: every visual is a pure function of time t.
// Scenes register a DOM subtree + update(localT, globalT). window.seek(t) drives all.
(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const inv = (a, b, t) => clamp((t - a) / (b - a));
  const ease = {
    linear: p => p,
    in: p => p * p * p,
    out: p => 1 - Math.pow(1 - p, 3),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outQuint: p => 1 - Math.pow(1 - p, 5),
    outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutQuint: p => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2),
    outBack: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    outBackSoft: p => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    spring: p => 1 - Math.exp(-6 * p) * Math.cos(9 * p),
    inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  // keyframes: [[t, value, easeName?], ...]; value may be number or array of numbers
  function kf(t, pts) {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [t1, v1, e] = pts[i];
      const [t0, v0] = pts[i - 1];
      if (t <= t1) {
        const p = (ease[e || 'inOut'])(inv(t0, t1, t));
        return Array.isArray(v0) ? v0.map((x, k) => lerp(x, v1[k], p)) : lerp(v0, v1, p);
      }
    }
    return pts[pts.length - 1][1];
  }
  // 0→1→0 envelope for a window [a,b] with fade-in/out durations
  function env(t, a, b, fin = 0.4, fout = 0.4, e = 'out') {
    if (t < a || t > b) return 0;
    const i = fin > 0 ? ease[e](inv(a, a + fin, t)) : 1;
    const o = fout > 0 ? 1 - ease.in(inv(b - fout, b, t)) : 1;
    return Math.min(i, o);
  }
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') Object.assign(el.style, v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; return el; };
  const tf = (x = 0, y = 0, s = 1, r = 0, extra = '') => `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg) ${extra}`;
  const arNum = n => Math.round(n).toLocaleString('ar-SA', { useGrouping: false });

  // seeded PRNG (mulberry32) so particle fields are identical every frame/render
  function prng(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const SCENES = [];
  const CUES = [];
  const SECTIONS = [];
  const stage = () => document.getElementById('stage');
  function scene(def) {
    def.el = h('div', { class: 'scene', 'data-scene': def.name || '' });
    if (def.z != null) def.el.style.zIndex = def.z;
    (def.parent || stage()).append(def.el);
    def.state = def.build ? def.build(def.el) || {} : {};
    def.state.el = def.el;
    SCENES.push(def);
    return def;
  }
  function cue(t, kind, gain = 1, pan = 0) { CUES.push({ t: +t.toFixed(3), kind, gain, pan }); }
  function section(name, start, end, energy) { SECTIONS.push({ name, start, end, energy }); }

  // ---------------------------------------------------------------- components
  // Split a string into word spans (never split inside an Arabic word: joining must survive)
  function words(parent, text, cls = '') {
    const box = h('div', { class: 'words ' + cls });
    const spans = [];
    let gold = false; // *several words* = gold accent; ~several words~ = small muted second line style
    let small = false;
    text.split(/(\n)/).forEach(chunk => {
      if (chunk === '\n') { box.append(h('br')); return; }
      chunk.split(/(\s+)/).forEach(w => {
        if (!w) return;
        if (/^\s+$/.test(w)) { box.append(document.createTextNode(' ')); return; }
        let word = w;
        let g = gold, sm = small;
        if (word.startsWith('*')) { g = true; gold = true; word = word.slice(1); }
        if (word.startsWith('~')) { sm = true; small = true; word = word.slice(1); }
        if (word.endsWith('*')) { gold = false; word = word.slice(0, -1); }
        if (word.endsWith('~')) { small = false; word = word.slice(0, -1); }
        if (word.endsWith('*')) { gold = false; word = word.slice(0, -1); }
        const s = h('span', { class: 'w' + (g ? ' gold' : '') + (sm ? ' small' : '') }, word);
        spans.push(s); box.append(s);
      });
    });
    parent.append(box);
    return {
      el: box, spans,
      // reveal words right-to-left in reading order; p in seconds since start
      at(lt, { stagger = 0.07, dur = 0.5, y = 26, blur = 8, out = null } = {}) {
        spans.forEach((s, i) => {
          const p = ease.outQuint(inv(i * stagger, i * stagger + dur, lt));
          let o = p;
          let yy = (1 - p) * y;
          if (out) { const q = ease.in(inv(out[0], out[0] + (out[1] || 0.35), lt)); o *= 1 - q; yy -= q * 18; }
          s.style.opacity = o;
          s.style.transform = `translateY(${yy}px)`;
          s.style.filter = blur && p < 1 ? `blur(${(1 - p) * blur}px)` : 'none';
        });
      },
    };
  }

  // Phone mockup: screen is 1170x2532 capture space scaled into the device.
  function phone(parent, { w = 620, dark = false } = {}) {
    const hgt = Math.round((w - 32) * 2532 / 1170) + 32; // screen aspect == capture aspect (no strip)
    const el = h('div', { class: 'phone' + (dark ? ' dark' : ''), style: { width: w + 'px', height: hgt + 'px' } });
    const screen = h('div', { class: 'screen' });
    const island = h('div', { class: 'island' });
    el.append(screen, island);
    parent.append(el);
    const sw = w - 2 * 16; // bezel 16
    const k = sw / 1170;
    return {
      el, screen, w, h: hgt, sw, k,
      sh: hgt - 32,
      // Image layer inside the screen, in capture space (1170 px wide). Overlays
      // (rings, masks, blurs, highlights) are placed in capture px and ride along.
      layer(src, { H = 2532, seq = null } = {}) {
        const sh = hgt - 32;
        const wrap = h('div', { class: 'layer' });
        const inner = h('div', { class: 'inner' });
        inner.style.width = sw + 'px';
        inner.style.height = H * k + 'px';
        const img = h('img', { src, draggable: 'false' });
        inner.append(img);
        wrap.append(inner);
        screen.append(wrap);
        const L = {
          wrap, inner, img, H, cur: src,
          // show capture point (cx,cy) at screen point (sx,sy) with zoom z (1 = fit width)
          set({ o = 1, z = 1, cx = 585, cy = null, sx = sw / 2, sy = null, x = 0, clampY = true } = {}) {
            wrap.style.opacity = o;
            wrap.style.display = o <= 0.001 ? 'none' : 'block';
            if (cy == null) cy = sh / 2 / k; // default: top of page
            if (sy == null) sy = sh / 2;
            let tx = sx - z * k * cx, ty = sy - z * k * cy;
            tx = Math.min(0, Math.max(sw - z * sw, tx));
            if (clampY) ty = Math.min(0, Math.max(sh - z * k * H, ty));
            inner.style.transform = `translate(${tx + x}px, ${ty}px) scale(${z})`;
            L.tx = tx + x; L.ty = ty; L.z = z;
          },
          // absolute overlay in capture coordinates
          over(cls, x, y, w, hh, html = '') {
            const el = h('div', { class: 'ov ' + cls, html });
            Object.assign(el.style, { left: x * k + 'px', top: y * k + 'px', width: w * k + 'px', height: hh * k + 'px' });
            inner.append(el);
            return el;
          },
          frame(file) { // image-sequence frame swap (awaits decode before the screenshot)
            if (file === L.cur) return;
            L.cur = file;
            img.src = file;
            E.pending.push(img.decode().catch(() => {}));
          },
        };
        L.set({});
        return L;
      },
      // canvas position of a capture point on layer L (ignores rotation)
      pt(L, cx, cy) {
        const P = this.st || { x: 0, y: 0, s: 1 };
        const px = 16 + L.tx + L.z * k * cx, py = 16 + L.ty + L.z * k * cy;
        return [P.x + w / 2 + P.s * (px - w / 2), P.y + hgt / 2 + P.s * (py - hgt / 2)];
      },
      set({ x = 0, y = 0, s = 1, r = 0, ry = 0, rx = 0, o = 1 } = {}) {
        this.st = { x, y, s };
        el.style.opacity = o;
        el.style.display = o <= 0.001 ? 'none' : 'block';
        el.style.transform = `translate(${x}px, ${y}px) perspective(2400px) rotateY(${ry}deg) rotateX(${rx}deg) rotate(${r}deg) scale(${s})`;
      },
    };
  }

  // finger tap: ring expands + dot; coordinates in parent px
  function tapper(parent) {
    const dot = h('div', { class: 'tap' }, h('div', { class: 'tap-ring' }), h('div', { class: 'tap-dot' }));
    parent.append(dot);
    return {
      el: dot,
      at(lt, x, y, t0) { // tap happening at local time t0
        const a = inv(t0 - 0.35, t0, lt), b = inv(t0, t0 + 0.55, lt);
        const vis = lt > t0 - 0.35 && lt < t0 + 0.6;
        dot.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        dot.style.left = x + 'px'; dot.style.top = y + 'px';
        const press = lt < t0 ? ease.out(a) : 1 - ease.out(b);
        dot.children[1].style.transform = `translate(-50%,-50%) scale(${0.6 + 0.4 * press})`;
        dot.children[1].style.opacity = press;
        dot.children[0].style.transform = `translate(-50%,-50%) scale(${0.4 + 1.6 * ease.out(b)})`;
        dot.children[0].style.opacity = lt >= t0 ? 1 - b : 0;
      },
    };
  }

  // background: warm ivory with drifting gold dust
  function dust(parent, n = 40, seed = 3, color = 'rgba(201,174,107,0.55)') {
    const r = prng(seed);
    const box = h('div', { class: 'dust' });
    const ps = Array.from({ length: n }, () => {
      const d = h('i');
      const size = 3 + r() * 7;
      Object.assign(d.style, { width: size + 'px', height: size + 'px', background: color });
      box.append(d);
      return { d, x: r() * 1080, y: r() * 1920, vy: 10 + r() * 30, vx: -8 + r() * 16, ph: r() * 6.28, tw: 0.5 + r() * 1.5 };
    });
    parent.append(box);
    return {
      el: box,
      at(t) {
        ps.forEach(p => {
          const y = ((p.y - p.vy * t) % 1920 + 1920) % 1920;
          const x = p.x + p.vx * t + Math.sin(t * 0.6 + p.ph) * 12;
          p.d.style.transform = `translate(${x}px, ${y}px)`;
          p.d.style.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph));
        });
      },
    };
  }

  window.E = { pending: [], clamp, lerp, inv, ease, kf, env, h, css, tf, arNum, prng, scene, cue, section, words, phone, tapper, dust, SCENES, CUES, SECTIONS };

  window.seek = t => {
    E.pending = [];
    for (const s of SCENES) {
      const vis = t >= s.start && t < s.end;
      s.el.style.display = vis ? 'block' : 'none';
      if (vis) s.update(t - s.start, t, s.state);
    }
    return Promise.all(E.pending).then(() => new Promise(r => requestAnimationFrame(() => r(true))));
  };
  window.__meta = () => ({
    duration: window.DURATION,
    audio: { duration: window.DURATION, bpm: window.BPM || 100, musicOffset: window.MUSIC_OFFSET || 0, sections: SECTIONS, sfx: CUES.slice().sort((a, b) => a.t - b.t) },
  });
})();
