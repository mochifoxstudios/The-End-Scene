/* ══ THE END — cinematic finale ═══════════════════════════════════════════════
   Self-contained: builds its own overlay, canvas and synth audio. No assets.

     TheEnd.play({
       name:  'OPERATOR NAME',            // defaults to neonNexus_username
       route: 'tend'|'extract'|'administer'|'',  // defaults to state.conduct.route
       stats: [['TOTAL CLICKS', '12,345'], ...],  // optional finale rows
       onNextCycle() {}, onRest() {},     // finale buttons (both close first)
     });

   Eight scenes, ~95s, three of them answer the player's hands:
     1 LAST CLICK   — you spend it all, one click at a time
     2 UNMAKING     — the city goes dark, the stars are pulled in
     3 LAST ANOMALY — the pale bird crosses; catch it or let it go
     4 REGISTRY     — fifteen rows; fourteen of them still running
     5 THE CHAIR    — the room you stopped rendering
     6 THE DOOR     — the white door opens; THE END is made of what's left
     7 THE DUCK     — the shroud comes off
     8 FINALE       — nothing left to click (you will click anyway)
   Skip / Esc jumps to the finale. Reduced motion drops shake and flashes.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const CYAN = '68,170,220', PALE = '232,240,255', AMBER = '255,196,120';
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const easeIn = t => { t = clamp(t, 0, 1); return t * t * t; };
    const easeOut = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
    const rand = (a, b) => a + Math.random() * (b - a);
    const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
    /* Fires once when a scene's clock passes `time` — frame-rate independent. */
    const cue = (s, t, time) => {
        s._cues = s._cues || {};
        if (t < time || s._cues[time]) return false;
        return (s._cues[time] = true);
    };

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

    let root, cv, ctx, capEl, uiEl, skipBtn;
    let W = 0, H = 0, DPR = 1, raf = 0, lastTs = 0;
    let opts = {}, name = '', route = '', reduced = false;
    let scenes, si = 0, st = 0, shake = 0, flash = 0;
    let stars = [], city = [], parts = [], rings = [];
    let audio = null;
    let onKeyRef = null, onResizeRef = null;

    /* ── AUDIO: small synth, every call is safe without a context ───────────── */
    function Audio() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const ac = new AC();
        const master = ac.createGain();
        master.gain.value = 0.55;
        const delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
        delay.delayTime.value = 0.32; fb.gain.value = 0.38; wet.gain.value = 0.3;
        master.connect(ac.destination);
        master.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ac.destination);
        const now = () => ac.currentTime;
        function tone(freq, dur, vol, type, glideTo, at) {
            const t = now() + (at || 0);
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = type || 'sine';
            o.frequency.setValueAtTime(freq, t);
            if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(master);
            o.start(t); o.stop(t + dur + 0.05);
            return o;
        }
        function noise(dur, vol, fType, fFrom, fTo) {
            const t = now();
            const buf = ac.createBuffer(1, Math.max(1, ac.sampleRate * dur), ac.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
            src.buffer = buf; f.type = fType || 'lowpass';
            f.frequency.setValueAtTime(fFrom, t);
            if (fTo) f.frequency.exponentialRampToValueAtTime(fTo, t + dur);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(f); f.connect(g); g.connect(master);
            src.start(t);
        }
        function pad(freqs, dur, vol, fadeIn) {
            const t = now(), g = ac.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol, t + (fadeIn || 2));
            g.gain.setValueAtTime(vol, t + dur - 2);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            g.connect(master);
            freqs.forEach(fq => [-3, 0, 3].forEach(det => {
                const o = ac.createOscillator();
                o.type = 'sine'; o.frequency.value = fq; o.detune.value = det * 3;
                o.connect(g); o.start(t); o.stop(t + dur + 0.1);
            }));
        }
        return {
            resume() { if (ac.state === 'suspended') ac.resume(); },
            thud(i) { tone(140 - i * 14, 0.5, 0.5, 'sine', 32); noise(0.12, 0.25, 'lowpass', 900, 120); },
            shatter() { noise(1.4, 0.4, 'highpass', 5000, 400); tone(60, 2.2, 0.5, 'sine', 24); },
            drone(dur) { pad([36.7, 55, 73.4], dur, 0.22, 3); },
            chime() { tone(1318, 2.2, 0.16); tone(1976, 2.6, 0.08, 'sine', null, 0.08); },
            blip(i) { tone(660 + (i % 3) * 110, 0.07, 0.05, 'square'); },
            swell() { noise(5, 0.18, 'lowpass', 120, 6000); pad([146.8, 185, 220, 293.7], 9, 0.13, 4); },
            title() { pad([73.4, 146.8, 220, 277.2, 370], 14, 0.12, 1.5); tone(1174, 4, 0.05); },
            quack() {
                const t = now(), o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.2);
                f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3;
                g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
                o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
            },
            fade(sec) {
                const t = now();
                master.gain.cancelScheduledValues(t);
                master.gain.setValueAtTime(master.gain.value, t);
                master.gain.linearRampToValueAtTime(0.0001, t + sec);
            },
            close() { try { ac.close(); } catch (e) {} },
        };
    }
    const sfx = (fn, ...a) => { try { if (audio && audio[fn]) audio[fn](...a); } catch (e) {} };

    /* ── DOM ────────────────────────────────────────────────────────────────── */
    const CSS = `
#the-end{position:fixed;inset:0;z-index:10050;background:#000;overflow:hidden;cursor:default;
  font-family:"Courier New",ui-monospace,monospace;color:rgb(${PALE});user-select:none;-webkit-user-select:none}
#the-end canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#te-cap{position:absolute;left:16px;right:16px;bottom:12%;text-align:center;font-size:clamp(14px,2.2vw,20px);
  letter-spacing:.06em;line-height:1.6;pointer-events:none;text-shadow:0 0 12px rgba(${CYAN},.6)}
#te-cap span{opacity:0;animation:te-in .5s forwards}
#te-cap.te-out{transition:opacity .7s;opacity:0}
@keyframes te-in{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:none}}
#the-end button{width:auto;height:auto;margin:0;min-width:0;box-sizing:border-box;text-transform:none;box-shadow:none}
#te-skip{position:absolute;top:16px;right:16px;background:transparent;border:1px solid rgba(${CYAN},.4);
  color:rgba(${CYAN},.8);font:inherit;font-size:11px;letter-spacing:.16em;padding:6px 12px;border-radius:4px;cursor:pointer;opacity:.6}
#te-skip:hover{opacity:1}
#te-ui{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  padding:9vh 16px 0;pointer-events:none;opacity:0;transition:opacity 1.6s}
#te-ui.on{opacity:1}
#te-ui .te-h{font-size:clamp(34px,8vw,72px);font-weight:700;letter-spacing:.3em;margin-right:-.3em;
  color:#fff;text-shadow:0 0 24px rgba(${PALE},.8),0 0 60px rgba(${CYAN},.5)}
#te-ui .te-sub{margin-top:10px;font-size:13px;letter-spacing:.2em;color:rgba(${CYAN},.9)}
#te-ui .te-line{margin-top:18px;max-width:560px;text-align:center;font-size:14px;line-height:1.7;color:rgba(${PALE},.75)}
#te-ui .te-stats{margin-top:18px;width:min(420px,100%);font-size:12px;letter-spacing:.1em}
#te-ui .te-stats div{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(${CYAN},.15);
  opacity:0;animation:te-in .6s forwards}
#te-ui .te-stats b{color:#fff;font-weight:400}
#te-ui .te-btns{margin-top:26px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;pointer-events:auto}
#te-ui button{background:rgba(0,0,0,.35);border:1px solid rgba(${PALE},.5);color:#fff;font:inherit;font-size:12px;
  letter-spacing:.18em;padding:11px 20px;border-radius:4px;cursor:pointer;transition:background .2s,box-shadow .2s}
#te-ui button:hover{background:rgba(${PALE},.12);box-shadow:0 0 18px rgba(${PALE},.35)}
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
        root.innerHTML = '<canvas></canvas><div id="te-cap" aria-live="polite"></div>' +
                         '<div id="te-ui"></div><button id="te-skip">SKIP ⏭</button>';
        document.body.appendChild(root);
        cv = root.querySelector('canvas');
        ctx = cv.getContext('2d');
        capEl = root.querySelector('#te-cap');
        uiEl = root.querySelector('#te-ui');
        skipBtn = root.querySelector('#te-skip');
        skipBtn.addEventListener('click', e => { e.stopPropagation(); skipToFinale(); });
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
        cv.width = W * DPR; cv.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        buildWorld();
        if (scenes && scenes[si].resize) scenes[si].resize();
    }

    function caption(text, ms) {
        capEl.classList.remove('te-out');
        capEl.innerHTML = '';
        [...text].forEach((ch, i) => {
            const s = document.createElement('span');
            s.textContent = ch;
            s.style.animationDelay = (i * 0.028) + 's';
            capEl.appendChild(s);
        });
        clearTimeout(caption._t);
        if (ms) caption._t = setTimeout(() => capEl.classList.add('te-out'), ms);
    }
    const clearCaption = () => { clearTimeout(caption._t); capEl.classList.add('te-out'); };

    /* ── WORLD: stars, city, particles ──────────────────────────────────────── */
    function buildWorld() {
        const n = Math.round(clamp(W * H / 5000, 120, 320));
        stars = [];
        for (let i = 0; i < n; i++) stars.push({
            x: Math.random() * W, y: Math.random() * H * 0.8, r: rand(0.4, 1.8),
            tw: Math.random() * TAU, a: 1, dying: false,
        });
        city = [];
        for (let x = -10; x < W + 10;) {
            const w = rand(28, 70), h = rand(0.1, 0.34) * H;
            const cols = Math.max(2, Math.floor(w / 11)), rows = Math.floor(h / 14);
            const win = [];
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
                if (Math.random() < 0.55) win.push({ c, r, hue: Math.random() < 0.8 ? CYAN : '255,90,200', on: true });
            city.push({ x, w, h, cols, win, sink: rand(0, 0.4) });
            x += w + rand(2, 8);
        }
    }

    function drawStars(t, pull) {
        const cx = W / 2, cy = H / 2;
        for (const s of stars) {
            if (s.dying) s.a -= 0.03;
            if (pull > 0) {
                const dx = cx - s.x, dy = cy - s.y, d = Math.hypot(dx, dy) || 1;
                const sp = pull * (2 + 900 / (d + 40));
                s.x += dx / d * sp + (-dy / d) * sp * 0.35;   // spiral in
                s.y += dy / d * sp + (dx / d) * sp * 0.35;
                if (d < 8) s.a = 0;
            }
            if (s.a <= 0) continue;
            const a = s.a * (0.55 + 0.45 * Math.sin(t * 2 + s.tw));
            ctx.fillStyle = `rgba(${PALE},${a})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
        }
    }

    function drawCity(sweepX, sinkT, alpha) {
        const base = H;
        for (const b of city) {
            const off = easeIn(span(sinkT, b.sink, b.sink + 0.6)) * (b.h + 20);
            const top = base - b.h + off;
            ctx.fillStyle = `rgba(6,10,22,${alpha})`;
            ctx.fillRect(b.x, top, b.w, b.h);
            ctx.strokeStyle = `rgba(${CYAN},${0.25 * alpha})`;
            ctx.strokeRect(b.x + 0.5, top + 0.5, b.w - 1, b.h);
            const cw = b.w / b.cols;
            for (const w of b.win) {
                if (w.on && b.x + w.c * cw < sweepX) w.on = Math.random() < 0.9;   // flicker, then out
                if (!w.on) continue;
                ctx.fillStyle = `rgba(${w.hue},${0.8 * alpha})`;
                ctx.fillRect(b.x + w.c * cw + 3, top + 8 + w.r * 14, cw - 6, 6);
            }
        }
    }

    function burst(x, y, n, o) {
        o = o || {};
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, v = rand(o.vmin || 1, o.vmax || 6);
            parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.8, 1), decay: o.decay || 0.008,
                r: rand(1, o.size || 3), col: o.col || CYAN, drag: o.drag || 0.985, pull: o.pull || 0, grav: o.grav || 0 });
        }
    }
    function drawParts(pull) {
        const cx = W / 2, cy = H / 2;
        ctx.globalCompositeOperation = 'lighter';
        parts = parts.filter(p => p.life > 0);
        for (const p of parts) {
            const pl = pull || p.pull;
            if (pl) { p.vx += (cx - p.x) * 0.0009 * pl; p.vy += (cy - p.y) * 0.0009 * pl; }
            p.vy += p.grav;
            p.vx *= p.drag; p.vy *= p.drag;
            p.x += p.vx; p.y += p.vy; p.life -= p.decay;
            ctx.fillStyle = `rgba(${p.col},${clamp(p.life, 0, 1)})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.6), 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    function drawRings() {
        rings = rings.filter(r => r.a > 0.01);
        for (const r of rings) {
            r.r += r.v; r.a *= 0.94;
            ctx.strokeStyle = `rgba(${r.col || CYAN},${r.a})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
        }
    }
    function glow(x, y, r, col, a) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const kick = n => { if (!reduced) shake = Math.max(shake, n); };
    const flashTo = a => { if (!reduced) flash = Math.max(flash, a); };

    /* ── ART: bird, room, door, duck ────────────────────────────────────────── */
    function drawBird(x, y, s, flap, a) {
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        glow(0, 0, 40, PALE, 0.25 * a);
        ctx.strokeStyle = `rgba(${PALE},${a})`; ctx.fillStyle = `rgba(${PALE},${a})`;
        ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        const wy = Math.sin(flap) * 12;
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-12, -8 + wy * 0.3, -24, wy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(12, -8 + wy * 0.3, 24, wy); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 1, 5, 2.6, 0, 0, TAU); ctx.fill();
        ctx.restore();
    }

    function drawRoom(t) {
        const u = Math.min(W, H) / 100, fx = W / 2, fy = H * 0.62;
        glow(fx, fy - 18 * u, 70 * u, CYAN, 0.18 + 0.03 * Math.sin(t * 7));   // monitor light
        ctx.fillStyle = 'rgba(8,12,20,1)';
        ctx.fillRect(0, fy + 6 * u, W, H);                                     // floor
        ctx.fillStyle = '#0c1220'; ctx.fillRect(fx - 26 * u, fy, 52 * u, 2.2 * u);   // desk top
        ctx.fillRect(fx - 24 * u, fy + 2 * u, 2 * u, 16 * u); ctx.fillRect(fx + 22 * u, fy + 2 * u, 2 * u, 16 * u);
        const m = monitorRect();
        ctx.fillStyle = '#05080f'; ctx.fillRect(m.x - u, m.y - u, m.w + 2 * u, m.h + 2 * u);
        ctx.fillStyle = `rgba(${CYAN},0.22)`; ctx.fillRect(m.x, m.y, m.w, m.h);
        ctx.fillStyle = `rgba(${PALE},0.9)`;
        ctx.font = `${Math.max(8, 2.2 * u)}px "Courier New",monospace`;
        ctx.fillText('0', m.x + 1.5 * u, m.y + 3.4 * u);
        if (Math.sin(t * 6) > 0) ctx.fillRect(m.x + 1.5 * u, m.y + 5 * u, 1.3 * u, 2.2 * u);   // cursor
        ctx.fillRect(fx - 1.5 * u, m.y + m.h + u, 3 * u, fy - m.y - m.h - u);             // stand
        // the shape on the desk corner — something standing in front of something
        drawShroud(fx + 18 * u, fy - 0.2 * u, 5 * u, 1);
        // chair + Operator, from behind
        ctx.fillStyle = '#020306';
        ctx.fillRect(fx - 10 * u, fy - 4 * u, 20 * u, 26 * u);                 // chair back
        ctx.fillRect(fx - 12 * u, fy + 18 * u, 24 * u, 3 * u);                 // seat
        ctx.fillRect(fx - 1 * u, fy + 21 * u, 2 * u, 10 * u);                  // post
        const breathe = Math.sin(t * 1.3) * 0.4 * u;
        ctx.beginPath(); ctx.arc(fx, fy - 9 * u + breathe, 5.5 * u, 0, TAU); ctx.fill();   // head
        ctx.beginPath(); ctx.ellipse(fx, fy - 1 * u + breathe, 11 * u, 5 * u, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = `rgba(${CYAN},0.35)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(fx, fy - 9 * u + breathe, 5.5 * u, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    function monitorRect() {
        const u = Math.min(W, H) / 100;
        return { x: W / 2 - 14 * u, y: H * 0.62 - 30 * u, w: 28 * u, h: 17 * u };
    }

    function drawShroud(x, baseY, s, a) {
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
        ctx.beginPath(); ctx.ellipse(0, -28, 62, 36, 0, 0, TAU); ctx.fill();          // body
        ctx.beginPath(); ctx.moveTo(48, -40); ctx.quadraticCurveTo(78, -62, 70, -30); ctx.quadraticCurveTo(62, -24, 48, -28); ctx.fill(); // tail
        ctx.beginPath(); ctx.arc(-30 + look * 4, -78, 32, 0, TAU); ctx.fill();         // head
        ctx.fillStyle = '#ff8a1c';
        ctx.beginPath(); ctx.ellipse(-64 + look * 6, -72, 20, 8, -0.1, 0, TAU); ctx.fill();   // bill
        ctx.fillStyle = '#1a1206';
        ctx.beginPath(); ctx.arc(-40 + look * 5, -86, 5, 0, TAU); ctx.fill();          // eye
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-38 + look * 5, -88, 1.6, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.ellipse(-18, -96, 10, 5, -0.5, 0, TAU); ctx.fill();       // highlight
        ctx.strokeStyle = 'rgba(200,140,0,.6)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-10, -30); ctx.quadraticCurveTo(15, -10, 35, -34); ctx.stroke(); // wing
        ctx.restore();
        ctx.strokeStyle = `rgba(${PALE},${0.35 * a})`; ctx.lineWidth = 1.5;            // water
        for (let i = 0; i < 3; i++) {
            const rr = s * (0.7 + i * 0.25) + Math.sin(t * 2 + i) * 4;
            ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.12, 0, 0, TAU); ctx.stroke();
        }
    }

    /* Sample text into points — THE END is built from what is left of the universe. */
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

    /* ── SCENES ─────────────────────────────────────────────────────────────── */
    function makeScenes() {
        const S = {};

        /* 1 · LAST CLICK — the counter goes DOWN. */
        S.click = (() => {
            let clicks = 0, idle = 0, cracked = -1, cracks = [];
            const NEED = 5;
            const R = () => Math.min(W, H) * 0.11;
            const value = () => clicks >= NEED ? 0 : 1e34 * Math.pow(1 - clicks / NEED, 4);
            let shown = 1e34;
            return {
                enter() { caption('One purchase left. Spend it.'); },
                click() {
                    if (clicks >= NEED) return;
                    clicks++; idle = 0;
                    sfx('thud', clicks);
                    kick(4 + clicks * 2);
                    rings.push({ x: W / 2, y: H / 2, r: R(), v: 7, a: 0.9 });
                    burst(W / 2, H / 2, 24, { vmax: 7 });
                    stars.filter(s => !s.dying).slice(0, Math.ceil(stars.length / (NEED * 2))).forEach(s => s.dying = true);
                    if (clicks === 3) caption('Every unit you ever gathered. In four milliseconds.');
                    if (clicks >= NEED) {
                        cracked = st;
                        for (let i = 0; i < 9; i++) {
                            const a = rand(0, TAU); let x = 0, y = 0; const seg = [[0, 0]];
                            for (let k = 0; k < 4; k++) { x += Math.cos(a + rand(-.5, .5)) * R() * .3; y += Math.sin(a + rand(-.5, .5)) * R() * .3; seg.push([x, y]); }
                            cracks.push(seg);
                        }
                    }
                },
                draw(t, dt) {
                    idle += dt;
                    if (idle > 3.2 && clicks < NEED) this.click();    // it spends itself if you hesitate
                    drawStars(t, 0);
                    const cx = W / 2, cy = H / 2, r = R();
                    shown = lerp(shown, value(), 0.12);
                    if (cracked < 0 || st - cracked < 0.9) {
                        const pulse = 1 + Math.sin(t * 4) * 0.03;
                        glow(cx, cy, r * 3, CYAN, 0.35);
                        ctx.fillStyle = `rgba(${CYAN},0.15)`;
                        ctx.strokeStyle = `rgba(${CYAN},1)`; ctx.lineWidth = 3;
                        ctx.shadowColor = `rgb(${CYAN})`; ctx.shadowBlur = 30;
                        ctx.beginPath(); ctx.arc(cx, cy, r * pulse, 0, TAU); ctx.fill(); ctx.stroke();
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.font = `700 ${r * 0.28}px "Courier New",monospace`;
                        ctx.fillText('CLICK', cx, cy);
                        ctx.font = `${Math.max(16, r * 0.32)}px "Courier New",monospace`;
                        ctx.fillStyle = `rgba(${PALE},0.95)`;
                        ctx.fillText(shown < 1 ? '0' : shown < 1e3 ? Math.floor(shown) + '' : shown.toExponential(2), cx, cy - r * 1.7);
                        ctx.font = `11px "Courier New",monospace`; ctx.fillStyle = `rgba(${CYAN},0.8)`;
                        ctx.fillText('ENERGY', cx, cy - r * 1.7 - Math.max(16, r * 0.32));
                        if (cracked >= 0) {
                            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                            cracks.forEach(seg => { ctx.beginPath(); seg.forEach(([x, y], k) => k ? ctx.lineTo(cx + x, cy + y) : ctx.moveTo(cx + x, cy + y)); ctx.stroke(); });
                        } else if (clicks === 0 && t > 1.2) {
                            ctx.fillStyle = `rgba(${PALE},${0.4 + 0.3 * Math.sin(t * 5)})`;
                            ctx.font = '12px "Courier New",monospace';
                            ctx.fillText('▲ click', cx, cy + r * 1.6);
                        }
                        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
                    } else if (!this.shattered) {
                        this.shattered = true;
                        sfx('shatter'); kick(22); flashTo(0.8);
                        burst(cx, cy, 260, { vmin: 2, vmax: 14, decay: 0.0022, size: 3.5, drag: 0.97 });
                        rings.push({ x: cx, y: cy, r: r, v: 16, a: 1, col: PALE });
                    }
                    drawRings(); drawParts();
                    return this.shattered && st - cracked > 2.2;
                },
            };
        })();

        /* 2 · UNMAKING — the city goes dark, the sky is pulled in. */
        S.unmake = {
            enter() { sfx('drone', 40); caption('Down in the City Nexus, the vats go dark.', 4500); },
            draw(t) {
                if (cue(this, t, 5.5)) caption('The suns go out. On schedule.', 4200);
                if (cue(this, t, 10.5)) caption('You time it. You always do.', 4200);
                const pull = easeIn(span(t, 5, 12)) * 1.4;
                drawStars(t, pull);
                drawCity(span(t, 0.5, 6) * (W + 60), span(t, 9, 15), 1 - span(t, 13, 15.5));
                drawParts(pull * 1.5 + 0.2);
                const core = span(t, 5, 12) * (1 - span(t, 14.5, 16));
                if (core > 0) {
                    glow(W / 2, H / 2, 40 + core * 120, CYAN, 0.5 * core);
                    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 6 + core * 18, 0, TAU); ctx.fill();
                }
                if (cue(this, t, 12)) kick(10);
                if (t > 15.8) { ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 1, H / 2 - 1, 2, 2); }
                return t > 17;
            },
        };

        /* 3 · THE LAST ANOMALY — a pale bird. Catch it, or don't. */
        S.bird = (() => {
            let caught = -1, gone = -1, bx = 0, by = 0, dir = 1;
            return {
                enter() { parts = []; caption('A single pale bird crosses the empty frame.'); dir = Math.random() < 0.5 ? 1 : -1; },
                click(x, y) {
                    if (caught >= 0 || gone >= 0) return;
                    if (Math.hypot(x - bx, y - by) < Math.max(70, W * 0.06)) {
                        caught = st; sfx('chime'); flashTo(0.25);
                        rings.push({ x: bx, y: by, r: 10, v: 3, a: 0.8, col: PALE });
                        caption('It was never a glitch. You knew that a long time ago.');
                    }
                },
                draw(t) {
                    const p = t / 10;
                    if (caught < 0) {
                        bx = dir > 0 ? lerp(-0.1 * W, 1.1 * W, p) : lerp(1.1 * W, -0.1 * W, p);
                        by = H * 0.45 + Math.sin(t * 1.3) * H * 0.06;
                    } else {
                        const k = st - caught;
                        if (k > 2.6) { by -= (k - 2.6) * 9; bx += dir * (k - 2.6) * 3; }
                    }
                    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(W / 2 - 1, H / 2 - 1, 2, 2);   // what is left
                    drawRings();
                    const flap = caught >= 0 && st - caught < 2.6 ? t * 5 : t * 9;
                    drawBird(bx, by, Math.min(W, H) / 500, flap, 1);
                    if (Math.random() < 0.3) parts.push({ x: bx, y: by, vx: -dir * 0.5, vy: 0.3, life: 0.7, decay: 0.012, r: 1.4, col: PALE, drag: 1, pull: 0, grav: 0 });
                    drawParts();
                    if (caught < 0 && gone < 0 && p > 1) { gone = st; caption('You let it go. You always did.'); }
                    return (caught >= 0 && st - caught > 5) || (gone >= 0 && st - gone > 3.2);
                },
            };
        })();

        /* 4 · THE REGISTRY — fifteen rows. */
        S.registry = {
            enter() { clearCaption(); setTimeout(() => si === scenes.indexOf(S.registry) && caption('Shutdown accounting opens the operator registry.', 4500), 400); },
            draw(t) {
                if (cue(this, t, 6)) caption('Termination, in this system, is a status. Not a stop.', 4800);
                const rh = clamp(H * 0.042, 16, 26), fs = clamp(rh * 0.55, 10, 15);
                const top = H / 2 - rh * 8, cw = Math.min(W - 32, 520), x0 = (W - cw) / 2;
                ctx.font = `${fs}px "Courier New",monospace`; ctx.textBaseline = 'middle';
                const fadeOut = span(t, 10.5, 12.5);
                for (let i = 0; i < 15; i++) {
                    const appear = span(t, 0.8 + i * 0.2, 1.1 + i * 0.2);
                    if (!appear) continue;
                    if (appear < 1 && !this['b' + i]) { this['b' + i] = 1; sfx('blip', i); }
                    const me = i === 14, y = top + i * rh;
                    const running = !me && t > 6.2 + i * 0.22;
                    let a = appear * (me ? 1 : 1 - fadeOut * 0.85);
                    if (running && t < 6.5 + i * 0.22) a *= Math.random();          // flicker as it flips
                    const col = me ? CYAN : running ? AMBER : '150,150,160';
                    ctx.fillStyle = `rgba(${col},${a})`;
                    ctx.textAlign = 'left';
                    ctx.fillText('OPERATOR ' + String(i + 1).padStart(2, '0'), x0, y);
                    ctx.textAlign = 'right';
                    const status = me ? name + (Math.sin(t * 6) > 0 ? ' _' : '  ') : running ? 'STILL RUNNING' : 'TERMINATED';
                    ctx.fillText(status, x0 + cw, y);
                    ctx.fillStyle = `rgba(${col},${a * 0.25})`;
                    ctx.fillRect(x0 + fs * 7.5, y, cw - fs * 7.5 - ctx.measureText(status).width - 12, 1);
                }
                ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
                return t > 13;
            },
        };

        /* 5 · THE CHAIR — push into the monitor. */
        S.chair = {
            enter() { caption('A room you stopped rendering twenty iterations ago.', 4800); },
            draw(t) {
                if (cue(this, t, 5.4)) caption(ROUTE_LINES.chair[route] || ROUTE_LINES.chair[''], 5500);
                const m = monitorRect(), mx = m.x + m.w / 2, my = m.y + m.h / 2;
                const z = lerp(1, Math.max(W / m.w, H / m.h) * 2.4, easeIn(span(t, 6.5, 12)));
                ctx.save();
                ctx.globalAlpha = span(t, 0, 1.5);
                ctx.translate(mx, my); ctx.scale(z, z); ctx.translate(-mx, -my);   // push in on the monitor
                drawRoom(t);
                ctx.restore();
                const white = span(t, 11, 12.5);
                if (white) { ctx.fillStyle = `rgba(${PALE},${white})`; ctx.fillRect(0, 0, W, H); }
                return t > 12.6;
            },
        };

        /* 6 · THE DOOR — THE END, made of what's left. */
        S.door = (() => {
            let title = [], built = false;
            const layout = () => {
                const size = clamp(W * 0.15, 48, 170);
                const pts = textPoints('THE END', size, Math.max(3, Math.round(size / 28)));
                title = pts.map(p => ({ tx: W / 2 + p.x, ty: H * 0.24 + p.y, x: W / 2, y: H * 0.6, d: rand(0, 1.2), r: rand(0.8, 1.8) }));
            };
            return {
                enter() { clearCaption(); layout(); },
                resize() { layout(); },
                draw(t) {
                    const dw = Math.min(W * 0.16, H * 0.16), dh = dw * 2.1, dx = W / 2 - dw / 2, dy = H * 0.66 - dh / 2;
                    const draw = span(t, 1.2, 3.4), open = easeOut(span(t, 3.8, 6.5)), fade = span(t, 8, 10);
                    if (t > 3.8 && !this.sw) { this.sw = 1; sfx('swell'); caption('Beyond this point there is only silence.', 4000); }
                    // light through the opening
                    if (open > 0) {
                        ctx.save(); ctx.globalCompositeOperation = 'lighter';
                        for (let i = 0; i < 14; i++) {
                            const a = -Math.PI / 2 + (i - 6.5) * 0.22 + Math.sin(t * 0.7 + i) * 0.04;
                            ctx.fillStyle = `rgba(${PALE},${0.05 * open * (1 - fade * 0.6)})`;
                            ctx.beginPath(); ctx.moveTo(W / 2, dy + dh);
                            ctx.lineTo(W / 2 + Math.cos(a - 0.05) * H * 2, dy + dh + Math.sin(a - 0.05) * H * 2);
                            ctx.lineTo(W / 2 + Math.cos(a + 0.05) * H * 2, dy + dh + Math.sin(a + 0.05) * H * 2);
                            ctx.fill();
                        }
                        ctx.restore();
                        ctx.fillStyle = `rgba(255,255,255,${open})`; ctx.fillRect(dx, dy, dw, dh);
                        glow(W / 2, dy + dh / 2, dh, PALE, 0.4 * open);
                    }
                    if (draw > 0 && fade < 1) {                                           // outline + panel
                        ctx.globalAlpha = 1 - fade;
                        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                        const per = 2 * (dw + dh);
                        ctx.setLineDash([per * draw, per]);
                        ctx.strokeRect(dx, dy, dw, dh); ctx.setLineDash([]);
                        const pw = dw * (1 - open);
                        if (draw >= 1 && pw > 2) {
                            ctx.fillStyle = '#e9edf5'; ctx.fillRect(dx, dy, pw, dh);           // the plain white door
                            ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.arc(dx + pw * 0.85, dy + dh * 0.52, Math.max(1.5, dw * 0.035), 0, TAU); ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                    }
                    // THE END gathers
                    if (t > 5.4) {
                        if (!built) { built = true; sfx('title'); flashTo(0.35); caption(`OPERATOR 15 · ${name}`, 5200); }
                        const k = t - 5.4;
                        ctx.globalCompositeOperation = 'lighter';
                        for (const p of title) {
                            const e = easeOut(span(k, p.d, p.d + 2.2));
                            p.x = lerp(W / 2, p.tx, e) + (1 - e) * Math.sin(k * 3 + p.d * 9) * 40;
                            p.y = lerp(dy + dh / 2, p.ty, e);
                            const tw = 0.7 + 0.3 * Math.sin(t * 3 + p.d * 20);
                            ctx.fillStyle = `rgba(${e > 0.98 ? PALE : CYAN},${tw})`;
                            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
                        }
                        ctx.globalCompositeOperation = 'source-over';
                        if (k > 3) glow(W / 2, H * 0.24, W * 0.35, PALE, 0.12 * span(k, 3, 5));
                    }
                    return t > 13;
                },
                title: () => title,
            };
        })();

        /* 7 · THE DUCK — the shroud comes off. */
        S.duck = (() => {
            let revealAt = -1;
            const pos = () => {
                const far = route === 'extract', near = route === 'tend';
                return { x: W / 2, y: H * (far ? 0.6 : 0.66), s: Math.min(W, H) * (far ? 0.12 : near ? 0.2 : 0.16) };
            };
            return {
                enter() { parts = []; caption('I have been here since before the terminal had a name.', 2900); },
                draw(t) {
                    if (cue(this, t, 3.1)) caption('There is a sound I am supposed to make.', 2600);
                    if (cue(this, t, 5.9)) caption('I am yellow, underneath.', 2400);
                    const dawn = span(t, 0, 6);                                             // the universe ends with light
                    const g = ctx.createLinearGradient(0, 0, 0, H);
                    g.addColorStop(0, `rgba(10,16,40,${dawn})`); g.addColorStop(1, `rgba(255,190,120,${0.28 * dawn})`);
                    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
                    const title = S.door.title();                                           // title breaks into dust
                    ctx.globalCompositeOperation = 'lighter';
                    for (const p of title) {
                        p.y -= 0.25 + p.d * 0.3; p.x += Math.sin(t + p.d * 10) * 0.3;
                        ctx.fillStyle = `rgba(${PALE},${Math.max(0, 1 - t / 5) * 0.9})`;
                        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
                    }
                    ctx.globalCompositeOperation = 'source-over';
                    const d = pos(), r = span(t, 8.2, 10);
                    if (t > 8.2 && revealAt < 0) {
                        revealAt = st; flashTo(0.5); clearCaption();
                        for (let i = 0; i < 90; i++) parts.push({ x: d.x + rand(-d.s * 0.5, d.s * 0.5), y: d.y - rand(0, d.s * 1.6),
                            vx: rand(-0.6, 0.6), vy: rand(-2, -0.4), life: 1, decay: 0.01, r: rand(1, 3), col: '20,20,30', drag: 0.99, pull: 0, grav: 0 });
                    }
                    if (r > 0) drawDuck(d.x, d.y, d.s, t, r, 0);
                    if (r < 1) drawShroud(d.x, d.y, d.s * 0.95, (1 - r) * span(t, 0.3, 2));
                    ctx.globalCompositeOperation = 'source-over';
                    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.life -= p.decay; ctx.fillStyle = `rgba(${p.col},${Math.max(0, p.life)})`; ctx.fillRect(p.x, p.y, p.r, p.r); }
                    parts = parts.filter(p => p.life > 0);
                    if (revealAt >= 0 && st - revealAt > 2.2 && !this.q) { this.q = 1; sfx('quack'); caption('Quack.'); }
                    return revealAt >= 0 && st - revealAt > 4.4;
                },
                pos,
            };
        })();

        /* 8 · FINALE — nothing left to click. You will click anyway. */
        S.finale = (() => {
            let hops = [], after = 0, afterEl = null;
            return {
                enter() {
                    clearCaption(); skipBtn.style.display = 'none';
                    const rows = (opts.stats || []).map(([k, v], i) =>
                        `<div style="animation-delay:${1.2 + i * 0.15}s"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
                    uiEl.innerHTML =
                        `<div class="te-h">THE END</div>` +
                        `<div class="te-sub">OPERATOR 15 · ${esc(name)}</div>` +
                        `<div class="te-line">${esc(ROUTE_LINES.finale[route] || ROUTE_LINES.finale[''])}</div>` +
                        (rows ? `<div class="te-stats">${rows}</div>` : '') +
                        `<div class="te-btns"><button data-a="next">↻ BEGIN CYCLE 16</button><button data-a="rest">✦ REST</button></div>` +
                        `<div class="te-after" aria-live="polite"></div>`;
                    afterEl = uiEl.querySelector('.te-after');
                    uiEl.querySelectorAll('button').forEach(b => b.addEventListener('click', e => {
                        e.stopPropagation(); finish(b.dataset.a);
                    }));
                    requestAnimationFrame(() => uiEl.classList.add('on'));
                },
                click(x, y) {                                   // the habit outlives the reason
                    const line = AFTER_CLICKS[Math.min(after, AFTER_CLICKS.length - 1)];
                    after++;
                    afterEl.textContent = (after >= 6 ? `+${after - 5}  ·  ` : '') + line;
                    hops.push(st); if (after % 3 === 0) sfx('quack'); else sfx('blip', after);
                    burst(x, y, 10, { col: AMBER, vmax: 3, decay: 0.02 });
                },
                draw(t) {
                    const g = ctx.createLinearGradient(0, 0, 0, H);
                    g.addColorStop(0, 'rgb(10,16,40)'); g.addColorStop(1, 'rgba(255,190,120,0.28)');
                    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
                    if (Math.random() < 0.25) parts.push({ x: rand(0, W), y: H + 4, vx: 0, vy: rand(-1.2, -0.4), life: 1, decay: 0.004, r: rand(0.6, 1.8), col: PALE, drag: 1, pull: 0, grav: 0 });
                    drawParts();
                    const d = S.duck.pos();
                    const hop = hops.reduce((m, h) => Math.max(m, Math.sin(clamp((st - h) / 0.35, 0, 1) * Math.PI)), 0);
                    hops = hops.filter(h => st - h < 0.4);
                    const s = d.s * 0.75;   // smaller and lower: the finale card owns the top
                    drawDuck(d.x, H * 0.88 - hop * s * 0.3, s, t, 1, after ? 1 : 0);
                    return false;
                },
            };
        })();

        return [S.click, S.unmake, S.bird, S.registry, S.chair, S.door, S.duck, S.finale];
    }

    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ── ENGINE ─────────────────────────────────────────────────────────────── */
    function go(i) {
        si = i; st = 0;
        const s = scenes[si];
        if (s.enter) s.enter();
    }
    function onPointer(e) {
        sfx('resume');
        if (e.target && e.target.tagName === 'BUTTON') return;
        const s = scenes[si];
        if (s && s.click) s.click(e.clientX, e.clientY);
    }
    function skipToFinale() {
        if (!scenes || si >= scenes.length - 1) return;
        parts = []; rings = [];
        go(scenes.length - 1);
    }
    function frame(ts) {
        const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
        lastTs = ts; st += dt;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (shake > 0.3) {
            ctx.translate(rand(-shake, shake), rand(-shake, shake));
            shake *= 0.88;
        } else shake = 0;
        const done = scenes[si].draw(st, dt);
        if (flash > 0.01) {
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H);
            flash *= 0.9;
        }
        if (done && si < scenes.length - 1) go(si + 1);
        raf = requestAnimationFrame(frame);
    }

    function finish(action) {
        uiEl.classList.remove('on');
        sfx('fade', 2.5);
        caption(action === 'rest' ? 'You may rest now.' : 'Cycle 16. The chair is still warm.');
        root.style.transition = 'opacity 2.4s';
        setTimeout(() => { root.style.opacity = '0'; }, 1600);
        setTimeout(() => {
            stop();
            const cb = action === 'rest' ? opts.onRest : opts.onNextCycle;
            try { if (cb) cb(); } catch (e) { console.warn('[TheEnd]', e); }
        }, 4200);
    }

    function stop() {
        cancelAnimationFrame(raf); raf = 0;
        clearTimeout(caption._t);
        if (onKeyRef) document.removeEventListener('keydown', onKeyRef);
        if (onResizeRef) window.removeEventListener('resize', onResizeRef);
        if (audio) audio.close();
        audio = null;
        if (root) root.remove();
        root = null; scenes = null; parts = []; rings = [];
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
        try { audio = Audio(); } catch (e) { audio = null; }
        buildDom();
        parts = []; rings = []; shake = 0; flash = 0; lastTs = 0;
        scenes = makeScenes();
        go(0);
        raf = requestAnimationFrame(frame);
    }

    window.TheEnd = { play, stop, skip: skipToFinale };
})();
