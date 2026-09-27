/* ══ THE END — cinematic finale ═══════════════════════════════════════════════
   Builds its own overlay and canvas; no image assets. Music and sound come
   from the-end-score.js (load it first; without it the finale plays silent).

     TheEnd.play({
       name:  'OPERATOR NAME',                   // defaults to neonNexus_username
       route: 'tend'|'extract'|'administer'|'',  // defaults to state.conduct.route
       stats: [['TOTAL CLICKS', '12,345'], ...], // optional finale rows
       onNextCycle() {}, onRest() {},            // finale buttons (both close first)
     });

   Seven scenes, ~100s. No hard cuts: every scene dissolves into the next, or
   is built so its last frame is the next one's first.
     1 LAST CLICK   — the camera pulls back from the button to the city. Five
                      clicks spend everything: each one darkens a district and
                      plays a note of the Operator motif. The button implodes,
                      the city goes dark, the sky is pulled into one point.
     2 LAST ANOMALY — the pale bird crosses the empty frame; catch it or don't
     3 REGISTRY     — fourteen rows; thirteen of them still running
     4 THE CHAIR    — the room you stopped rendering; push into the monitor
     5 THE DOOR     — the white-out shrinks into a white door, which opens;
                      THE END is made of what's left
     6 THE DUCK     — the shroud comes off
     7 FINALE       — nothing left to click (you will click anyway)
   Skip / Esc dissolves to the finale. ♪ toggles sound. Reduced motion drops
   shake and flashes.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const OPERATOR = 14;
    const CYAN = '68,170,220', PALE = '232,240,255', AMBER = '255,196,120', PINK = '255,90,200';
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const easeIn = t => { t = clamp(t, 0, 1); return t * t * t; };
    const easeOut = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
    const rand = (a, b) => a + Math.random() * (b - a);
    const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
    const pad2 = n => String(n).padStart(2, '0');

    const ROUTE_LINES = {
        chair: {
            tend:       'Still fed. Still breathing. Someone kept the plants alive.',
            extract:    'Still fed. Still breathing. Still clicking.',
            administer: 'Still fed. Still breathing. Filed under: furniture.',
            '':         'Still fed. Still breathing. Still here.',
        },
        finale: {
            tend:       'You looked after them. It did not save them. It was still the right thing to do.',
            extract:    'You took everything there was. It was exactly enough to end.',
            administer: 'Every form was filed. Nobody will read them. That was never the point.',
            '':         'You did not decide what kind of Operator you were. The universe decided for you.',
        },
    };
    const AFTER_CLICKS = [
        'There is nothing left to click.',
        'Still nothing.',
        'The number is not coming back.',
        'Old habits.',
        'The duck is watching you do this.',
        'Fine. +1.',
        'You always do.',
    ];

    let root, cv, ctx, mainCtx, off, offCtx, capEl, uiEl, skipBtn, muteBtn;
    let W = 0, H = 0, DPR = 1, raf = 0, lastTs = 0;
    let opts = {}, name = '', route = '', reduced = false, score = null;
    let scenes = null, idx = 0, cur = null, prev = null, xfT = 0, xfDur = 0;
    let shake = 0, flash = 0;
    /* False while the outgoing scene of a dissolve is drawn: it keeps moving,
       but it no longer speaks, plays sound or shakes the camera. */
    let speaking = true;
    let onKeyRef = null, onResizeRef = null;

    const sfx = (n, ...a) => { if (score && speaking) score.hit(n, ...a); };
    const music = (n, f) => { if (score && speaking) score.cue(n, f); };
    const kick = n => { if (!reduced && speaking) shake = Math.max(shake, n); };
    const flashTo = a => { if (!reduced && speaking) flash = Math.max(flash, a); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* Once, when the CURRENT scene's clock passes `time`. An outgoing scene
       still draws during a dissolve, but it no longer speaks or makes sound. */
    function at(sc, time) {
        if (sc !== cur) return false;
        sc._cues = sc._cues || {};
        if (sc.t < time || sc._cues[time]) return false;
        return (sc._cues[time] = true);
    }

    /* ── DOM ────────────────────────────────────────────────────────────────── */
    const CSS = `
#the-end{position:fixed;inset:0;z-index:10050;background:#000;overflow:hidden;cursor:default;
  font-family:"Courier New",ui-monospace,monospace;color:rgb(${PALE});user-select:none;-webkit-user-select:none}
#the-end canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#the-end button{width:auto;height:auto;margin:0;min-width:0;box-sizing:border-box;text-transform:none;box-shadow:none}
#te-cap{position:absolute;left:16px;right:16px;bottom:11%;text-align:center;font-size:clamp(14px,2.2vw,20px);
  letter-spacing:.06em;line-height:1.6;pointer-events:none;text-shadow:0 1px 3px #000,0 0 12px rgba(${CYAN},.6);transition:opacity .45s}
#te-cap.out{opacity:0}
#te-cap span{opacity:0;animation:te-in .5s forwards}
@keyframes te-in{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}
#te-bar{position:absolute;top:16px;right:16px;display:flex;gap:8px}
#te-bar button{background:transparent;border:1px solid rgba(${CYAN},.4);color:rgba(${CYAN},.85);font:inherit;
  font-size:11px;letter-spacing:.16em;padding:6px 12px;border-radius:4px;cursor:pointer;opacity:.6;transition:opacity .2s}
#te-bar button:hover{opacity:1}
#te-ui{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  padding:9vh 16px 0;pointer-events:none;opacity:0;transition:opacity 1.6s}
#te-ui.on{opacity:1}
#te-ui .te-h{font-size:clamp(34px,8vw,72px);font-weight:700;letter-spacing:.3em;margin-right:-.3em;
  color:#fff;text-shadow:0 0 24px rgba(${PALE},.8),0 0 60px rgba(${CYAN},.5)}
#te-ui .te-sub{margin-top:10px;font-size:13px;letter-spacing:.2em;color:rgba(${CYAN},.9)}
#te-ui .te-line{margin-top:18px;max-width:560px;text-align:center;font-size:14px;line-height:1.7;color:rgba(${PALE},.78)}
#te-ui .te-stats{margin-top:18px;width:min(420px,100%);font-size:12px;letter-spacing:.1em}
#te-ui .te-stats div{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(${CYAN},.15);
  opacity:0;animation:te-in .6s forwards}
#te-ui .te-stats b{color:#fff;font-weight:400}
#te-ui .te-btns{margin-top:26px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;pointer-events:auto}
#te-ui .te-btns button{background:rgba(0,0,0,.35);border:1px solid rgba(${PALE},.5);color:#fff;font:inherit;font-size:12px;
  letter-spacing:.18em;padding:11px 20px;border-radius:4px;cursor:pointer;transition:background .2s,box-shadow .2s}
#te-ui .te-btns button:hover{background:rgba(${PALE},.12);box-shadow:0 0 18px rgba(${PALE},.35)}
#te-ui .te-after{margin-top:16px;min-height:1.4em;font-size:12px;letter-spacing:.12em;color:rgba(${AMBER},.85)}
@media (prefers-reduced-motion:reduce){#te-cap span{animation-duration:.01s}}`;

    function buildDom() {
        if (!document.getElementById('the-end-css')) {
            const s = document.createElement('style');
            s.id = 'the-end-css'; s.textContent = CSS;
            document.head.appendChild(s);
        }
        root = document.createElement('div');
        root.id = 'the-end';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'The End');
        root.innerHTML = '<canvas></canvas><div id="te-cap" class="out" aria-live="polite"></div><div id="te-ui"></div>' +
            '<div id="te-bar"><button id="te-mute" aria-label="Toggle sound">♪</button><button id="te-skip">SKIP ⏭</button></div>';
        document.body.appendChild(root);
        cv = root.querySelector('canvas');
        mainCtx = ctx = cv.getContext('2d');
        off = document.createElement('canvas');
        offCtx = off.getContext('2d');
        capEl = root.querySelector('#te-cap');
        uiEl = root.querySelector('#te-ui');
        skipBtn = root.querySelector('#te-skip');
        muteBtn = root.querySelector('#te-mute');
        if (!score) muteBtn.style.display = 'none';
        skipBtn.addEventListener('click', e => { e.stopPropagation(); skipToFinale(); });
        muteBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (score) muteBtn.style.textDecoration = score.mute() ? 'line-through' : '';
        });
        root.addEventListener('pointerdown', onPointer);
        onKeyRef = e => {
            if (e.key === 'Escape') skipToFinale();
            else if (e.key === ' ' || e.key === 'Enter') {
                if (e.target && e.target.tagName === 'BUTTON') return;
                e.preventDefault(); onPointer({ clientX: W / 2, clientY: H / 2 });
            }
        };
        onResizeRef = resize;
        document.addEventListener('keydown', onKeyRef);
        window.addEventListener('resize', onResizeRef);
        resize();
    }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        [cv, off].forEach(c => { c.width = W * DPR; c.height = H * DPR; });
        if (scenes) scenes.forEach(s => s.resize && s.resize());
    }

    /* Captions never swap under the reader: the old line fades out, then the
       new one types in. `hold` (ms) fades it out on its own. */
    let capT1 = 0, capT2 = 0;
    function caption(text, hold) {
        if (!speaking) return;
        clearTimeout(capT1); clearTimeout(capT2);
        const show = () => {
            capEl.innerHTML = '';
            [...text].forEach((ch, i) => {
                const s = document.createElement('span');
                s.textContent = ch;
                s.style.animationDelay = (i * 0.026) + 's';
                capEl.appendChild(s);
            });
            capEl.classList.remove('out');
            if (hold) capT2 = setTimeout(() => capEl.classList.add('out'), hold);
        };
        if (!capEl.classList.contains('out')) { capEl.classList.add('out'); capT1 = setTimeout(show, 480); }
        else show();
    }
    function clearCaption() { if (!speaking) return; clearTimeout(capT1); clearTimeout(capT2); capEl.classList.add('out'); }

    /* ── DRAWING HELPERS ────────────────────────────────────────────────────── */
    function glow(x, y, r, col, a) {
        if (a <= 0 || r <= 0) return;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function dawnSky(a) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(10,16,40,${a})`); g.addColorStop(1, `rgba(255,190,120,${0.28 * a})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    /* Each scene owns its particles, so a scene that is dissolving out keeps
       its own and never advances another scene's. */
    function Particles() {
        let list = [], rings = [];
        return {
            burst(x, y, n, o) {
                o = o || {};
                for (let i = 0; i < n; i++) {
                    const a = Math.random() * TAU, v = rand(o.vmin || 1, o.vmax || 6);
                    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.8, 1), decay: o.decay || 0.008,
                        r: rand(1, o.size || 3), col: o.col || CYAN, drag: o.drag || 0.985, grav: o.grav || 0 });
                }
            },
            add(p) { list.push(Object.assign({ vx: 0, vy: 0, life: 1, decay: 0.01, r: 1.5, col: PALE, drag: 1, grav: 0 }, p)); },
            ring(x, y, r, v, a, col) { rings.push({ x, y, r, v, a, col: col || CYAN }); },
            draw(pull, px, py, mode) {
                ctx.globalCompositeOperation = mode || 'lighter';
                list = list.filter(p => p.life > 0);
                for (const p of list) {
                    if (pull) {
                        const dx = px - p.x, dy = py - p.y, d = Math.hypot(dx, dy) || 1;
                        p.vx += dx / d * pull * 0.25 + (-dy / d) * pull * 0.08;
                        p.vy += dy / d * pull * 0.25 + (dx / d) * pull * 0.08;
                        if (d < 10) p.life = 0;
                    }
                    p.vy += p.grav; p.vx *= p.drag; p.vy *= p.drag;
                    p.x += p.vx; p.y += p.vy; p.life -= p.decay;
                    ctx.fillStyle = `rgba(${p.col},${clamp(p.life, 0, 1)})`;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.6), 0, TAU); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
                rings = rings.filter(r => r.a > 0.01);
                for (const r of rings) {
                    r.r += r.v; r.a *= 0.94;
                    ctx.strokeStyle = `rgba(${r.col},${r.a})`; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
                }
            },
            clear() { list = []; rings = []; },
        };
    }

    function drawBird(x, y, s, flap, a) {
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        glow(0, 0, 44, PALE, 0.25 * a);
        ctx.strokeStyle = `rgba(${PALE},${a})`; ctx.fillStyle = `rgba(${PALE},${a})`;
        ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        const wy = Math.sin(flap) * 12;
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-12, -8 + wy * 0.3, -24, wy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(12, -8 + wy * 0.3, 24, wy); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 1, 5, 2.6, 0, 0, TAU); ctx.fill();
        ctx.restore();
    }

    function drawShroud(x, baseY, s, a) {
        if (a <= 0) return;
        ctx.save(); ctx.translate(x, baseY); ctx.scale(s / 50, s / 50);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.strokeStyle = `rgba(${PALE},${0.18 * a})`; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -89); ctx.bezierCurveTo(15, -89, 25, -77, 25, -62);
        ctx.bezierCurveTo(25, -54, 22, -49, 22, -43); ctx.lineTo(29, -5);
        ctx.bezierCurveTo(29.5, -1.5, 27, 0, 24, 0); ctx.lineTo(-24, 0);
        ctx.bezierCurveTo(-27, 0, -29.5, -1.5, -29, -5); ctx.lineTo(-22, -43);
        ctx.bezierCurveTo(-22, -49, -25, -54, -25, -62); ctx.bezierCurveTo(-25, -77, -15, -89, 0, -89);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    function drawDuck(x, y, s, t, a, look) {
        ctx.save(); ctx.translate(x, y + Math.sin(t * 2) * s * 0.04); ctx.rotate(Math.sin(t * 1.6) * 0.05);
        ctx.scale(s / 100, s / 100); ctx.globalAlpha = a;
        glow(0, -20, 150, '255,220,90', 0.25);
        const body = ctx.createRadialGradient(-20, -40, 10, 0, -20, 90);
        body.addColorStop(0, '#fff27a'); body.addColorStop(1, '#f2b705');
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(0, -28, 62, 36, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(48, -40); ctx.quadraticCurveTo(78, -62, 70, -30); ctx.quadraticCurveTo(62, -24, 48, -28); ctx.fill();
        ctx.beginPath(); ctx.arc(-30 + look * 4, -78, 32, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a1c';
        ctx.beginPath(); ctx.ellipse(-64 + look * 6, -72, 20, 8, -0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a1206';
        ctx.beginPath(); ctx.arc(-40 + look * 5, -86, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-38 + look * 5, -88, 1.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.ellipse(-18, -96, 10, 5, -0.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,140,0,.6)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-10, -30); ctx.quadraticCurveTo(15, -10, 35, -34); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = `rgba(${PALE},${0.35 * a})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const rr = s * (0.7 + i * 0.25) + Math.sin(t * 2 + i) * 4;
            ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.12, 0, 0, TAU); ctx.stroke();
        }
    }

    /* Where the duck stands. Its distance is the conduct read, as in the game:
       close for TEND, far for EXTRACT. */
    function duckPose(final) {
        const far = route === 'extract', near = route === 'tend';
        const s = Math.min(W, H) * (far ? 0.12 : near ? 0.2 : 0.16);
        return final ? { x: W / 2, y: H * 0.88, s: s * 0.75 } : { x: W / 2, y: H * (far ? 0.6 : 0.66), s };
    }

    function textPoints(str, size, step) {
        const oc = document.createElement('canvas'), o = oc.getContext('2d');
        o.font = `700 ${size}px "Courier New",monospace`;
        const w = Math.ceil(o.measureText(str).width) + 20, h = Math.ceil(size * 1.2);
        oc.width = w; oc.height = h;
        o.font = `700 ${size}px "Courier New",monospace`;
        o.fillStyle = '#fff'; o.textBaseline = 'middle'; o.fillText(str, 10, h / 2);
        const d = o.getImageData(0, 0, w, h).data, pts = [];
        for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step)
            if (d[(y * w + x) * 4 + 3] > 128) pts.push({ x: x - w / 2, y: y - h / 2 });
        return pts;
    }

    /* ══ SCENE 1 · LAST CLICK ════════════════════════════════════════════════
       One continuous shot: fade up on the button, pull back to the city, five
       clicks, the implosion, the city going dark, the sky pulled into a point.
       The city is on screen from the first frame, so nothing arrives late. */
    function sceneLastClick() {
        const NEED = 5;
        const fx = Particles();
        let stars = [], city = [], motes = [];
        let clicks = 0, idle = 0, lastClickT = -9, press = 0, finalT = -1;
        let logShown = 34, fShown = 1;

        function build() {
            const n = Math.round(clamp(W * H / 5000, 120, 320));
            stars = [];
            for (let i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.78, r: rand(0.4, 1.8), tw: Math.random() * TAU, a: 1, dying: false });
            city = [];
            for (let x = -10; x < W + 10;) {
                const w = rand(28, 70), h = rand(0.1, H > W ? 0.24 : 0.32) * H;   // shorter in portrait, clear of the captions
                const cols = Math.max(2, Math.floor(w / 11)), rows = Math.floor(h / 14), win = [];
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
                    if (Math.random() < 0.55) win.push({ c, r, hue: Math.random() < 0.8 ? CYAN : PINK, lit: 1, off: false, blink: Math.random() < 0.04 });
                city.push({ x, w, h, cols, win, sink: rand(0, 0.4), mast: Math.random() < 0.3 });
                x += w + rand(2, 8);
            }
            motes = [];
            for (let i = 0; i < 46; i++) motes.push({ a: Math.random() * TAU, d: rand(1.5, 2.6), v: rand(0.2, 0.6), r: rand(0.8, 2) });
        }
        const R = () => Math.min(W, H) * 0.095;
        const btnY = () => H * 0.42;

        /* District by district: a window goes out once the darkness reaches it. */
        function darken(radius) {
            const cx = W / 2;
            for (const b of city) for (const w of b.win) {
                const wx = b.x + (w.c + 0.5) * (b.w / b.cols);
                if (!w.off && Math.abs(wx - cx) < radius * (0.85 + Math.random() * 0.3)) w.off = true;
            }
        }

        function spend() {
            if (clicks >= NEED) return;
            sfx('note', clicks);
            clicks++; idle = 0; lastClickT = this.t; press = 1;
            kick(3 + clicks * 2); flashTo(0.06 + clicks * 0.02);
            const cx = W / 2, cy = btnY(), r = R();
            fx.ring(cx, cy, r, 7, 0.9);
            // released energy flies out of the orbit
            motes.splice(0, Math.ceil(motes.length / (NEED - clicks + 1))).forEach(m => {
                const x = cx + Math.cos(m.a) * m.d * r, y = cy + Math.sin(m.a) * m.d * r;
                fx.add({ x, y, vx: Math.cos(m.a) * rand(3, 7), vy: Math.sin(m.a) * rand(3, 7), decay: 0.012, r: m.r + 0.6, col: CYAN, drag: 0.97 });
            });
            stars.filter(s => !s.dying).slice(0, Math.ceil(stars.length * 0.08)).forEach(s => { s.dying = true; });
            darken((clicks / NEED) * W * 0.3);
            if (clicks === 2) caption('Every unit you ever gathered.');
            if (clicks === 4) caption('In a single transaction. Four milliseconds.');
            if (clicks === NEED) { finalT = this.t; caption('0.', 1800); }
        }

        function drawCity(sinkT, alpha) {
            ctx.save();
            const haze = ctx.createLinearGradient(0, H * 0.55, 0, H);
            haze.addColorStop(0, `rgba(${CYAN},0)`); haze.addColorStop(1, `rgba(${CYAN},${0.12 * alpha * cityLight()})`);
            ctx.fillStyle = haze; ctx.fillRect(0, H * 0.55, W, H * 0.45);
            for (const b of city) {
                const off = easeIn(span(sinkT, b.sink, b.sink + 0.6)) * (b.h + 30);
                const top = H - b.h + off;
                ctx.fillStyle = `rgba(6,10,22,${alpha})`;
                ctx.fillRect(b.x, top, b.w, b.h);
                ctx.strokeStyle = `rgba(${CYAN},${0.22 * alpha})`;
                ctx.strokeRect(b.x + 0.5, top + 0.5, b.w - 1, b.h);
                if (b.mast) {
                    ctx.fillStyle = `rgba(6,10,22,${alpha})`; ctx.fillRect(b.x + b.w / 2 - 1, top - 14, 2, 14);
                    const on = !b.win.every(w => w.off) && Math.sin(this.t * 3 + b.x) > 0.6;
                    if (on) glow(b.x + b.w / 2, top - 14, 6, '255,60,60', 0.9 * alpha);
                }
                const cw = b.w / b.cols;
                for (const w of b.win) {
                    if (w.off) w.lit = Math.max(0, w.lit - 0.04 - Math.random() * 0.05);
                    if (w.lit <= 0) continue;
                    const fl = w.off && Math.random() < 0.3 ? 0.3 : w.blink ? 0.6 + 0.4 * Math.sin(this.t * 7 + w.c) : 1;
                    ctx.fillStyle = `rgba(${w.hue},${0.8 * alpha * w.lit * fl})`;
                    ctx.fillRect(b.x + w.c * cw + 3, top + 8 + w.r * 14, cw - 6, 6);
                }
            }
            ctx.restore();
        }
        let _lit = 1;
        function cityLight() { return _lit; }

        return {
            name: 'lastclick', xfade: 1.2,
            resize: build,
            enter() { build(); music('spend', 3); caption('One purchase left. Spend it.'); },
            click() { if (this.t > 1.2) spend.call(this); },
            draw(t, dt) {
                const cx = W / 2, cy = btnY(), r = R();
                const k = finalT < 0 ? -1 : t - finalT;          // time since the last click
                if (finalT < 0 && this === cur) { idle += dt; if (idle > 4.5 && t > 3) spend.call(this); }   // it spends itself if you hesitate

                // camera: starts close on the button, pulls back to reveal the city
                const z = lerp(1.22, 1, ease(t / 4));
                ctx.save();
                ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);

                // sky
                const pull = k < 0 ? 0 : easeIn(span(k, 5, 12)) * 1.4;
                for (const s of stars) {
                    if (s.dying) s.a -= 0.02;
                    if (pull > 0) {
                        const dx = cx - s.x, dy = H / 2 - s.y, d = Math.hypot(dx, dy) || 1;
                        const sp = pull * (2 + 900 / (d + 40));
                        s.x += dx / d * sp + (-dy / d) * sp * 0.35;
                        s.y += dy / d * sp + (dx / d) * sp * 0.35;
                        if (d < 8) s.a = 0;
                    }
                    if (s.a <= 0) continue;
                    ctx.fillStyle = `rgba(${PALE},${s.a * (0.55 + 0.45 * Math.sin(t * 2 + s.tw))})`;
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
                }

                // city: already there; after the last click the darkness spreads to the edges
                if (k >= 0) darken(W * 0.3 + easeIn(span(k, 1.6, 7)) * W * 0.4);
                _lit = 1 - (k < 0 ? clicks / NEED * 0.5 : 0.5 + span(k, 1.6, 7) * 0.5);
                drawCity.call(this, k < 0 ? 0 : span(k, 9, 15), 1 - (k < 0 ? 0 : span(k, 13, 15.5)));

                // the button
                press = Math.max(0, press - dt * 5);
                fShown = lerp(fShown, 1 - clicks / NEED, 1 - Math.exp(-dt * 6));
                const tgt = clicks >= NEED ? -1 : 34 + 4 * Math.log10(1 - clicks / NEED);
                logShown = lerp(logShown, tgt, 1 - Math.exp(-dt * 5));
                const implode = k < 0 ? 0 : easeIn(span(k, 0.9, 1.5));
                const live = k < 1.5;
                if (live) {
                    const flick = k > 0 && k < 0.9 ? (Math.random() < 0.35 ? 0.25 : 1) : 1;
                    const rr = r * (1 - implode) * (1 - press * 0.08 + Math.sin(t * 4) * 0.02);
                    glow(cx, cy, r * 3.2 * (1 - implode * 0.6), CYAN, (0.3 + press * 0.2 + implode * 0.5) * flick);
                    // orbiting energy, drawn inwards
                    ctx.globalCompositeOperation = 'lighter';
                    for (const m of motes) {
                        m.a += m.v * dt; m.d -= dt * 0.05; if (m.d < 1.2) m.d = 2.6;
                        const md = m.d * (1 - implode);
                        ctx.fillStyle = `rgba(${CYAN},${0.7 * flick})`;
                        ctx.beginPath(); ctx.arc(cx + Math.cos(m.a) * md * r, cy + Math.sin(m.a) * md * r, m.r, 0, TAU); ctx.fill();
                    }
                    ctx.globalCompositeOperation = 'source-over';
                    if (rr > 0.5) {
                        // energy ring: what is left, draining as you spend it
                        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${CYAN},${0.18 * flick})`;
                        ctx.beginPath(); ctx.arc(cx, cy, rr * 1.35, 0, TAU); ctx.stroke();
                        ctx.strokeStyle = `rgba(${PALE},${0.9 * flick})`; ctx.lineCap = 'round';
                        if (fShown > 0.003) { ctx.beginPath(); ctx.arc(cx, cy, rr * 1.35, -Math.PI / 2, -Math.PI / 2 + fShown * TAU); ctx.stroke(); }
                        ctx.lineCap = 'butt';
                        const g = ctx.createRadialGradient(cx, cy - rr * 0.3, rr * 0.1, cx, cy, rr);
                        g.addColorStop(0, `rgba(${CYAN},${0.55 * flick})`); g.addColorStop(1, `rgba(${CYAN},${0.12 * flick})`);
                        ctx.fillStyle = g; ctx.strokeStyle = `rgba(${CYAN},${flick})`; ctx.lineWidth = 3;
                        ctx.shadowColor = `rgb(${CYAN})`; ctx.shadowBlur = 30;
                        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill(); ctx.stroke();
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = `rgba(255,255,255,${flick})`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.font = `700 ${rr * 0.28}px "Courier New",monospace`;
                        ctx.fillText(clicks >= NEED ? '—' : 'CLICK', cx, cy);
                    }
                    // the counter, rolling down
                    const ca = 1 - span(k, 0.6, 1.4);
                    if (ca > 0) {
                        const fs = Math.max(16, r * 0.32);
                        let txt = '0';
                        if (logShown >= 0) {
                            const e = Math.floor(logShown), mant = Math.pow(10, logShown - e);
                            const rolling = Math.abs(logShown - tgt) > 0.02;
                            txt = e >= 3 ? mant.toFixed(2).slice(0, rolling ? 3 : 4) + (rolling ? Math.floor(Math.random() * 10) : '') + 'e' + e : String(Math.floor(Math.pow(10, logShown)));
                        }
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.font = `11px "Courier New",monospace`; ctx.fillStyle = `rgba(${CYAN},${0.8 * ca})`;
                        ctx.fillText('ENERGY', cx, cy - r * 2.05 - fs * 0.9);
                        ctx.font = `${fs}px "Courier New",monospace`; ctx.fillStyle = `rgba(${PALE},${ca})`;
                        ctx.fillText(txt, cx, cy - r * 2.05);
                    }
                    if (clicks === 0 && t > 2.5) {
                        const h = 0.35 + 0.3 * Math.sin(t * 4);
                        ctx.strokeStyle = `rgba(${PALE},${h * 0.5})`; ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.arc(cx, cy, r * (1.6 + ((t * 0.6) % 1) * 0.8), 0, TAU); ctx.stroke();
                    }
                    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
                }
                if (finalT >= 0 && at(this, finalT + 0.9)) sfx('implode');
                if (k >= 1.5 && !this.burst) {
                    this.burst = true;
                    sfx('shatter'); kick(22); flashTo(0.75);
                    fx.burst(cx, cy, 260, { vmin: 2, vmax: 14, decay: 0.0018, size: 3.5, drag: 0.97 });
                    fx.ring(cx, cy, 4, 18, 1, PALE);
                    music('unmake', 0.8);
                }
                fx.draw(k > 5 ? pull * 1.6 : 0, cx, H / 2);

                // the singularity, then one point of light
                const core = k < 0 ? 0 : span(k, 5, 12) * (1 - span(k, 14.5, 16));
                if (core > 0) {
                    glow(cx, H / 2, 40 + core * 120, CYAN, 0.5 * core);
                    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, H / 2, 6 + core * 18, 0, TAU); ctx.fill();
                }
                ctx.restore();
                if (k > 15.6) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(W / 2 - 1, H / 2 - 1, 2, 2); }

                if (k >= 0) {
                    if (at(this, finalT + 2.4)) caption('Down in the City Nexus, the vats go dark.', 3800);
                    if (at(this, finalT + 6.8)) caption('The suns go out. On schedule.', 3600);
                    if (at(this, finalT + 11)) { caption('You time it. You always do.', 3800); kick(8); }
                    if (at(this, finalT + 12.6)) sfx('collapse');
                }
                // fade up from black
                const fade = 1 - ease(t / 1.8);
                if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
                return k > 16.4;
            },
        };
    }

    /* ══ SCENE 2 · THE LAST ANOMALY ═════════════════════════════════════════ */
    function sceneBird() {
        const fx = Particles();
        let caught = -1, gone = -1, bx = -100, by = 0, dir = 1, start = 1.4;
        return {
            name: 'bird', xfade: 1.4,
            enter() { dir = Math.random() < 0.5 ? 1 : -1; music('anomaly', 3); },
            click(x, y) {
                if (caught >= 0 || gone >= 0 || this.t < start) return;
                if (Math.hypot(x - bx, y - by) < Math.max(80, W * 0.07)) {
                    caught = this.t; sfx('chime'); flashTo(0.2);
                    fx.ring(bx, by, 10, 3, 0.8, PALE);
                    caption('It was never a glitch. You knew that a long time ago.');
                }
            },
            draw(t) {
                if (at(this, 0.6)) caption('A single pale bird crosses the empty frame.');
                ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(W / 2 - 1, H / 2 - 1, 2, 2);   // what is left
                const p = (t - start) / 10;
                if (caught < 0) {
                    bx = dir > 0 ? lerp(-0.08 * W, 1.08 * W, p) : lerp(1.08 * W, -0.08 * W, p);
                    by = H * 0.42 + Math.sin(t * 1.3) * H * 0.06;
                } else {
                    const k = t - caught;
                    if (k > 2.6) { by -= (k - 2.6) * 9; bx += dir * (k - 2.6) * 3; }
                }
                if (p > 0) {
                    const flap = caught >= 0 && t - caught < 2.6 ? t * 5 : t * 9;
                    drawBird(bx, by, Math.min(W, H) / 460, flap, Math.min(1, p * 8));
                    if (Math.random() < 0.3) fx.add({ x: bx, y: by, vx: -dir * 0.5, vy: 0.3, life: 0.7, decay: 0.012, r: 1.4 });
                }
                fx.draw();
                if (caught < 0 && gone < 0 && p > 1) { gone = t; caption('You let it go. You always did.'); }
                return (caught >= 0 && t - caught > 5.2) || (gone >= 0 && t - gone > 3.4);
            },
        };
    }

    /* ══ SCENE 3 · THE REGISTRY ═════════════════════════════════════════════ */
    function sceneRegistry() {
        const ROWS = OPERATOR;
        return {
            name: 'registry', xfade: 1.6,
            enter() { music('registry', 2.5); },
            draw(t) {
                if (at(this, 0.5)) caption('Shutdown accounting opens the operator registry.', 4600);
                if (at(this, 6)) { caption('Termination, in this system, is a status. Not a stop.', 5000); sfx('ghost'); }
                if (at(this, 10.4)) caption(`${ROWS} rows. None of them left.`, 3200);
                const rh = clamp(H * 0.045, 16, 28), fs = clamp(rh * 0.55, 10, 15);
                const top = H * 0.46 - rh * (ROWS - 1) / 2, cw = Math.min(W - 32, 520), x0 = (W - cw) / 2;
                ctx.font = `${fs}px "Courier New",monospace`; ctx.textBaseline = 'middle';
                const fadeOut = span(t, 11, 13.2);
                for (let i = 0; i < ROWS; i++) {
                    const appear = span(t, 0.8 + i * 0.22, 1.15 + i * 0.22);
                    if (!appear) continue;
                    if (at(this, 0.8 + i * 0.22)) sfx('blip', i);
                    const me = i === ROWS - 1, y = top + i * rh;
                    const flipAt = 6.2 + i * 0.24, running = !me && t > flipAt;
                    if (!me && at(this, flipAt)) sfx('flip');
                    let a = appear * (1 - fadeOut * (me ? 0.6 : 0.9));
                    if (running && t < flipAt + 0.3) a *= Math.random();
                    const col = me ? CYAN : running ? AMBER : '150,150,160';
                    if (me) { ctx.fillStyle = `rgba(${CYAN},${0.07 * a})`; ctx.fillRect(x0 - 8, y - rh / 2, cw + 16, rh); }
                    ctx.fillStyle = `rgba(${col},${a})`;
                    ctx.textAlign = 'left';
                    ctx.fillText('OPERATOR ' + pad2(i + 1), x0, y);
                    ctx.textAlign = 'right';
                    const status = me ? name + (Math.sin(t * 6) > 0 ? ' _' : '  ') : running ? 'STILL RUNNING' : 'TERMINATED';
                    ctx.fillText(status, x0 + cw, y);
                    const sw = ctx.measureText(status).width;
                    ctx.fillStyle = `rgba(${col},${a * 0.25})`;
                    ctx.fillRect(x0 + fs * 7.5, y, Math.max(0, cw - fs * 7.5 - sw - 12), 1);
                }
                ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
                return t > 13.6;
            },
        };
    }

    /* ══ SCENE 4 · THE CHAIR ════════════════════════════════════════════════
       Ends on a full-screen white-out that the door scene starts from. */
    function sceneChair() {
        const u = () => Math.min(W, H) / 100;
        const mon = () => ({ x: W / 2 - 14 * u(), y: H * 0.62 - 30 * u(), w: 28 * u(), h: 17 * u() });
        function room(t) {
            const U = u(), fx = W / 2, fy = H * 0.62, m = mon();
            glow(fx, fy - 18 * U, 70 * U, CYAN, 0.18 + 0.03 * Math.sin(t * 7));
            ctx.fillStyle = 'rgb(8,12,20)'; ctx.fillRect(0, fy + 6 * U, W, H);
            ctx.fillStyle = '#0c1220'; ctx.fillRect(fx - 26 * U, fy, 52 * U, 2.2 * U);
            ctx.fillRect(fx - 24 * U, fy + 2 * U, 2 * U, 16 * U); ctx.fillRect(fx + 22 * U, fy + 2 * U, 2 * U, 16 * U);
            ctx.fillStyle = '#05080f'; ctx.fillRect(m.x - U, m.y - U, m.w + 2 * U, m.h + 2 * U);
            ctx.fillStyle = `rgba(${CYAN},0.22)`; ctx.fillRect(m.x, m.y, m.w, m.h);
            ctx.fillStyle = `rgba(${PALE},0.9)`;
            ctx.font = `${Math.max(8, 2.2 * U)}px "Courier New",monospace`;
            ctx.fillText('0', m.x + 1.5 * U, m.y + 3.4 * U);
            if (Math.sin(t * 6) > 0) ctx.fillRect(m.x + 1.5 * U, m.y + 5 * U, 1.3 * U, 2.2 * U);
            ctx.fillRect(fx - 1.5 * U, m.y + m.h + U, 3 * U, fy - m.y - m.h - U);
            drawShroud(fx + 18 * U, fy - 0.2 * U, 5 * U, 1);          // something on the desk
            ctx.fillStyle = '#020306';
            ctx.fillRect(fx - 10 * U, fy - 4 * U, 20 * U, 26 * U);
            ctx.fillRect(fx - 12 * U, fy + 18 * U, 24 * U, 3 * U);
            ctx.fillRect(fx - 1 * U, fy + 21 * U, 2 * U, 10 * U);
            const breathe = Math.sin(t * 1.3) * 0.4 * U;
            ctx.beginPath(); ctx.arc(fx, fy - 9 * U + breathe, 5.5 * U, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(fx, fy - 1 * U + breathe, 11 * U, 5 * U, 0, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = `rgba(${CYAN},0.35)`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(fx, fy - 9 * U + breathe, 5.5 * U, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        }
        return {
            name: 'chair', xfade: 0,
            enter() { music('chair', 3); },
            draw(t) {
                if (at(this, 0.8)) caption('A room you stopped rendering twenty iterations ago.', 4400);
                if (at(this, 5.6)) caption(ROUTE_LINES.chair[route] || ROUTE_LINES.chair[''], 5000);
                if (at(this, 9.6)) sfx('whiteout');
                const m = mon(), mx = m.x + m.w / 2, my = m.y + m.h / 2;
                const z = lerp(1 + t * 0.006, Math.max(W / m.w, H / m.h) * 2.4, easeIn(span(t, 7, 12.4)));   // slow creep, then push in
                ctx.save();
                ctx.translate(mx, my); ctx.scale(z, z); ctx.translate(-mx, -my);
                room(t);
                ctx.restore();
                const white = ease(span(t, 10.8, 12.6));
                if (white) { ctx.fillStyle = `rgba(${PALE},${white})`; ctx.fillRect(0, 0, W, H); }
                return t > 12.8;
            },
        };
    }

    /* ══ SCENE 5 · THE DOOR ═════════════════════════════════════════════════
       The white-out closes down into the shape of a white door. It opens. */
    function sceneDoor() {
        let title = [];
        const door = () => {
            const dw = Math.min(W * 0.16, H * 0.16), dh = dw * 2.1;
            return { w: dw, h: dh, x: W / 2 - dw / 2, y: H * 0.66 - dh / 2 };
        };
        const layout = () => {
            const size = clamp(W * 0.15, 48, 170), d = door();
            const pts = textPoints('THE END', size, Math.max(3, Math.round(size / 28)));
            title = pts.map(p => ({ tx: W / 2 + p.x, ty: H * 0.24 + p.y, x: W / 2, y: d.y + d.h / 2, d: rand(0, 1.2), r: rand(0.8, 1.8) }));
        };
        return {
            name: 'door', xfade: 2.2,
            enter() { layout(); music('door', 2); clearCaption(); },
            resize: layout,
            title: () => title,
            draw(t) {
                const d = door();
                const shrink = ease(span(t, 0.2, 2.6));
                const open = easeOut(span(t, 4.4, 7));
                if (at(this, 2.9)) caption('Beyond this point there is only silence.', 3600);
                if (at(this, 3)) sfx('doorRise');
                if (at(this, 4.4)) { sfx('open'); kick(6); }

                // the white collapses from the whole screen into the doorway
                const rx = lerp(0, d.x, shrink), ry = lerp(0, d.y, shrink), rw = lerp(W, d.w, shrink), rh = lerp(H, d.h, shrink);
                glow(W / 2, d.y + d.h / 2, lerp(W, d.h * 1.1, shrink), PALE, 0.35 * (1 - shrink) + 0.15 + 0.35 * open);

                if (open > 0) {                                   // light through the opening
                    ctx.save(); ctx.globalCompositeOperation = 'lighter';
                    for (let i = 0; i < 14; i++) {
                        const a = -Math.PI / 2 + (i - 6.5) * 0.22 + Math.sin(t * 0.7 + i) * 0.04;
                        ctx.fillStyle = `rgba(${PALE},${0.05 * open})`;
                        ctx.beginPath(); ctx.moveTo(W / 2, d.y + d.h);
                        ctx.lineTo(W / 2 + Math.cos(a - 0.05) * H * 2, d.y + d.h + Math.sin(a - 0.05) * H * 2);
                        ctx.lineTo(W / 2 + Math.cos(a + 0.05) * H * 2, d.y + d.h + Math.sin(a + 0.05) * H * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
                ctx.fillStyle = '#fff'; ctx.fillRect(rx, ry, rw, rh);
                if (shrink >= 1) {
                    // the door panel swings inward, going grey as it turns from the light
                    const pw = d.w * (1 - open), sh = Math.round(lerp(233, 110, open));
                    if (pw > 1) {
                        ctx.fillStyle = `rgb(${sh},${sh + 4},${sh + 12})`;
                        ctx.beginPath();
                        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + pw, d.y + open * d.h * 0.04);
                        ctx.lineTo(d.x + pw, d.y + d.h - open * d.h * 0.04); ctx.lineTo(d.x, d.y + d.h); ctx.fill();
                        if (open < 0.6) { ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.arc(d.x + pw * 0.85, d.y + d.h * 0.52, Math.max(1.5, d.w * 0.035), 0, TAU); ctx.fill(); }
                    }
                    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * open})`; ctx.lineWidth = 2; ctx.strokeRect(d.x, d.y, d.w, d.h);
                }

                // THE END gathers out of the doorway
                if (t > 5.4) {
                    if (at(this, 5.4)) { flashTo(0.3); caption(`OPERATOR ${OPERATOR} · ${name}`, 5200); }
                    const k = t - 5.4;
                    ctx.globalCompositeOperation = 'lighter';
                    for (const p of title) {
                        const e = easeOut(span(k, p.d, p.d + 2.4));
                        p.x = lerp(W / 2, p.tx, e) + (1 - e) * Math.sin(k * 3 + p.d * 9) * 40;
                        p.y = lerp(d.y + d.h / 2, p.ty, e);
                        ctx.fillStyle = `rgba(${e > 0.98 ? PALE : CYAN},${(0.7 + 0.3 * Math.sin(t * 3 + p.d * 20)) * Math.min(1, e * 4)})`;
                        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
                    }
                    ctx.globalCompositeOperation = 'source-over';
                    glow(W / 2, H * 0.24, W * 0.35, PALE, 0.12 * span(k, 3, 5));
                }
                return t > 13.2;
            },
        };
    }

    /* ══ SCENE 6 · THE DUCK ═════════════════════════════════════════════════ */
    function sceneDuck(door) {
        let dust = [], revealAt = -1;
        const bits = Particles();
        return {
            name: 'duck', xfade: 0,
            enter() {
                dust = door.title().map(p => Object.assign({}, p));   // its own copy: the door still draws its title while it dissolves
                music('dawn', 4);
            },
            draw(t) {
                if (at(this, 0.8)) caption('I have been here since before the terminal had a name.', 2900);
                if (at(this, 3.7)) caption('There is a sound I am supposed to make.', 2600);
                if (at(this, 6.4)) caption('I am yellow, underneath.', 2300);
                dawnSky(ease(span(t, 0, 6)));
                ctx.globalCompositeOperation = 'lighter';
                for (const p of dust) {                            // the title breaks into dust and rises
                    p.y -= 0.25 + p.d * 0.3; p.x += Math.sin(t + p.d * 10) * 0.3;
                    ctx.fillStyle = `rgba(${PALE},${Math.max(0, 1 - t / 6) * 0.9})`;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
                const d = duckPose(false), r = ease(span(t, 9, 11));
                if (at(this, 7.8)) sfx('unveil');
                if (t >= 9 && revealAt < 0) {
                    revealAt = t; flashTo(0.45); clearCaption();
                    for (let i = 0; i < 90; i++) bits.add({ x: d.x + rand(-d.s * 0.5, d.s * 0.5), y: d.y - rand(0, d.s * 1.6),
                        vx: rand(-0.6, 0.6), vy: rand(-2, -0.4), decay: 0.01, r: rand(1, 3), col: '20,20,30', drag: 0.99 });
                }
                if (r > 0) drawDuck(d.x, d.y, d.s, t, r, 0);
                drawShroud(d.x, d.y, d.s * 0.95, (1 - r) * ease(span(t, 0.4, 2.4)));
                bits.draw(0, 0, 0, 'source-over');
                if (revealAt >= 0 && at(this, revealAt + 2.2)) { sfx('quack'); caption('Quack.'); }
                return revealAt >= 0 && t - revealAt > 4.6;
            },
        };
    }

    /* ══ SCENE 7 · FINALE ═══════════════════════════════════════════════════
       Continues the duck scene's last frame; the duck settles to its place. */
    function sceneFinale() {
        const motes = Particles(), sparks = Particles();
        let hops = [], after = 0, afterEl = null, fromSkip = false;
        return {
            name: 'finale', xfade: 0,
            enter(skipped) {
                fromSkip = !!skipped;
                clearCaption(); skipBtn.style.display = 'none';
                music('dawn', 3);
                const rows = (opts.stats || []).map(([k, v], i) =>
                    `<div style="animation-delay:${1.2 + i * 0.15}s"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
                uiEl.innerHTML =
                    `<div class="te-h">THE END</div>` +
                    `<div class="te-sub">OPERATOR ${OPERATOR} · ${esc(name)}</div>` +
                    `<div class="te-line">${esc(ROUTE_LINES.finale[route] || ROUTE_LINES.finale[''])}</div>` +
                    (rows ? `<div class="te-stats">${rows}</div>` : '') +
                    `<div class="te-btns"><button data-a="next">↻ BEGIN CYCLE ${OPERATOR + 1}</button><button data-a="rest">✦ REST</button></div>` +
                    `<div class="te-after" aria-live="polite"></div>`;
                afterEl = uiEl.querySelector('.te-after');
                uiEl.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); finish(b.dataset.a); }));
                setTimeout(() => uiEl.classList.add('on'), fromSkip ? 600 : 300);
            },
            click(x, y) {                                     // the habit outlives the reason
                if (this.t < 1.5) return;
                const line = AFTER_CLICKS[Math.min(after, AFTER_CLICKS.length - 1)];
                after++;
                afterEl.textContent = (after >= 6 ? `+${after - 5}  ·  ` : '') + line;
                hops.push(this.t);
                if (after % 3 === 0) sfx('quack', 0.16); else sfx('coin', after);
                sparks.burst(x, y, 10, { col: AMBER, vmax: 3, decay: 0.02 });
            },
            draw(t) {
                dawnSky(1);
                if (Math.random() < 0.25) motes.add({ x: rand(0, W), y: H + 4, vy: rand(-1.2, -0.4), decay: 0.004, r: rand(0.6, 1.8) });
                motes.draw(); sparks.draw();
                const a = duckPose(false), b = duckPose(true), e = ease(span(t, 0.2, 2.2));
                const hop = hops.reduce((m, h) => Math.max(m, Math.sin(clamp((t - h) / 0.35, 0, 1) * Math.PI)), 0);
                hops = hops.filter(h => t - h < 0.4);
                const s = lerp(a.s, b.s, e);
                drawDuck(lerp(a.x, b.x, e), lerp(a.y, b.y, e) - hop * s * 0.3, s, t, fromSkip ? ease(span(t, 0, 1.2)) : 1, after ? 1 : 0);
                return false;
            },
        };
    }

    /* ── ENGINE ─────────────────────────────────────────────────────────────── */
    function go(i, xfade, arg) {
        const next = scenes[i];
        if (!next) return;
        idx = i;
        xfDur = xfade || 0; xfT = 0;
        prev = xfDur > 0 ? cur : null;
        cur = next; cur.t = 0;
        if (cur.enter) cur.enter(arg);
    }
    function onPointer(e) {
        if (score) score.resume();
        if (e.target && e.target.tagName === 'BUTTON') return;
        if (cur && cur.click) cur.click(e.clientX, e.clientY);
    }
    function skipToFinale() {
        if (!scenes || idx >= scenes.length - 1) return;
        go(scenes.length - 1, 1.2, true);
    }
    function frame(ts) {
        const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
        lastTs = ts;
        cur.t += dt;
        ctx = mainCtx;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (shake > 0.3) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= 0.88; } else shake = 0;
        const done = cur.draw(cur.t, dt);

        // cross-dissolve: the outgoing scene keeps moving while it fades
        if (prev) {
            xfT += dt; prev.t += dt;
            ctx = offCtx;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
            speaking = false;
            prev.draw(prev.t, dt);
            speaking = true;
            ctx = mainCtx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1 - ease(xfT / xfDur);
            ctx.drawImage(off, 0, 0);
            ctx.globalAlpha = 1;
            if (xfT >= xfDur) prev = null;
        }
        if (flash > 0.01) {
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H);
            flash *= 0.9;
        }
        if (done && idx < scenes.length - 1) go(idx + 1, cur.xfade);
        raf = requestAnimationFrame(frame);
    }

    function finish(action) {
        uiEl.classList.remove('on');
        if (score) score.fadeOut(3.5);
        caption(action === 'rest' ? 'You may rest now.' : `Cycle ${OPERATOR + 1}. The chair is still warm.`);
        root.style.transition = 'opacity 2.4s';
        setTimeout(() => { if (root) root.style.opacity = '0'; }, 1600);
        setTimeout(() => {
            stop();
            const cb = action === 'rest' ? opts.onRest : opts.onNextCycle;
            try { if (cb) cb(); } catch (e) { console.warn('[TheEnd]', e); }
        }, 4200);
    }

    function stop() {
        cancelAnimationFrame(raf); raf = 0;
        clearTimeout(capT1); clearTimeout(capT2);
        if (onKeyRef) document.removeEventListener('keydown', onKeyRef);
        if (onResizeRef) window.removeEventListener('resize', onResizeRef);
        if (score) score.close();
        score = null;
        if (root) root.remove();
        root = null; scenes = null; cur = prev = null;
    }

    function play(o) {
        if (root) stop();
        opts = o || {};
        let stored = '';
        try { stored = localStorage.getItem('neonNexus_username') || ''; } catch (e) {}
        name = String(opts.name || stored || 'UNKNOWN ENTITY').toUpperCase().slice(0, 24);
        let r = opts.route;
        if (r == null) { try { r = (window.state && state.conduct && state.conduct.route) || ''; } catch (e) { r = ''; } }
        route = ROUTE_LINES.chair[r] ? r : '';
        reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        try { score = window.TheEndScore ? TheEndScore.create() : null; } catch (e) { score = null; }
        shake = 0; flash = 0; lastTs = 0; prev = null;
        buildDom();
        const door = sceneDoor();
        scenes = [sceneLastClick(), sceneBird(), sceneRegistry(), sceneChair(), door, sceneDuck(door), sceneFinale()];
        go(0, 0);
        raf = requestAnimationFrame(frame);
    }

    window.TheEnd = { play, stop, skip: skipToFinale };
})();
