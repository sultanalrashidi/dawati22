// «دعوتي — من اللخبطة… إلى فرحتكم» — master 78s, 9:16. Timings follow creative/shotlist (rev. 2).
window.DURATION = 78;
window.BPM = 96;
window.MUSIC_OFFSET = 0.2; // bar grid: 0.2, 2.7, 5.2, 7.7, 10.2 …
(() => {
  const { scene, kf, env, ease, inv, clamp, lerp, h, cue, section, words, phone, tapper, dust, arNum } = E;
  const CAP = 'assets/cap/';
  const PW = 560, PX = (1080 - PW) / 2, PY = 640; // host/guest phone placement
  const SUPER_TOP = 260;
  const SEQ = window.SEQS;

  const sup = (parent, text, size = 72, top = SUPER_TOP, cls = '') => { const c = C.superCard(parent, text, { top, size, cls }); const at = c.at; c.at = (lt, t0, t1, o = {}) => at(lt, t0, t1, { stagger: 0.04, dur: 0.35, ...o }); return c; };
  const flipIn = (t, t0, d = 0.25) => kf(t, [[t0, -90], [t0 + d, 0, 'out']]);
  const flipOut = (t, t0, d = 0.2) => kf(t, [[t0, 0], [t0 + d, 90, 'in']]);
  const pushIn = (t, t0, d = 0.35) => (1 - ease.inOut(inv(t0, t0 + d, t))); // 1 → 0
  const seqFrame = (name, i) => CAP + name + '/' + SEQ[name][Math.max(0, Math.min(SEQ[name].length - 1, Math.round(i)))];
  const ringPulse = (el, t, t0, t1) => {
    const o = env(t, t0, t1, 0.25, 0.3);
    el.style.opacity = o;
    el.style.display = o <= 0 ? 'none' : 'block';
    el.style.transform = `scale(${1 + 0.04 * Math.sin((t - t0) * 7)})`;
  };
  const showIf = (el, on) => { el.style.display = on ? 'block' : 'none'; };

  // ================================================================ sections (music energy)
  section('act1', 0, 7.9, 0.38);
  section('silence', 7.9, 8.2, 0);
  section('reveal', 8.2, 10.2, 0.3);
  section('main', 10.2, 18.9, 0.72);
  section('halftime', 18.9, 25.2, 0.5);
  section('main', 25.2, 40.2, 0.8);
  section('bloom', 40.2, 44.6, 0.55);
  section('intimate', 44.6, 52.7, 0.4);
  section('main', 52.7, 63.4, 0.75);
  section('filterdown', 63.4, 64.5, 0.3);
  section('peak', 64.5, 68.3, 0.95);
  section('lift', 68.3, 72.7, 1.0);
  section('outro', 72.7, 78, 0.5);

  // ================================================================ background (whole film)
  scene({ name: 'bg', start: 0, end: 78, z: 0, build(el) {
    el.append(h('div', { class: 'bg-ivory' }));
    const tint = h('div', { class: 'fill', style: { background: '#F1EBDD' } });
    // the guest's world: a soft rose-ivory wash taken from the chosen design («عروس الياسمين» عنابي)
    const guest = h('div', { class: 'fill', style: { background: 'radial-gradient(1100px 900px at 50% 42%, #FBF3EF 0%, #F3E4DF 60%, #EBD7D1 100%)' } });
    el.append(tint, guest, h('div', { class: 'grain' }));
    const d = dust(el, 34, 5);
    return { tint, guest, d };
  }, update(lt, t, s) {
    s.tint.style.opacity = kf(t, [[0, 1], [8.2, 1], [9.2, 0, 'inOut'], [68.3, 0], [68.4, 0]]);
    s.guest.style.opacity = Math.max(env(t, 40.1, 52.75, 0.35, 0.3), env(t, 59.35, 63.45, 0.3, 0.05));
    s.d.at(t);
    s.d.el.style.opacity = t < 8.2 ? 0.25 : 1;
  } });

  // ================================================================ S1–S2 chat chaos (0 – 4.9)
  const CHAT = [
    { t: -1.2, from: 'نوف', text: 'ارسلوا الموقع 📍' },
    { t: -0.9, from: 'أم خالد', text: 'متى الموعد بالضبط؟' },
    { t: -0.6, from: 'خالتي هيا', text: 'وين القاعة؟' },
    { t: -0.3, from: 'أبو خالد', text: 'الساعة كم؟' },
    { t: 0.03, from: 'أم فهد', text: 'كم أجيب معي؟' },
    { t: 0.5, from: 'سارة', text: 'وصلتها الدعوة؟' },
    { t: 1.2, from: 'منيرة', text: 'متى تبدأ الحفلة؟' },
    { t: 1.9, side: 'out', text: 'إن شاء الله' },
    { t: 2.7, from: 'خالتي هيا', text: 'وين القاعة؟' },
    { t: 3.0125, from: 'أبو خالد', text: 'الساعة كم؟' },
    { t: 3.325, from: 'أم فهد', text: 'كم أجيب معي؟' },
    { t: 3.6375, from: 'هيفاء', text: 'وين القاعة؟', blur: true },
    { t: 3.95, from: 'منيرة', text: 'وين القاعة؟', blur: true },
    { t: 4.2625, side: 'out', text: 'بشوف وأرد عليك', blur: true },
  ];
  CHAT.filter(m => m.t >= 0).forEach(m => { cue(m.t, 'pop', m.blur ? 0.5 : 0.8, -0.1); });
  cue(0.5, 'buzz', 0.7); cue(2.7, 'buzz', 0.7); cue(2.7, 'pizz', 0.8); cue(3.6375, 'pizz', 0.7); cue(3.95, 'pizz', 0.6);
  scene({ name: 's1', start: 0, end: 4.95, z: 5, build(el) {
    const p = phone(el, { w: 600 });
    const chat = C.chatScreen(p.screen, { title: 'زواج فيصل ونورة 🤍', sub: 'خالتي هيا، أبو خالد، أم فهد، +٣٤', msgs: CHAT });
    chat.root.querySelector('.chat-list').style.bottom = '440px';
    p.screen.append(h('div', { class: 'chat-kb' }), h('div', { class: 'chat-compose' }, 'اكتب رسالة…'));
    chat.root.querySelectorAll('.chat-msg').forEach((m, i) => { if (CHAT[i].blur) m.classList.add('blurred'); m.querySelector('.txt').style.fontSize = '46px'; });
    const badge = h('div', { class: 'badge' }, h('bdi', { dir: 'ltr' }, '١٢'));
    el.append(badge);
    const s1 = sup(el, 'أرسلتوا الدعوات…\nوبدأت الأسئلة!', 84);
    const s2 = sup(el, 'ونفس الأسئلة… تتكرر!', 76);
    return { p, chat, badge, s1, s2 };
  }, update(lt, t, s) {
    // phone shake on each ping
    let shake = 0;
    for (const m of CHAT) if (t >= m.t && t < m.t + 0.12) shake = Math.sin((t - m.t) * 120) * 3;
    const punch = kf(t, [[3.4, 1], [3.6, 1.08, 'outBack'], [4.4, 1.08], [4.6, 1]]);
    const exitY = kf(t, [[4.6, 0], [4.95, -1900, 'in']]);
    s.p.set({ x: 240 + shake, y: 610 + exitY, s: punch });
    s.p.el.style.filter = t > 4.6 ? `blur(${(t - 4.6) * 30}px)` : 'none';
    s.chat.at(t + 0.0001);
    const n = t < 0.6 ? 12 : t < 1.3 ? 47 : 99;
    s.badge.firstChild.textContent = n >= 99 ? '٩٩+' : arNum(n);
    s.badge.style.transform = `translate(${190 + shake}px, ${585 + exitY}px) scale(${1 + 0.15 * Math.max(0, Math.sin(Math.PI * clamp((t % 0.6) / 0.2)))})`;
    s.s1.at(t, -0.6, 2.5, {});
    // L2 punches in on the ping at 0.5
    s.s1.w.spans.forEach((sp, i) => { if (i >= 2) { const p = ease.outBack(inv(0.5, 0.75, t)); sp.style.opacity = clamp(p * 1.4); sp.style.transform = `scale(${0.6 + 0.4 * p})`; sp.style.filter = 'none'; } });
    s.s2.at(t, 2.55, 4.4);
  } });

  // ================================================================ S3 notes (4.6 – 6.35)
  const NOTES = ['أم فهد — كم شخص؟', 'خالتي هيا — قالت يمكن', 'سارة ✓ ✗ ؟', 'أبو خالد ؟؟'];
  cue(4.6, 'whoosh', 0.8); cue(4.95, 'rustle', 0.8); cue(5.3, 'scribble', 0.7); cue(5.75, 'scribble', 0.6);
  scene({ name: 's3', start: 4.55, end: 6.4, z: 6, build(el) {
    const n = A.notesPage(el, NOTES, { w: 700 });
    const bubbles = ['وين القاعة؟', 'الساعة كم؟', 'إن شاء الله'].map((txt, i) => { const b = C.bubble(el, txt, { side: i === 2 ? 'out' : 'in', size: 40 }); b.style.left = '0'; b.style.top = '0'; return b; });
    const sp = sup(el, 'مين بيحضر؟\nوكم شخص معه؟', 84);
    return { n, bubbles, sp };
  }, update(lt, t, s) {
    const y = kf(t, [[4.55, 1900], [4.95, 700, 'outQuint'], [6.05, 690], [6.4, 980, 'inOut']]);
    const sc = kf(t, [[6.05, 1], [6.4, 0.52, 'inOut']]);
    s.n.el.style.transform = `translate(190px, ${y}px) rotate(${kf(t, [[4.6, 4], [5.0, -2, 'out']])}deg) scale(${sc})`;
    s.n.el.style.transformOrigin = '50% 0';
    s.n.el.style.filter = t < 4.85 ? `blur(${(4.85 - t) * 40}px)` : 'none';
    s.n.lines(t, 4.9, 0.12);
    s.n.draw(t, [5.3, 5.75, 5.55, 5.95]);
    s.bubbles.forEach((b, i) => {
      const p = inv(4.7 + i * 0.1, 6.3, t);
      b.style.opacity = (1 - p) * 0.7;
      b.style.transform = `translate(${[80, 620, 140][i]}px, ${1400 - p * 900 - i * 120}px)`;
      b.style.filter = `blur(${2 + p * 10}px)`;
    });
    s.sp.at(t, 4.45, 6.3);
    s.n.el.style.opacity = 1 - ease.inOut(inv(6.2, 6.32, t));
  } });

  // ================================================================ S4 doorway (6.2 – 8.2, frozen 7.9–8.2)
  cue(6.25, 'murmur', 0.8); cue(6.4, 'flip', 0.7); cue(6.6, 'heart', 0.6); cue(7.2, 'heart', 0.7); cue(7.3, 'cluster', 0.9);
  scene({ name: 's4', start: 6.2, end: 8.25, z: 7, build(el) {
    const door = A.doorway(el);
    const clip = h('div', { class: 'clipboard' });
    const n = A.notesPage(clip, NOTES, { w: 700 });
    n.ls.forEach(l => { l.style.opacity = 1; });
    n.circles.forEach(c => { c.style.strokeDashoffset = 0; });
    el.append(clip);
    const tp = tapper(el);
    const frags = ['وين القاعة؟', 'كم أجيب معي؟', 'الساعة كم؟', 'وصلتها الدعوة؟'].map(txt => { const b = C.bubble(el, txt, { size: 38 }); b.style.left = '0'; b.style.top = '0'; return b; });
    const badge = h('div', { class: 'badge' }, h('bdi', { dir: 'ltr' }, '٩٩+'));
    el.append(badge);
    const sp = sup(el, 'وليلة الزواج…\nمين معه دعوة؟', 84);
    return { door, clip, n, tp, frags, badge, sp };
  }, update(lt, t0, s) {
    const t = Math.min(t0, 7.9); // freeze 7.9 → 8.2
    s.door.style.transform = `translate(160px, ${kf(t, [[6.2, 700], [6.6, 560, 'outQuint']])}px) scale(${kf(t, [[6.2, 0.96], [7.9, 1.02]])})`;
    s.door.style.opacity = kf(t, [[6.2, 0], [6.45, 1]]);
    s.clip.style.transform = `translate(520px, ${kf(t, [[6.2, 1060], [6.5, 1010, 'out']])}px) rotate(-4deg) scale(0.52)`;
    s.clip.style.opacity = ease.out(inv(6.2, 6.35, t));
    // finger searching the list
    const fy = kf(t, [[6.6, 1120], [6.9, 1170], [7.15, 1215], [7.4, 1262]]);
    s.tp.at(lt, 680, fy, 1.1);
    s.tp.el.style.display = t > 6.5 && t < 7.8 ? 'block' : 'none';
    if (t > 6.5 && t < 7.8) { s.tp.el.style.left = '700px'; s.tp.el.style.top = fy + 'px'; s.tp.el.children[1].style.opacity = 0.9; s.tp.el.children[1].style.transform = 'translate(-50%,-50%) scale(.8)'; s.tp.el.children[0].style.opacity = 0; }
    // collage of act-1 fragments
    const pos = [[120, 780, -12], [620, 900, 9], [90, 1230, 7], [560, 1330, -8]];
    s.frags.forEach((b, i) => {
      const p = ease.outBack(inv(7.35 + i * 0.05, 7.7 + i * 0.05, t));
      b.style.opacity = clamp(p);
      b.style.transform = `translate(${pos[i][0]}px, ${pos[i][1]}px) rotate(${pos[i][2] * p + (t - 7.4) * 8}deg) scale(${0.6 + 0.4 * p})`;
    });
    const pb = ease.outBack(inv(7.5, 7.8, t));
    s.badge.style.opacity = clamp(pb);
    s.badge.style.transform = `translate(820px, 700px) scale(${pb})`;
    s.sp.at(t, 6.3, 99);
    s.el.style.filter = t0 > 7.9 ? 'saturate(.6)' : 'none';
  } });

  // ================================================================ S5 fold into one envelope + wordmark (8.2 – 10.35)
  cue(8.2, 'suck', 0.9); cue(8.55, 'fold', 0.8); cue(8.9, 'thump', 1.0); cue(9.2, 'chime', 0.8); cue(9.2, 'motif', 0.9); cue(9.9, 'whoosh', 0.7);
  scene({ name: 's5', start: 8.2, end: 10.9, z: 8, build(el) {
    const thread = h('div', { class: 'thread' });
    el.append(thread);
    const frags = ['وين القاعة؟', 'مين بيحضر؟', 'كم أجيب معي؟', 'الساعة كم؟', 'مين معه دعوة؟'].map(txt => { const b = C.bubble(el, txt, { size: 38 }); b.style.left = '0'; b.style.top = '0'; return b; });
    const envWrap = h('div', { class: 'env-wrap' });
    el.append(envWrap);
    const env = A.envelope(envWrap);
    const wm = C.wordmark(el, 230, 'var(--gold)');
    wm.style.position = 'absolute'; wm.style.left = '0'; wm.style.right = '0'; wm.style.textAlign = 'center'; wm.style.top = '560px';
    const sp = sup(el, 'الدعوات والردود والدخول\nفي مكان واحد', 70);
    return { thread, frags, envWrap, env, wm, sp };
  }, update(lt, t, s) {
    const start = [[140, 700], [640, 820], [90, 1250], [600, 1360], [330, 1500]];
    s.frags.forEach((b, i) => {
      const p = ease.in(inv(8.2 + i * 0.04, 8.75, t));
      const x = lerp(start[i][0], 420, p), y = lerp(start[i][1], 1150, p);
      b.style.opacity = 1 - p;
      b.style.transform = `translate(${x}px, ${y}px) rotate(${(1 - p) * (i % 2 ? 8 : -8)}deg) scale(${1 - 0.8 * p})`;
    });
    s.thread.style.opacity = env(t, 8.2, 8.9, 0.1, 0.2);
    s.thread.style.transform = `translate(540px, 1150px) scale(${ease.out(inv(8.2, 8.6, t))})`;
    const pe = ease.outBackSoft(inv(8.45, 9.1, t));
    const flip = kf(t, [[9.95, 0], [10.2, 90, 'in']]);
    s.envWrap.style.opacity = clamp(pe * 1.5);
    s.envWrap.style.transform = `translate(220px, 960px) perspective(1600px) rotateY(${flip}deg) scale(${0.3 + 0.7 * pe})`;
    const ps = ease.outBack(inv(8.85, 9.05, t));
    s.env.seal.style.transform = `scale(${t < 8.85 ? 0 : 1.6 - 0.6 * ps})`;
    s.env.seal.style.opacity = t < 8.85 ? 0 : 1;
    const pw = ease.inOut(inv(9.0, 9.55, t));
    s.wm.style.clipPath = `inset(-30% 0 -45% ${(1 - pw) * 100}%)`; // write on right → left (keep ي dots)
    s.wm.style.opacity = env(t, 8.95, 10.05, 0.05, 0.25);
    s.sp.at(t, 8.3, 10.85);
  } });

  // ================================================================ HOST PHONE 1 (10.1 – 40.25): S6 → S13
  // sfx
  cue(11.15, 'highlight', 0.7); cue(12.3, 'tap', 1); cue(12.75, 'swoosh', 0.5);
  cue(13.325, 'note1', 0.9); cue(13.95, 'note2', 0.9); cue(14.575, 'note3', 0.9); cue(15.2, 'note4', 0.9); cue(14.5, 'whoosh', 0.4); cue(16.0, 'tap', 1); cue(16.45, 'swoosh', 0.5);
  [16.5, 16.6, 16.72, 16.85, 17.0].forEach(x => cue(x, 'type', 0.8)); cue(17.5, 'paste', 0.9); cue(17.75, 'swoosh', 0.4); cue(18.7, 'tap', 1);
  cue(18.95, 'sparkle', 0.8); cue(20.4, 'chime', 0.5); cue(22.6, 'tap', 1); cue(22.65, 'plane', 0.8); cue(22.8, 'pop', 0.8); cue(23.5, 'pop', 0.8); cue(25.0, 'tap', 1); cue(25.25, 'swoosh', 0.5);
  cue(25.8, 'click', 0.7); cue(27.75, 'slide', 0.7); cue(27.9, 'grace', 0.8);
  cue(30.0, 'drop', 0.6); cue(30.35, 'click', 0.6); cue(30.6, 'paste', 1); cue(30.9, 'tap', 1); cue(31.2, 'sweep', 0.6); cue(32.6, 'blipA', 0.9); cue(33.2, 'blipR', 0.9); cue(34.0, 'tap', 1); cue(34.2, 'ding', 0.8);
  cue(34.65, 'swoosh', 0.5); cue(35.4, 'pulse', 0.7); cue(37.6, 'slide', 0.8); cue(38.2, 'ding', 0.9); cue(39.983, 'flip', 0.8);

  scene({ name: 'host1', start: 10.05, end: 40.25, z: 10, build(el) {
    const p = phone(el, { w: PW });
    const L = {};
    // S6 landing
    L.c1 = p.layer(CAP + 'c01-landing-noprice.png'); // price line hidden at capture
    L.c1.over('mask solid', 40, 835, 1090, 270).style.background = '#faf6ee'; // subtitle («أو مناسبتك» / «برابط واحد»)
    const hl = L.c1.over('hl', 572, 1349, 236, 54);
    // S7 gallery (two published colours) — swatch row masked (local import lists unpublished colours)
    L.c2a = p.layer(CAP + 'c02b-gallery-colour-black-gold.png');
    L.c2b = p.layer(CAP + 'c02b-gallery-colour-burgundy.png');
    [L.c2a, L.c2b].forEach(l => { l.over('mask solid', 70, 2010, 1030, 175).style.background = '#ffffff'; });
    // S8 details
    L.c3a = p.layer(CAP + 'c03-details-03-names.png');
    const r3a1 = L.c3a.over('ring', 605, 505, 470, 140), r3a2 = L.c3a.over('ring', 605, 1105, 470, 140);
    L.c3b = p.layer(CAP + 'c03-details-04-date-venue.png');
    const r3b1 = L.c3b.over('ring', 40, 400, 1090, 430), r3b2 = L.c3b.over('ring', 40, 955, 1090, 140);
    const flash = L.c3b.over('flash', 50, 962, 1070, 126);
    L.c3c = p.layer(CAP + 'c03-details-08-companions.png');
    const r3c = L.c3c.over('ring', 690, 845, 450, 115);
    L.c3c.over('mask solid', 0, 2038, 1170, 494).style.background = '#faf6ee'; // site footer («لمناسباتك»)
    // S9 preview
    L.c4a = p.layer(CAP + 'c04-preview-01-cover.png');
    L.c4b = p.layer(CAP + 'c04-preview-03-greeting.png');
    const r4 = L.c4b.over('ring', 22, 2275, 1126, 240);
    // S10 activate
    L.c5 = p.layer(CAP + 'c05-activate-noprice.png'); // real screen, «ر.س» figures hidden at capture
    const r5 = L.c5.over('ring', 596, 1310, 572, 505);
    // S12 paste
    L.c7a = p.layer(CAP + 'c07-paste-before.png');
    L.c7b = p.layer(CAP + 'c07-paste-after.png');
    [763, 886, 1008, 1131, 1425, 1548].forEach(y => L.c7b.over('blur', 330, y, 350, 64)); L.c7b.over('blur', 330, 1660, 350, 40);
    const sweep = L.c7b.over('hl', 70, 740, 1030, 120);
    const r7a = L.c7b.over('ring amber', 50, 1220, 1070, 180);
    L.c7c = p.layer(CAP + 'c07-paste-after-b.png');
    [763, 1056, 1180, 1301, 1596].forEach(y => L.c7c.over('blur', 330, y, 350, 64));
    const r7b = L.c7c.over('ring red', 50, 1395, 1070, 160);
    L.c7d = p.layer(CAP + 'c07-paste-done.png');
    const r7d = L.c7d.over('ring', 70, 720, 1030, 240);
    L.c7d.over('blur', 845, 2325, 235, 60);
    // S13 send queue
    L.c8 = p.layer(CAP + 'c08-send-queue.png');
    L.c8.over('blur', 420, 1100, 340, 70);
    L.c8.over('mask solid', 0, 2005, 1170, 527).style.background = '#faf6ee';
    const r8 = L.c8.over('ring', 40, 850, 1090, 800);

    const tp = tapper(el);
    const stepper = C.stepper(el, ['التصميم', 'البيانات', 'المعاينة', 'التفعيل']);
    stepper.el.style.top = '580px';
    const wmMini = C.wordmark(el, 56, 'var(--gold)'); wmMini.className = 'wordmark center-x'; wmMini.style.top = '538px';
    // fan of real closed envelopes (published colours + فيونكة الورد)
    const fanSrc = ['assets/jas/luxury-sage.png', 'assets/jas/earthy-mauve.png', 'assets/jas/black-gold.png', 'assets/jas/burgundy.png', 'assets/env/ribbon-bloom.webp'];
    const fan = fanSrc.map(src => { const c = C.artCard(el, src, 400); c.style.left = '0'; c.style.top = '0'; c.style.zIndex = 1; return c; });
    p.el.style.zIndex = 5;
    // S9 family chat
    const mc = A.miniChat(el, 'العرسان', [{ t: 22.8, from: 'نورة', text: 'تهبل يمه! 🤍' }, { t: 23.5, from: 'فيصل', text: 'ما شاء الله… فعّلوها!' }]);
    mc.el.style.transform = 'none';
    const pl = A.plane(el); pl.style.zIndex = 46;
    const chipFree = A.tag(el, 'بدون تسجيل دخول وبدون بطاقة', 1380, 'solid');
    chipFree.el.style.fontSize = '44px'; chipFree.el.style.padding = '14px 34px';
    // S11 custom design card
    const g7 = h('div', { class: 'g7' }, A.svg(120, 120, '<g fill="none" stroke="#A6863B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 92 L78 44 L92 58 L44 106 L26 110 Z"/><path d="M70 52 L84 66"/><path d="M20 30 h28 M34 16 v28"/></g>'), h('div', { class: 'g7-t' }, 'تصميم خاص'), h('div', { class: 'g7-s' }, 'على ذوقكم'));
    g7.firstChild.style.position = 'relative'; g7.firstChild.style.display = 'inline-block';
    el.append(g7); g7.style.zIndex = 20;
    // S12 notes callback
    const notesCb = A.notesPage(el, ['أم فهد — كم شخص؟', 'خالتي هيا — قالت يمكن', 'سارة ✓ ✗ ؟', 'أبو خالد ؟؟'], { w: 640 });
    notesCb.el.style.zIndex = 20;
    const R = '\u200F';
    const clean = [`أم فهد، ${R}0500001101${R}، ${R}3`, `أم محمد ${R}0500001102 ${R}2`, `سارة القحطاني ${R}0500001103`, `هيفاء العتيبي، ${R}0500001104${R}، ${R}2`];
    const tabAfter = A.tag(el, 'بعد التفعيل', 575, '');
    // S13 team-send inset (real row from the activate page's comparison table)
    const crop = h('div', { class: 'crop-card' });
    const cropImg = h('div', { class: 'crop', style: { width: 615 * 1.05 + 'px', height: 212 * 1.05 + 'px', backgroundImage: `url(${CAP}c08b-team-send-compare.png)`, backgroundSize: `${1170 * 1.05}px auto`, backgroundPosition: `${-500 * 1.05}px ${-996 * 1.05}px` } });
    const circ = A.svg(700, 280, '<ellipse cx="535" cy="122" rx="60" ry="32" fill="none" stroke="#A6863B" stroke-width="5" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-4 535 122)"/>');
    crop.append(cropImg, circ); el.append(crop); crop.style.zIndex = 20;

    const sp = {
      s6: sup(el, 'من التصميم للمعاينة…\n*مجاناً*', 72),
      s7: sup(el, 'اختاروا التصميم… واللون', 72),
      s8: sup(el, 'الأسماء… والموعد\nوالمكان… مرة وحدة', 72),
      s9a: sup(el, 'شوفوا دعوتكم كاملة\n*قبل* ما تدفعون', 80),
      s9b: sup(el, 'وشاركوها مع أهلكم', 72),
      s10: sup(el, 'عجبتكم؟ فعّلوها\n~والدفع عند التفعيل~', 84),
      s11: sup(el, 'وتصميم خاص؟\n~تطلبونه بعد التفعيل~', 84),
      s12a: sup(el, 'قائمتكم في الملاحظات؟\nالصقوها دفعة وحدة', 72),
      s12b: sup(el, 'وينبّهكم للمكرر…\nوالرقم الغلط', 80),
      s13a: sup(el, 'من واتسابكم…\nلكل ضيف رابطه', 84),
      s13b: sup(el, 'أو فريق دعوتي يرسلها عنكم\n*مجاناً*', 64),
    };
    sp.s6.w.spans[3].style.fontSize = '1.17em'; sp.s13b.w.spans[5].style.fontSize = '1.31em';
    return { wmMini, p, L, hl, r3a1, r3a2, r3b1, r3b2, flash, r3c, r4, r5, sweep, r7a, r7b, r7d, r8, tp, stepper, fan, mc, pl, chipFree, g7, notesCb, clean, tabAfter, crop, circ, sp };
  }, update(lt, t, s) {
    const { p, L } = s;
    const sw = p.sw;
    // phone: flip in from the envelope at 10.1, flip out to the guest at 40.0
    const ry = t < 20 ? flipIn(t, 10.1) : flipOut(t, 39.983);
    p.set({ x: PX, y: PY, ry, o: t < 10.1 ? 0 : 1 });
    const push = (t0) => pushIn(t, t0) * -sw; // incoming layer x offset (RTL: from the left)
    const out = (t0) => ease.inOut(inv(t0, t0 + 0.35, t)) * sw * 0.35;
    const vis = (a, b) => t >= a && t < b;

    // S6 landing — tight on CTA + note, push 1.15 → 1.3
    if (vis(10.05, 13.1)) L.c1.set({ z: kf(t, [[10.2, 1.0], [12.7, 1.04, 'inOut']]), cx: 585, cy: 1290, x: out(12.7) });
    else L.c1.set({ o: 0 });
    s.hl.style.transform = `scaleX(${ease.inOut(inv(11.15, 11.55, t))})`;
    // S7 gallery
    if (vis(12.7, 16.8)) {
      const z = kf(t, [[12.7, 1.0], [16.4, 1.12]]);
      L.c2a.set({ z, cy: 1500, x: push(12.7) + out(16.4), o: 1 });
      L.c2b.set({ z, cy: 1500, x: push(12.7) + out(16.4), o: ease.inOut(inv(14.5, 14.9, t)) });
    } else { L.c2a.set({ o: 0 }); L.c2b.set({ o: 0 }); }
    // fan behind the phone
    const fanBase = [[-80, 760, -14], [-40, 1180, -6], [700, 700, 10], [740, 1140, 4], [690, 1520, -8]];
    s.fan.forEach((c, i) => {
      const pin = ease.outBack(inv(13.0 + i * 0.12, 13.5 + i * 0.12, t));
      const o = env(t, 12.9, 16.6, 0.2, 0.35);
      const lift = [13.325, 13.95, 14.575, 15.2][i] ? Math.max(0, Math.sin(Math.PI * clamp((t - [13.325, 13.95, 14.575, 15.2][i]) / 0.5))) : 0;
      const [x, y, r] = fanBase[i];
      c.style.display = o <= 0 ? 'none' : 'block';
      c.style.opacity = o;
      c.style.transform = `translate(${lerp(340, x, pin)}px, ${lerp(1000, y, pin) - lift * 60}px) rotate(${r * pin}deg) scale(${0.6 + 0.4 * pin + lift * 0.08})`;
    });
    // S8 details — three stills scrolled like one form
    if (vis(16.4, 19.0)) {
      const up = (t0) => ease.inOut(inv(t0, t0 + 0.3, t));
      L.c3a.set({ cy: 1266, x: push(16.4), o: 1 - up(16.9) });
      L.c3b.set({ cy: 1266, o: up(16.9) - up(17.7), x: 0 });
      L.c3b.inner.style.marginTop = (1 - up(16.9)) * 200 + 'px';
      L.c3c.set({ cy: 1266, o: up(17.7), z: kf(t, [[17.7, 1], [18.6, 1.08]]), cx: 585 });
      L.c3c.inner.style.marginTop = (1 - up(17.7)) * 200 + 'px';
    } else { L.c3a.set({ o: 0 }); L.c3b.set({ o: 0 }); L.c3c.set({ o: 0 }); }
    ringPulse(s.r3a1, t, 16.5, 16.95); ringPulse(s.r3a2, t, 16.55, 16.95);
    ringPulse(s.r3b1, t, 17.0, 17.35); ringPulse(s.r3b2, t, 17.35, 17.72);
    s.flash.style.opacity = env(t, 17.45, 17.75, 0.05, 0.25) * 0.8;
    ringPulse(s.r3c, t, 17.85, 18.65);
    // S9 preview: iris from the tap, cover → greeting
    if (vis(18.75, 25.6)) {
      const iris = ease.inOut(inv(18.75, 19.15, t));
      const z = kf(t, [[18.9, 1.0], [25.2, 1.07]]);
      L.c4a.set({ z, cy: 1266, o: t < 20.0 ? 1 : 0 });
      L.c4b.set({ z, cy: 1266, o: t >= 20.0 ? 1 : 0, x: out(25.2) });
      const r = iris * 1500;
      L.c4a.wrap.style.clipPath = `circle(${r}px at 50% 56%)`;
    } else { L.c4a.set({ o: 0 }); L.c4b.set({ o: 0 }); }
    ringPulse(s.r4, t, 20.6, 22.4);
    // S10 activate (blurred behind the S11 card)
    if (vis(25.2, 30.65)) {
      L.c5.set({ cy: 1300, z: kf(t, [[25.2, 1], [27.7, 1.05]]), x: push(25.2), o: 1 - ease.inOut(inv(30.4, 30.6, t)) });
      L.c5.wrap.style.filter = t > 27.6 ? `blur(${ease.out(inv(27.6, 28.0, t)) * 10}px)` : 'none';
    } else L.c5.set({ o: 0 });
    ringPulse(s.r5, t, 25.8, 27.6);
    // S12 paste
    const cut = (a, b) => t >= a && t < b;
    L.c7a.set({ o: cut(30.5, 31.15) ? 1 : 0, cy: 1266 });
    const pz = ease.inOut(inv(32.35, 32.6, t));
    if (cut(31.1, 33.0)) L.c7b.set({ o: 1, z: lerp(1, 2.1, pz), cx: lerp(585, 760, pz), cy: lerp(1266, 1310, pz) }); else L.c7b.set({ o: 0 });
    const pbz = ease.inOut(inv(33.7, 33.95, t));
    L.c7c.set({ o: cut(33.0, 34.25) ? 1 : 0, z: lerp(2.1, 1, pbz), cx: lerp(760, 585, pbz), cy: lerp(1475, 1266, pbz) });
    L.c7d.set({ o: cut(34.2, 34.95) ? 1 : 0, cy: 1266, x: out(34.6) });
    s.sweep.style.opacity = env(t, 31.2, 32.3, 0.1, 0.2);
    s.sweep.style.top = kf(t, [[31.2, 740], [32.2, 1570]]) * p.k + 'px';
    ringPulse(s.r7a, t, 32.55, 33.0); ringPulse(s.r7b, t, 33.15, 34.2); ringPulse(s.r7d, t, 34.25, 34.9);
    // S13 send queue
    if (vis(34.6, 40.3)) {
      L.c8.set({ o: 1, cx: 585, cy: 1270, z: kf(t, [[34.6, 1], [35.2, 1.5, 'inOut'], [37.5, 1.58]]), x: push(34.6) });
      L.c8.wrap.style.filter = t > 37.5 ? `blur(${ease.out(inv(37.5, 37.9, t)) * 9}px)` : 'none';
    } else L.c8.set({ o: 0 });
    ringPulse(s.r8, t, 35.2, 37.5);

    // taps (canvas coordinates of real buttons)
    const taps = [[12.3, L.c1, 665, 1237], [16.0, L.c2b, 585, 2265], [18.7, L.c3c, 585, 1418], [22.6, L.c4b, 585, 2415], [25.0, L.c4b, 220, 2415], [30.9, L.c7a, 585, 1371], [34.0, L.c7c, 755, 1875]];
    let tapped = false;
    for (const [tt, lay, cx, cy] of taps) if (t > tt - 0.4 && t < tt + 0.6) { const [x, y] = p.pt(lay, cx, cy); s.tp.at(t, x, y, tt); tapped = true; }
    if (!tapped) s.tp.el.style.display = 'none';
    // stepper S7–S10
    const so = env(t, 12.8, 27.6, 0.3, 0.3);
    s.stepper.el.style.opacity = so; s.stepper.el.style.display = so > 0 ? 'flex' : 'none';
    s.stepper.el.style.transform = `translateX(-50%)`; s.stepper.el.style.left = '540px';
    s.stepper.set(t < 16.4 ? 0 : t < 18.9 ? 1 : t < 25.2 ? 2 : 3);
    // S9 extras
    s.chipFree.at(t, 20.3, 22.55);
    s.mc.at(t, 22.7, 25.1); s.mc.el.style.left = '30px'; s.mc.el.style.top = '1190px';
    const pp = inv(22.62, 22.95, t);
    s.pl.style.display = pp > 0 && pp < 1 ? 'block' : 'none';
    s.pl.style.transform = `translate(${lerp(540, 250, pp)}px, ${lerp(1380, 1060, pp) - Math.sin(Math.PI * pp) * 120}px) rotate(${-20 + pp * 10}deg)`;
    // S11 custom-design card over blurred C5
    const g = ease.outQuint(inv(27.7, 28.1, t)), go = env(t, 27.7, 29.85, 0.2, 0.3);
    s.g7.style.display = go > 0 ? 'block' : 'none'; s.g7.style.opacity = go;
    s.g7.style.transform = `translate(220px, ${lerp(1150, 900, g)}px)`;
    // S12 notes callback: messy → clean, then copy
    const no = env(t, 29.9, 30.75, 0.2, 0.2);
    s.notesCb.el.style.display = no > 0 ? 'block' : 'none'; s.notesCb.el.style.opacity = no;
    s.notesCb.el.style.transform = `translate(220px, ${kf(t, [[29.9, 300], [30.2, 760, 'outQuint'], [30.75, 780]])}px) scale(.9)`;
    s.notesCb.ls.forEach((l, i) => { l.style.opacity = 1; l.textContent = t < 30.2 ? ['أم فهد — كم شخص؟', 'خالتي هيا — قالت يمكن', 'سارة ✓ ✗ ؟', 'أبو خالد ؟؟'][i] : s.clean[i]; l.style.background = t > 30.35 && t < 30.75 ? 'rgba(166,134,59,.22)' : 'none'; l.style.direction = 'rtl'; });
    s.notesCb.circles.forEach(c => { c.style.strokeDashoffset = t < 30.2 ? 0 : 1; });
    s.tabAfter.at(t, 30.5, 37.5);
    // S13 team card
    const cg = ease.outQuint(inv(37.6, 38.0, t)), co = env(t, 37.6, 40.05, 0.2, 0.25);
    s.crop.style.display = co > 0 ? 'block' : 'none'; s.crop.style.opacity = co;
    s.crop.style.transform = `translate(${(1080 - 702) / 2}px, ${lerp(1150, 930, cg)}px)`;
    s.circ.style.position = 'absolute'; s.circ.style.left = '54px'; s.circ.style.top = '32px';
    s.circ.querySelector('ellipse').style.strokeDashoffset = 1 - ease.inOut(inv(38.1, 38.6, t));

    // supers
    s.sp.s6.at(t, 10.95, 13.0); s.sp.s7.at(t, 13.1, 16.3); s.sp.s8.at(t, 16.5, 18.85);
    s.sp.s9a.at(t, 19.1, 22.5); s.sp.s9b.at(t, 22.65, 25.1); s.sp.s10.at(t, 25.3, 27.6);
    s.sp.s11.at(t, 27.7, 29.85); s.sp.s12a.at(t, 29.95, 32.4); s.sp.s12b.at(t, 32.5, 34.55);
    s.sp.s13a.at(t, 34.75, 37.3); s.sp.s13b.at(t, 37.4, 40.1);
    s.wmMini.style.opacity = env(t, 10.15, 12.75, 0.25, 0.25);
  } });

  // ================================================================ GUEST PHONE 1 (40.0 – 52.9): S14 → S16
  cue(40.8, 'tap', 1); cue(40.85, 'paper', 0.9); cue(41.0, 'bloom', 0.8); cue(43.2, 'highlight', 0.4);
  cue(45.2, 'swoosh', 0.4); cue(46.0, 'dock', 0.8); cue(46.8, 'dock', 0.8); cue(47.0, 'tap', 0.9); cue(47.45, 'swoosh', 0.4); [47.7, 48.0].forEach(x => cue(x, 'clock', 0.6));
  cue(48.35, 'swoosh', 0.4); cue(48.9, 'tap', 1); cue(49.45, 'tap', 0.9); cue(49.62, 'click', 0.8); [50.1, 50.2, 50.32, 50.45, 50.6, 50.72, 50.85].forEach(x => cue(x, 'type', 1.0)); cue(51.2, 'dock', 0.8); cue(52.2, 'tap', 1); cue(52.4, 'sendwhoosh', 0.8);
  scene({ name: 'guest1', start: 40.0, end: 52.95, z: 10, build(el) {
    const pet = A.petals(el, 16, 21, [-60, 300, 1140, 1100]);
    const p = phone(el, { w: PW });
    const L = {};
    L.open = p.layer(seqFrame('c10-seq-open', 0));
    L.opened = p.layer(CAP + 'c10-guest-02-opened.png');
    const ul = L.opened.over('uline', 500, 965, 180, 6);
    L.scroll = p.layer(seqFrame('c10-seq-scroll', 24));
    L.rsvp = p.layer(CAP + 'c10-guest-08-rsvp-empty.png');
    L.rsvp.over('blur', 150, 1015, 390, 90);
    // after «سأحضر» the product reveals «عدد الأشخاص»: switch to the real filled capture, with the
    // chosen count and the typed message masked until they are entered (no composited layout)
    L.rsvpF = p.layer(CAP + 'c10-guest-20-rsvp-filled.png');
    L.rsvpF.over('blur', 160, 1045, 360, 100);
    const pb = L.rsvpF.over('mask solid', 900, 1455, 115, 85); pb.style.background = '#f8f0e8';
    const pc = L.rsvpF.over('mask solid', 180, 1690, 830, 110); pc.style.background = '#f8f0e8';
    const tp = tapper(el);
    const tagG = A.tag(el, 'جوال أم فهد', 575, 'ink');
    const chips = { hall: A.dockChip(el, 'وين القاعة؟'), time: A.dockChip(el, 'الساعة كم؟'), cnt: A.dockChip(el, 'كم أجيب معي؟') };
    const spk = A.spark(el);
    const sp = {
      s14: sup(el, 'كل ضيف… دعوة باسمه\n~تنفتح من المتصفح بدون تطبيق~', 72),
      s15: sup(el, 'الموعد والموقع…\nداخل الدعوة', 84),
      s16: sup(el, 'تأكيد أو اعتذار… وتحديد العدد\n~على قد اللي سمحتوا لها~', 60),
    };
    return { pet, p, L, ul, pb, pc, tp, tagG, chips, spk, sp };
  }, update(lt, t, s) {
    const { p, L } = s;
    const ry = t < 45 ? flipIn(t, 40.183) : flipOut(t, 52.55);
    p.set({ x: PX, y: PY, ry, o: t < 40.183 ? 0 : 1 });
    s.pet.at(t - 40, env(t, 40.9, 44.6, 0.5, 0.5));
    // S14 real opening sequence (tap at seq 0.6s ≙ 40.8)
    if (t < 42.85) { L.open.frame(seqFrame('c10-seq-open', (t - 40.2) * 30)); L.open.set({ o: 1, cy: 1266 }); } else L.open.set({ o: 0 });
    if (t >= 42.8 && t < 44.75) L.opened.set({ o: 1, z: kf(t, [[42.8, 1], [43.35, 1.6, 'outQuint'], [44.6, 1.65]]), cx: 585, cy: 925, sy: p.sh * 0.42 });
    else L.opened.set({ o: 0 });
    s.ul.style.transform = `scaleX(${ease.inOut(inv(43.2, 43.7, t))})`;
    // S15 real scroll: greeting → details (hold) → countdown glimpse
    if (t >= 44.6 && t < 48.65) {
      const f = kf(t, [[44.6, 55], [45.2, 80], [45.65, 112, 'inOut'], [47.4, 140], [47.8, 162, 'inOut'], [48.4, 185]]);
      L.scroll.frame(seqFrame('c10-seq-scroll', f));
      L.scroll.set({ o: 1, cy: 1266 });
      L.scroll.wrap.style.transform = `translateY(${-ease.inOut(inv(48.3, 48.65, t)) * p.sh}px)`;
    } else L.scroll.set({ o: 0 });
    // S16 RSVP
    if (t >= 48.3) {
      const sl = ease.inOut(inv(48.3, 48.65, t));
      L.rsvp.set({ o: t < 48.95 ? 1 : 0, z: kf(t, [[48.65, 1], [48.9, 1.25, 'inOut']]), cx: 590, cy: kf(t, [[48.65, 1266], [48.9, 1413, 'inOut']]) });
      L.rsvp.wrap.style.transform = `translateY(${(1 - sl) * p.sh}px)`;
      L.rsvpF.set({ o: t >= 48.95 ? 1 : 0, z: 1.25, cx: 590, cy: 1413 });
      s.pb.style.opacity = 1 - ease.out(inv(49.6, 49.75, t));
      const type = ease.linear(inv(50.1, 50.95, t));
      s.pc.style.clipPath = `inset(0 ${type * 100}% 0 0)`; // RTL typing: text appears from the right
    } else { L.rsvpF.set({ o: 0 });
      L.rsvp.set({ o: 0 });
    }
    // taps
    const taps = [[40.8, L.open, 585, 1330], [47.0, L.scroll, 585, 1615], [48.9, L.rsvp, 807, 1253], [49.45, L.rsvpF, 585, 1490], [52.2, L.rsvpF, 585, 1945]];
    let tapped = false;
    for (const [tt, lay, cx, cy] of taps) if (t > tt - 0.4 && t < tt + 0.6) { const [x, y] = p.pt(lay, cx, cy); s.tp.at(t, x, y, tt); tapped = true; }
    if (!tapped) s.tp.el.style.display = 'none';
    // callbacks docking on the real buttons
    s.chips.hall.at(t, { t0: 45.4, from: [360, 760], to: () => { const [x, y] = p.pt(L.scroll, 585, 1615); return [x - 300, y]; }, tDock: 46.0, tOut: 46.5 });
    s.chips.time.at(t, { t0: 46.2, from: [720, 760], to: () => { const [x, y] = p.pt(L.scroll, 585, 1425); return [x - 300, y]; }, tDock: 46.8, tOut: 47.0 });
    s.chips.cnt.at(t, { t0: 50.5, from: [540, 760], to: () => { const [x, y] = p.pt(L.rsvpF, 585, 1490); return [x - 300, y]; }, tDock: 51.2, tOut: 51.8 });
    s.spk.at(t, 52.4, 52.9, p.pt(L.rsvpF, 585, 1945), [540, 700]);
    s.tagG.at(t, 40.3, 52.5);
    s.sp.s14.at(t, 40.4, 44.45); s.sp.s15.at(t, 44.8, 48.2); s.sp.s16.at(t, 48.5, 52.6);
  } });

  // ================================================================ HOST PHONE 2 (52.55 – 59.6): S17 → S18
  cue(52.75, 'flip', 0.7); cue(53.3, 'pulse', 0.8); cue(53.2, 'dock', 0.8); cue(54.8, 'swoosh', 0.4); cue(55.6, 'dock', 0.8); cue(57.1, 'rustle', 0.6); cue(57.075, 'phrase', 0.8); cue(59.25, 'flip', 0.7);
  scene({ name: 'host2', start: 52.55, end: 59.6, z: 10, build(el) {
    const p = phone(el, { w: PW });
    const L = {};
    L.d = p.layer(CAP + 'c06-dashboard.png');
    L.d.over('mask solid', 50, 365, 1070, 410).style.background = '#faf6ee';
    const um = L.d.over('mask solid', 112, 2347, 946, 92); um.style.background = '#F4EEE0'; um.style.borderRadius = '10px'; // dev URL
    const rt = L.d.over('ring', 40, 820, 540, 350), r174 = L.d.over('ring', 112, 966, 170, 74);
    L.g = p.layer(CAP + 'c06-dashboard-guests.png');
    [[830, 988, 255, 46], [830, 1548, 255, 46], [770, 2110, 245, 46]].forEach(([x, y, w, hh]) => L.g.over('blur', x, y, w, hh));
    const soft = L.g.over('ring soft', 30, 890, 1110, 170), rOpen = L.g.over('ring', 282, 2176, 236, 76);
    [[880, 1076], [880, 1637]].forEach(([x, y]) => { L.g.over('mask solid', x, y, 200, 46).style.background = '#FFFFFF'; }); // «المرافقون: n» prints party size — not highlighted
    L.w = p.layer(CAP + 'c11-wishes.png');
    const rw = L.w.over('ring soft', 60, 720, 1060, 170);
    L.w.over('mask solid', 880, 2224, 200, 48).style.background = '#FFFFFF';
    L.w.over('blur', 845, 2138, 235, 42);
    const tagH = A.tag(el, 'جوالكم · بيانات توضيحية', 575, '');
    const chips = { who: A.dockChip(el, 'مين بيحضر؟'), got: A.dockChip(el, 'وصلتها الدعوة؟') };
    const spk = A.spark(el);
    const sp = { s17: sup(el, 'كل الردود… في صفحة وحدة\nوكم شخص جاي', 64), s18: sup(el, 'وتوصلكم تهاني ضيوفكم', 72) };
    // lift-out card: the «فتح ولم يرد» row sits at the very bottom of the capture (caption zone)
    const k75 = 0.75;
    const lift = h('div', { class: 'crop-card' }), liftRing = h('div', { class: 'ov ring', style: { left: (282 - 60) * k75 + 26 + 'px', top: (2176 - 2010) * k75 + 26 + 'px', width: 236 * k75 + 'px', height: 76 * k75 + 'px' } });
    lift.append(h('div', { class: 'crop', style: { width: 1050 * k75 + 'px', height: 250 * k75 + 'px', backgroundImage: `url(${CAP}c06-dashboard-guests.png)`, backgroundSize: `${1170 * k75}px auto`, backgroundPosition: `${-60 * k75}px ${-2010 * k75}px` } }),
      h('div', { class: 'ov blur', style: { left: (770 - 60) * k75 + 26 + 'px', top: (2110 - 2010) * k75 + 26 + 'px', width: 245 * k75 + 'px', height: 46 * k75 + 'px' } }), liftRing);
    lift.style.zIndex = 20; el.append(lift);
    return { p, L, rt, r174, soft, rOpen, rw, tagH, chips, spk, sp, lift, liftRing };
  }, update(lt, t, s) {
    const { p, L } = s;
    const ry = t < 56 ? flipIn(t, 52.75) : flipOut(t, 59.25);
    p.set({ x: PX, y: PY, ry, o: t < 52.75 ? 0 : 1 });
    const pd = ease.inOut(inv(53.45, 53.85, t));
    if (t < 55.15) L.d.set({ o: 1, z: lerp(1.08, 2.2, pd), cx: lerp(585, 307, pd), cy: lerp(1180, 990, pd), sy: lerp(p.sh * 0.42, p.sh * 0.5, pd), x: ease.inOut(inv(54.8, 55.15, t)) * p.sw * 0.35 });
    else L.d.set({ o: 0 });
    if (t >= 54.8 && t < 57.45) L.g.set({ o: 1, z: 1.06, cy: kf(t, [[54.8, 1150], [55.6, 1650, 'inOut'], [57.1, 1700]]), x: pushIn(t, 54.8) * -p.sw + ease.inOut(inv(57.1, 57.45, t)) * p.sw * 0.35 });
    else L.g.set({ o: 0 });
    if (t >= 57.1) L.w.set({ o: 1, z: kf(t, [[57.1, 1.08], [59.3, 1.14]]), cx: 585, cy: 900, x: pushIn(t, 57.1) * -p.sw });
    else L.w.set({ o: 0 });
    ringPulse(s.rt, t, 52.9, 53.5); ringPulse(s.r174, t, 53.9, 54.75); ringPulse(s.soft, t, 55.0, 56.9); s.rOpen.style.display = 'none'; ringPulse(s.rw, t, 57.5, 59.2);
    const lo = env(t, 55.2, 57.0, 0.2, 0.25), lg = ease.outQuint(inv(55.2, 55.55, t));
    s.lift.style.display = lo > 0 ? 'block' : 'none'; s.lift.style.opacity = lo; s.lift.style.transform = `translate(100px, ${lerp(1250, 1080, lg)}px)`; ringPulse(s.liftRing, t, 55.7, 57.0);
    s.chips.who.at(t, { t0: 52.75, from: [540, 760], to: () => p.pt(L.d, 307, 770), tDock: 53.2, tOut: 53.8 });
    s.chips.got.at(t, { t0: 54.85, from: [700, 760], to: [540, 1040], tDock: 55.6, tOut: 56.2 });
    s.spk.at(t, 52.9, 53.3, [540, 700], p.pt(L.d, 307, 995));
    s.tagH.at(t, 52.8, 59.3);
    s.sp.s17.at(t, 52.9, 57.0); s.sp.s18.at(t, 57.2, 59.3);
  } });

  // ================================================================ GUEST PHONE 2 (59.35 – 63.6): S19 pass + wallet
  cue(59.45, 'swoosh', 0.5); cue(60.2, 'glass', 0.9); cue(61.6, 'whoosh', 0.4); cue(61.85, 'slot', 1); cue(62.9, 'riser', 0.9);
  scene({ name: 'guest2', start: 59.35, end: 63.45, z: 10, build(el) {
    const p = phone(el, { w: PW });
    const L = { pass: p.layer(seqFrame('c10-seq-pass', 52)) };
    const tagG = A.tag(el, 'جوال أم فهد', 575, 'ink');
    const tab = A.tag(el, 'مع خيار «بباركود»', 1385, 'solid'); tab.wrap.style.textAlign = 'left'; tab.wrap.style.paddingLeft = '70px';
    const wal = A.walletGlyph(el); wal.style.zIndex = 30;
    const mp = A.miniPass(el); mp.style.zIndex = 29;
    const sp = sup(el, 'بطاقة دخول بباركود\n~وتنحفظ في محفظة Apple~', 72);
    return { p, L, tagG, tab, wal, mp, sp };
  }, update(lt, t, s) {
    const { p, L } = s;
    p.set({ x: kf(t, [[61.4, PX], [61.8, PX - 90, 'inOut'], [62.85, PX - 90], [63.15, PX, 'inOut']]), y: PY, ry: t < 61 ? flipIn(t, 59.45) : kf(t, [[61.4, 0], [61.8, -8, 'inOut'], [62.85, -8], [63.15, 0, 'inOut']]), o: t < 59.45 ? 0 : 1 });
    const f = kf(t, [[59.4, 52], [61.0, 90], [63.45, 100]]); // start on the settled pass (skip the blank scroll frames)
    L.pass.frame(seqFrame('c10-seq-pass', f));
    // QR zooms up to hand over to the door scanner
    const zq = ease.inOut(inv(63.05, 63.45, t));
    L.pass.set({ o: 1, z: lerp(1.7, 3.6, zq), cx: 585, cy: lerp(1160, 1737, zq), sy: p.sh * 0.5 });
    const wo = env(t, 61.5, 63.2, 0.3, 0.3);
    s.wal.style.opacity = wo; showIf(s.wal, wo > 0);
    s.wal.style.transform = `translate(610px, ${kf(t, [[61.5, 1300], [61.8, 1130, 'outBack']])}px) scale(1.15)`;
    const mpP = ease.inOut(inv(61.55, 61.9, t));
    s.mp.style.opacity = env(t, 61.5, 63.2, 0.15, 0.3); showIf(s.mp, t > 61.5 && t < 63.2);
    s.mp.style.transform = `translate(${lerp(420, 650, mpP)}px, ${lerp(860, 1020, mpP)}px) rotate(${lerp(-4, -6, mpP)}deg) scale(${lerp(1.25, 0.95, mpP)})`;
    s.tagG.at(t, 59.45, 63.0); s.tab.at(t, 59.8, 63.3);
    s.sp.at(t, 59.6, 63.2);
  } });

  // ================================================================ DOOR (63.35 – 68.55): S20
  cue(63.6, 'heart', 0.75); cue(64.0, 'heart', 0.75); cue(64.45, 'beep', 1); cue(64.55, 'hit', 1); cue(64.6, 'success', 0.9); cue(65.0, 'dock', 0.8); cue(66.6, 'swoosh', 0.4); cue(66.8, 'tick', 0.6);
  scene({ name: 'door', start: 63.45, end: 68.55, z: 10, build(el) {
    const vg = h('div', { class: 'vignette' }); el.append(vg);
    const p = phone(el, { w: PW });
    const L = { scan: p.layer(seqFrame('c12-seq-scan', 44)), att: p.layer(CAP + 'c13-attendance-notime.png') };
    const ra = L.att.over('ring', 590, 530, 480, 340);
    L.scan.over('mask solid', 0, 2052, 1170, 480).style.background = '#faf6ee';
    const tag = A.tag(el, 'جوال منظّمة الدخول · بدون تطبيق', 575, 'ink');
    const tagH = A.tag(el, 'جوالكم · بيانات توضيحية', 575, '');
    const tab = A.tag(el, 'مع خيار «بباركود»', 1385, 'solid'); tab.wrap.style.textAlign = 'left'; tab.wrap.style.paddingLeft = '70px';
    const chip = A.dockChip(el, 'مين معه دعوة؟');
    const sa = sup(el, 'مسحة عند الباب…\nودخول ناجح', 84), sb = sup(el, 'وتعرفون مين حضر فعلياً', 72);
    return { vg, p, L, ra, tag, tagH, tab, chip, sa, sb };
  }, update(lt, t, s) {
    const { p, L } = s;
    const shrink = ease.inOut(inv(68.2, 68.55, t));
    p.set({ x: PX, y: PY - shrink * 128, s: 1 - shrink * 0.179, o: 1 - shrink });
    s.vg.style.opacity = env(t, 63.45, 66.6, 0.2, 0.4);
    const f = kf(t, [[63.4, 44], [64.45, 80, 'linear'], [64.5, 88], [66.6, 118]]);
    L.scan.frame(seqFrame('c12-seq-scan', f));
    L.scan.set({ o: t < 66.95 ? 1 : 0, cy: 1266, x: ease.inOut(inv(66.6, 66.95, t)) * p.sw * 0.35 });
    const pa2 = ease.inOut(inv(66.85, 67.2, t));
    L.att.set({ o: t >= 66.6 ? 1 : 0, z: lerp(1.1, 2.2, pa2), cx: lerp(585, 830, pa2), cy: lerp(950, 700, pa2), x: pushIn(t, 66.6) * -p.sw });
    ringPulse(s.ra, t, 66.8, 68.2);
    s.chip.at(t, { t0: 64.6, from: [540, 760], to: () => p.pt(L.scan, 585, 470), tDock: 65.05, tOut: 65.8 });
    s.tag.at(t, 63.45, 66.55); s.tagH.at(t, 66.6, 68.2); s.tab.at(t, 63.5, 66.5);
    s.sa.at(t, 63.6, 66.25); s.sb.at(t, 66.3, 68.25);
  } });

  // ================================================================ S21 payoff (68.3 – 72.9)
  cue(68.6, 'pop', 0.5); cue(68.9, 'pop', 0.5); cue(69.2, 'pop', 0.5); cue(69.5, 'pop', 0.5); cue(69.8, 'pop', 0.5); cue(70.8, 'tap', 0.8); cue(71.2, 'sparkle', 0.7);
  scene({ name: 'payoff', start: 68.3, end: 72.95, z: 10, build(el) {
    const table = A.tableArt(el);
    const p = phone(el, { w: 460 });
    const chat = C.chatScreen(p.screen, { title: 'زواج فيصل ونورة 🤍', sub: 'خالتي هيا، أبو خالد، أم فهد، +٣٤', msgs: [] });
    chat.root.style.background = '#FBF5E8';
    const badge = h('div', { class: 'badge gold' }, h('bdi', { dir: 'ltr' }, '٩٩+'));
    el.append(badge);
    const qs = ['وين القاعة؟', 'الساعة كم؟', 'كم أجيب معي؟', 'مين بيحضر؟', 'مين معه دعوة؟'].map(q => A.dockChip(el, q));
    const pet = A.petals(el, 22, 33, [100, 700, 980, 1300]);
    const bloom = h('div', { class: 'whiteout' }); el.append(bloom);
    const tabQ = A.tag(el, 'الدخول مع خيار «بباركود»', 1385, 'solid'); tabQ.wrap.style.textAlign = 'left'; tabQ.wrap.style.paddingLeft = '70px';
    const sa = sup(el, 'ترسلون من مكان واحد…\nوتدرون مين جاي وكم معه', 68);
    const sb = sup(el, 'وتنظّمون الدخول…\nوتتفرّغون *لفرحتكم*', 80);
    return { table, p, badge, qs, pet, bloom, tabQ, sa, sb };
  }, update(lt, t, s) {
    s.el.style.opacity = ease.out(inv(68.3, 68.6, t));
    const down = ease.inOut(inv(70.2, 70.8, t));
    s.p.set({ x: (1080 - 460) / 2, y: lerp(620, 570, down), s: lerp(1, 0.55, down), rx: lerp(0, 62, down), o: 1 });
    const n = Math.round(lerp(99, 0, ease.inOut(inv(68.4, 69.8, t))));
    s.badge.firstChild.textContent = n >= 99 ? '٩٩+' : arNum(n);
    s.badge.style.opacity = 1 - inv(69.8, 70.1, t);
    s.badge.style.transform = `translate(${230}px, ${600 - down * 50}px)`;
    const spots = [[330, 900], [720, 1000], [360, 1120], [700, 1230], [520, 1340]];
    s.qs.forEach((c, i) => c.at(t, { t0: 68.35, from: spots[i], to: spots[i], tDock: 68.6 + i * 0.3, tOut: 68.9 + i * 0.3 }));
    s.pet.at(t - 68.3, env(t, 68.7, 72.9, 0.3, 0.4));
    s.table.style.opacity = ease.out(inv(70.3, 70.9, t));
    s.table.style.transform = `translate(90px, ${lerp(930, 850, ease.out(inv(70.3, 70.9, t)))}px)`;
    s.bloom.style.opacity = env(t, 72.55, 73.0, 0.3, 0.01) * 0.9;
    s.sa.at(t, 68.4, 70.45); s.sb.at(t, 70.5, 72.8); s.tabQ.at(t, 70.55, 72.75);
  } });

  // ================================================================ S22 end card (72.7 – 78)
  cue(72.8, 'motifFinal', 1); cue(73.9, 'click', 0.5); cue(74.8, 'bell', 0.8); cue(75.9, 'tap', 0.4); cue(77.8, 'pop', 0.8, -0.1);
  scene({ name: 'end', start: 72.7, end: 78.01, z: 12, build(el) {
    el.append(h('div', { class: 'bg-ivory' }), h('div', { class: 'grain' }), h('div', { class: 'frame-line' }));
    const d = dust(el, 26, 8);
    const mono = A.monogram(el, 230);
    const wm = C.wordmark(el, 210, 'var(--gold)');
    wm.className = 'wordmark center-x'; wm.style.top = '600px';
    const kick = h('div', { class: 'center-x', style: { top: '860px', fontSize: '72px', fontWeight: 800 } }, 'عندكم زواج قريب؟');
    const pill = h('div', { class: 'center-x', style: { top: '1000px' } }, h('span', { class: 'cta-pill' }, 'ابدؤوا بتجربة التصميم مجاناً'));
    const sub = h('div', { class: 'center-x', style: { top: '1150px', fontSize: '44px', fontWeight: 700 } }, 'وشوفوا دعوتكم قبل ما تدفعون');
    const small = h('div', { class: 'center-x', style: { top: '1225px', fontSize: '40px', fontWeight: 700, color: 'var(--muted)' } }, 'بدون تسجيل دخول وبدون بطاقة');
    const url = h('div', { class: 'center-x', style: { top: '1305px' } }, h('span', { class: 'url' }, 'www.dawati.store'));
    el.append(kick, pill, sub, small, url);
    const tp = tapper(el);
    return { d, mono, wm, kick, pill, sub, small, url, tp };
  }, update(lt, t, s) {
    s.el.style.opacity = ease.out(inv(72.7, 73.0, t));
    s.d.at(t);
    const pm = ease.outBack(inv(72.8, 73.3, t));
    s.mono.el.style.transform = `translate(${505 - 115}px, 320px) scale(${pm})`;
    s.mono.circ.style.strokeDashoffset = 1 - ease.inOut(inv(72.9, 73.6, t));
    s.wm.style.clipPath = `inset(-30% 0 -45% ${(1 - ease.inOut(inv(73.0, 73.5, t))) * 100}%)`;
    const rise = (el, t0) => { const p = ease.outQuint(inv(t0, t0 + 0.45, t)); el.style.opacity = p; el.style.transform = `translateY(${(1 - p) * 24}px)`; };
    rise(s.kick, 72.8); rise(s.pill, 73.9); rise(s.sub, 74.3); rise(s.small, 74.7); rise(s.url, 74.8);
    const pulse = t > 75.4 ? 1 + 0.03 * Math.max(0, Math.sin(((t - 75.4) % 2) * Math.PI / 0.5)) : 1;
    s.pill.firstChild.style.transform = `scale(${pulse})`;
    if (t > 75.5 && t < 76.5) s.tp.at(t, 505, 1058, 75.9); else s.tp.el.style.display = 'none';
  } });
})();
