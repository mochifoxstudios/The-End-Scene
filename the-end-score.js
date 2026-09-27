/* ══ THE END — score ══════════════════════════════════════════════════════════
   The music and sound for the finale. Web Audio only; no files.

   Built from the game's soundtrack (soundtrack.js): the same voices (FM bell,
   formant choir, detuned pads, kick/wood/noise), the same generated reverb and
   echo returns, the same look-ahead 16th-note scheduler, and the OPERATOR
   MOTIF — the five-note phrase every story phase carries. Here it is played
   for the last time: one note per click in LAST CLICK, missing its end in THE
   CHAIR, on choir as the door opens, and resolved in D major at dawn.

     const s = TheEndScore.create();   // null without Web Audio
     s.cue('spend', 2);                // crossfade to a scene's cue over 2s
     s.hit('note', 0);                 // one-shot over the music
     s.mute(true); s.fadeOut(3); s.close();

   Cues (one per scene, crossfaded, never cut):
     spend    D minor, 56   drone, endgame chords, a clock, a heartbeat
     unmake   E minor, 112  the City Nexus arpeggiator running down
     anomaly  A drone, 60   the void and the bird: drone, wind, a far thump,
                            a thin voice slipping flat, glass, breath
     registry C, 96         printer ticks; a cluster when the rows flip
     chair    D minor, 64   a loop that wears out; the body's heartbeat
     door     D, 56         held breath, then choir and bells
     dawn     D major, 78   the motif resolves

   Every scene change also lands on its own transition sound (toRegistry,
   toChair, toDoor, toDawn) under the crossfade, and the void cue starts
   before the screen goes dark, so there is no silent gap.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const LOOKAHEAD = 0.16;
    const M = m => 440 * Math.pow(2, (m - 69) / 12);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const SC = {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        penta: [0, 2, 4, 7, 9],
    };
    function dg(root, scale, d) {
        const n = scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n;
        return root + o * 12 + scale[i];
    }
    const triad = (root, sc, d) => [dg(root, sc, d), dg(root, sc, d + 2), dg(root, sc, d + 4)];
    // [position in 16ths, scale degree, length in 16ths] — the Operator motif.
    const MOTIF = [[0, 0, 2], [2, 2, 2], [4, 1, 2], [6, 4, 4], [10, 3, 6]];

    function create() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const ctx = new AC();
        const mk = v => { const g = ctx.createGain(); g.gain.value = v; return g; };

        // ── Buses: music + sfx -> master -> compressor; shared reverb and echo ──
        const master = mk(0.9), comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4;
        comp.attack.value = 0.004; comp.release.value = 0.22;
        master.connect(comp); comp.connect(ctx.destination);
        const musicBus = mk(0.85), sfxBus = mk(1);
        musicBus.connect(master); sfxBus.connect(master);

        const conv = ctx.createConvolver();
        conv.buffer = impulse(3.6, 2.6);
        const revIn = mk(1), revOut = mk(0.8);
        revIn.connect(conv); conv.connect(revOut); revOut.connect(master);

        const dly = ctx.createDelay(2.5), fb = mk(0.38), dlp = ctx.createBiquadFilter();
        dly.delayTime.value = 0.4; dlp.type = 'lowpass'; dlp.frequency.value = 2600;
        const dlyIn = mk(1), dlyOut = mk(0.6);
        dlyIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
        dlp.connect(dlyOut); dlyOut.connect(master);

        const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

        function impulse(sec, decay) {
            const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let c = 0; c < 2; c++) {
                const d = buf.getChannelData(c);
                for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
            return buf;
        }

        // ── Envelopes and routing ───────────────────────────────────────────
        function envPerc(p, t, a, peak, d) {
            p.setValueAtTime(0.0001, t);
            p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
            p.exponentialRampToValueAtTime(0.0001, t + a + d);
        }
        function envSus(p, t, a, peak, hold, r) {
            const h = Math.max(a, hold);
            p.setValueAtTime(0, t);
            p.linearRampToValueAtTime(peak, t + a);
            p.setValueAtTime(peak, t + h);
            p.linearRampToValueAtTime(0, t + h + r);
        }
        function send(node, dest, amt) { if (!dest || !amt) return; const s = mk(amt); node.connect(s); s.connect(dest); }
        function chain(D, o) {
            const g = mk(0);
            let last = g;
            if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); last = p; }
            last.connect(D.dry);
            send(last, D.rev, o.rev === undefined ? 0.25 : o.rev);
            send(last, D.echo, o.echo || 0);
            return g;
        }

        // ── Voices (from soundtrack.js) ─────────────────────────────────────
        function tone(D, t, f, dur, o) {
            o = o || {};
            const sus = !!o.sus;
            const a = o.a !== undefined ? o.a : (sus ? 0.02 : 0.004);
            const r = o.r !== undefined ? o.r : (sus ? 0.2 : 0);
            const end = t + Math.max(a, dur) + r + 0.06;
            const g = chain(D, o);
            let dest = g;
            if (o.lp || o.bp || o.hp) {
                const fl = ctx.createBiquadFilter();
                fl.type = o.bp ? 'bandpass' : o.hp ? 'highpass' : 'lowpass';
                const fv = o.lp || o.bp || o.hp;
                fl.Q.value = o.q !== undefined ? o.q : (o.bp ? 4 : 0.8);
                if (o.fenv) {
                    fl.frequency.setValueAtTime(o.fenv, t);
                    fl.frequency.exponentialRampToValueAtTime(fv, t + (o.ft || dur));
                } else fl.frequency.setValueAtTime(fv, t);
                fl.connect(g); dest = fl;
            }
            let lg = null;
            if (o.vib) {
                const lfo = ctx.createOscillator(); lfo.frequency.value = o.vib[0];
                lg = mk(o.vib[1]); lfo.connect(lg); lfo.start(t); lfo.stop(end);
            }
            const n = o.uni || 1, sp = o.spread !== undefined ? o.spread : 10;
            for (let i = 0; i < n; i++) {
                const osc = ctx.createOscillator();
                osc.type = o.type || 'sine';
                osc.frequency.setValueAtTime(f, t);
                if (o.glide) osc.frequency.exponentialRampToValueAtTime(f * o.glide, t + (o.gt || dur));
                osc.detune.value = (o.det || 0) + (n > 1 ? (i / (n - 1) * 2 - 1) * sp : 0);
                if (lg) lg.connect(osc.detune);
                osc.connect(dest); osc.start(t); osc.stop(end);
            }
            const v = (o.vol !== undefined ? o.vol : 0.15) / Math.sqrt(n);
            if (sus) envSus(g.gain, t, a, v, dur, r); else envPerc(g.gain, t, a, v, dur);
        }
        function bell(D, t, f, dur, o) {
            o = o || {};
            const end = t + dur + 0.1, g = chain(D, o);
            const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
            c.frequency.value = f; m.frequency.value = f * (o.ratio || 3.5);
            c.detune.value = o.det || 0;
            const idx = (o.idx !== undefined ? o.idx : 2.5) * f;
            mg.gain.setValueAtTime(idx, t);
            mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.04), t + dur * 0.6);
            m.connect(mg); mg.connect(c.frequency); c.connect(g);
            c.start(t); m.start(t); c.stop(end); m.stop(end);
            envPerc(g.gain, t, o.a || 0.003, o.vol !== undefined ? o.vol : 0.08, dur);
        }
        function pad(D, t, notes, dur, o) {
            o = o || {};
            const v = (o.vol !== undefined ? o.vol : 0.1) / Math.sqrt(notes.length);
            const base = Object.assign({ type: 'sawtooth', uni: 2, spread: 9, lp: 1200, a: 0.8, r: 1.2, rev: 0.45 }, o);
            notes.forEach(n => tone(D, t, M(n), dur, Object.assign({}, base, { sus: true, vol: v })));
        }
        function noise(D, t, dur, o) {
            o = o || {};
            const r = o.r !== undefined ? o.r : 0.1;
            const end = t + dur + r + 0.06, g = chain(D, o);
            const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
            const fl = ctx.createBiquadFilter();
            fl.type = o.type || 'bandpass';
            fl.Q.value = o.q !== undefined ? o.q : 1;
            fl.frequency.setValueAtTime(o.f || 1000, t);
            if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.ft || dur));
            src.connect(fl); fl.connect(g);
            src.start(t, Math.random() * 1.5); src.stop(end);
            const v = o.vol !== undefined ? o.vol : 0.05;
            if (o.sus) envSus(g.gain, t, o.a !== undefined ? o.a : 0.05, v, dur, r);
            else envPerc(g.gain, t, o.a !== undefined ? o.a : 0.002, v, dur);
        }
        function kick(D, t, o) {
            o = o || {};
            const d = o.d || 0.35, v = o.vol !== undefined ? o.vol : 0.6;
            const g = chain(D, { rev: o.rev !== undefined ? o.rev : 0.04, pan: o.pan });
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(o.f0 || 150, t);
            osc.frequency.exponentialRampToValueAtTime(o.f1 || 45, t + (o.pd || 0.09));
            osc.connect(g); osc.start(t); osc.stop(t + d + 0.06);
            envPerc(g.gain, t, 0.002, v, d);
            if (o.click !== false) noise(D, t, 0.012, { type: 'highpass', f: 3000, vol: v * 0.12, rev: 0 });
        }
        function wood(D, t, f, o) {
            o = o || {};
            tone(D, t, f, 0.04, { vol: o.vol !== undefined ? o.vol : 0.08, rev: o.rev !== undefined ? o.rev : 0.15, pan: o.pan });
            noise(D, t, 0.008, { type: 'bandpass', f: f * 2, q: 3, vol: (o.vol || 0.08) * 0.5, rev: 0, pan: o.pan });
        }
        function glitch(D, t, o) {
            o = o || {};
            const n = o.n || 6, st = o.st || 0.018, end = t + n * st + 0.05;
            const g = chain(D, { rev: o.rev || 0.05, pan: o.pan });
            const osc = ctx.createOscillator(); osc.type = 'square';
            for (let k = 0; k < n; k++) osc.frequency.setValueAtTime(180 + Math.random() * 2600, t + k * st);
            osc.connect(g); osc.start(t); osc.stop(end);
            envPerc(g.gain, t, 0.001, o.vol !== undefined ? o.vol : 0.04, n * st);
        }
        const VOWELS = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530] };
        function choir(D, t, f, dur, o) {
            o = o || {};
            const a = o.a !== undefined ? o.a : 0.9, r = o.r !== undefined ? o.r : 1.2;
            const end = t + Math.max(a, dur) + r + 0.06, g = chain(D, o), sum = mk(1);
            const lfo = ctx.createOscillator(); lfo.frequency.value = 5.1;
            const lg = mk(8); lfo.connect(lg); lfo.start(t); lfo.stop(end);
            [-11, 0, 12].forEach(dt => {
                const osc = ctx.createOscillator(); osc.type = 'sawtooth';
                osc.frequency.value = f; osc.detune.value = dt;
                lg.connect(osc.detune); osc.connect(sum); osc.start(t); osc.stop(end);
            });
            VOWELS[o.v || 'a'].forEach((ff, i) => {
                const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 7 + i * 3;
                const fg = mk([1, 0.5, 0.22][i]); sum.connect(bp); bp.connect(fg); fg.connect(g);
            });
            envSus(g.gain, t, a, (o.vol !== undefined ? o.vol : 0.08) * 3, dur, r);
        }
        function riser(D, t, dur, o) {
            o = o || {};
            noise(D, t, dur, { type: 'bandpass', f: o.f || 300, f2: o.f2 || 6000, ft: dur, q: 2, sus: true, a: dur, r: 0.03, vol: o.vol !== undefined ? o.vol : 0.06, rev: 0.3 });
        }
        function swell(D, t, dur, notes, o) {
            o = o || {};
            const v = (o.vol !== undefined ? o.vol : 0.08) / Math.sqrt(notes.length);
            notes.forEach(n => tone(D, t, M(n), dur, { type: o.type || 'sawtooth', uni: 2, spread: 12, lp: o.lp || 1600, sus: true, a: dur, r: 0.025, vol: v, rev: 0.5 }));
        }
        function heartbeat(D, t, v) {
            kick(D, t, { f0: 110, f1: 42, pd: 0.07, d: 0.24, vol: v, click: false, rev: 0.08 });
            kick(D, t + 0.17, { f0: 100, f1: 40, pd: 0.07, d: 0.22, vol: v * 0.62, click: false, rev: 0.08 });
        }
        function motif(P, t0, root, scale, fn, opt) {
            opt = opt || {};
            const k = opt.stretch || 1;
            let notes = MOTIF.map(n => n.slice());
            if (opt.lift) notes[notes.length - 1][1] += 2;
            if (opt.dropLast) notes = notes.slice(0, -1);
            notes.forEach((n, i) => fn(dg(root, scale, n[1]), t0 + n[0] * P.sd * k, n[2] * P.sd * k, i));
        }

        // ── Players: a cue plus its own bus, stepped by the scheduler ────────
        const P_PROTO = {
            rnd() { return Math.random(); },
            chance(p) { return Math.random() < p; },
            pick(a) { return a[Math.floor(Math.random() * a.length)]; },
            age(t) { return t - this.t0; },
            tone(t, f, d, o) { tone(this.D, t, f, d, o); },
            bell(t, f, d, o) { bell(this.D, t, f, d, o); },
            pad(t, n, d, o) { pad(this.D, t, n, d, o); },
            noise(t, d, o) { noise(this.D, t, d, o); },
            kick(t, o) { kick(this.D, t, o); },
            wood(t, f, o) { wood(this.D, t, f, o); },
            glitch(t, o) { glitch(this.D, t, o); },
            choir(t, f, d, o) { choir(this.D, t, f, d, o); },
            riser(t, d, o) { riser(this.D, t, d, o); },
            swell(t, d, n, o) { swell(this.D, t, d, n, o); },
            heartbeat(t, v) { heartbeat(this.D, t, v); },
            motif(t, root, sc, fn, opt) { motif(this, t, root, sc, fn, opt); },
        };
        const players = [];
        let current = null, muted = false;

        function makePlayer(name, t, fade) {
            const cue = CUES[name];
            const fades = [mk(0), mk(0), mk(0)];
            fades.forEach(g => {
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(1, t + Math.max(0.05, fade));
            });
            fades[0].connect(musicBus); fades[1].connect(revIn); fades[2].connect(dlyIn);
            const dry = mk(cue.vol || 1); dry.connect(fades[0]);
            const rev = mk(1); rev.connect(fades[1]);
            const echo = mk(1); echo.connect(fades[2]);
            const p = Object.create(P_PROTO);
            const sd = 60 / cue.bpm / 4;
            return Object.assign(p, { name, cue, D: { dry, rev, echo }, fades, step: 0, t0: t, next: t, sd, st: {}, stopAt: null });
        }
        function fadeOutPlayer(p, sec) {
            const now = ctx.currentTime;
            p.fades.forEach(g => {
                g.gain.cancelScheduledValues(now);
                g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
                g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.03, sec));
            });
            p.stopAt = now + sec;
        }
        function pump() {
            const now = ctx.currentTime, horizon = now + LOOKAHEAD;
            for (const p of players) {
                while (p.next < horizon && (p.stopAt === null || p.next < p.stopAt)) {
                    if (p.next >= now - 0.05) {
                        try { p.cue.step(p, p.step, p.next); } catch (e) { console.warn('[TheEndScore]', p.name, e); }
                    }
                    p.step++; p.next += p.sd;
                }
            }
            for (let i = players.length - 1; i >= 0; i--) {
                const p = players[i];
                if (p.stopAt !== null && now > p.stopAt + 6) {
                    p.fades.forEach(g => { try { g.disconnect(); } catch (e) {} });
                    players.splice(i, 1);
                }
            }
        }
        const pumpTimer = setInterval(pump, 25);

        // ── Cues ────────────────────────────────────────────────────────────
        const CUES = {
            /* LAST CLICK. The endgame chords under a clock and a heartbeat. The
               melody is the player's: each click plays one note of the motif. */
            spend: {
                bpm: 56, echoSteps: 4,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4, sc = SC.minor, R = 50;
                    const cd = [0, 5, 3, 6][(bar >> 1) % 4];
                    if (pos === 0 && bar % 2 === 0) {
                        P.tone(t, M(R - 24), P.sd * 32, { sus: true, a: 1.5, r: 2, vol: 0.18 });
                        P.pad(t, triad(R, sc, cd), P.sd * 32, { lp: 900, a: 2.5, r: 2.5, vol: 0.09 });
                    }
                    if (pos % 4 === 0) P.wood(t, pos % 8 === 0 ? 1400 : 1050, { vol: 0.03, rev: 0.35 });
                    if (pos === 0 && bar % 2 === 1) P.heartbeat(t, 0.2);
                    if (P.chance(0.03)) P.bell(t, M(dg(R + 24, sc, P.pick([0, 2, 4]))), 2.5, { ratio: 3.5, vol: 0.025, rev: 0.7, echo: 0.3, pan: P.rnd() - 0.5 });
                },
            },
            /* UNMAKING. The City Nexus theme, running down: the filter closes,
               notes drop out, the pitch sags, then the drums and bass stop. */
            unmake: {
                bpm: 112, echoSteps: 3,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4, sc = SC.minor, R = 40, a = P.age(t);
                    const k = clamp(a / 14, 0, 1);
                    const cd = [0, 5, 2, 6][(bar >> 1) % 4];
                    const arp = [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7];
                    const sag = -k * k * 700, fadeIn = Math.min(1, a / 1.2);
                    if (!P.chance(k * 0.95))
                        P.tone(t, M(dg(R + 24, sc, cd + arp[pos])), 0.11, { type: 'sawtooth', lp: 3200 * (1 - k) + 240, fenv: 3600 * (1 - k) + 300, ft: 0.08, vol: 0.05 * fadeIn, rev: 0.25, echo: 0.25, det: sag, pan: pos % 2 ? 0.28 : -0.28 });
                    if (pos % 4 === 0 && a < 7) P.kick(t, { vol: 0.42 * (1 - a / 7) * fadeIn, f0: 140, f1: 46 });
                    if (pos % 2 === 0 && a < 10) P.tone(t, M(dg(R, sc, cd) + (pos % 4 === 2 ? 12 : 0)), 0.13, { type: 'sawtooth', lp: 520, vol: 0.12 * (1 - a / 10), rev: 0, det: sag });
                    if (pos === 0 && bar % 2 === 0 && a < 11) P.pad(t, triad(R + 12, sc, cd), P.sd * 32, { lp: 700, vol: 0.05, a: 0.6, det: sag });
                    if (pos === 0 && bar % 4 === 0 && a > 6) P.tone(t, M(28), P.sd * 64, { type: 'sawtooth', lp: 180, sus: true, a: 2, r: 2, vol: 0.14, rev: 0.4 });
                },
            },
            /* THE VOID and THE LAST ANOMALY. It starts while the last of the sky
               is being pulled in and carries on under the bird: a beating drone,
               wind that moves from ear to ear, a far thump, a thin voice singing
               one note that slips flat, glass, breath. Quiet, and never empty. */
            anomaly: {
                bpm: 60, echoSteps: 6,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4;
                    if (pos === 0 && bar % 4 === 0) {
                        P.tone(t, M(33), P.sd * 64, { sus: true, a: 2.5, r: 2.5, vol: 0.12 });
                        P.tone(t, M(45) + 0.7, P.sd * 64, { sus: true, a: 3, r: 2.5, vol: 0.04 });
                    }
                    if (pos === 0 && bar % 2 === 0)
                        P.noise(t, P.sd * 10, { f: 280, f2: 900, ft: P.sd * 10, q: 3, sus: true, a: P.sd * 5, r: P.sd * 6, vol: 0.022, pan: bar % 4 ? 0.7 : -0.7, rev: 0.5 });
                    if (pos === 8 && bar % 4 === 2)
                        P.tone(t, M(P.pick([88, 91, 93])), P.sd * 20, { sus: true, a: 2, r: 2, vol: 0.013, vib: [0.35, 22], glide: 0.97, gt: P.sd * 20, rev: 0.8, echo: 0.4 });
                    if (pos === 0 && bar % 8 === 1) P.kick(t, { f0: 52, f1: 28, pd: 0.3, d: 3, vol: 0.16, click: false, rev: 0.9 });
                    if (pos === 0 && bar % 2 === 1) P.noise(t, P.sd * 8, { f: 600, f2: 1400, q: 0.8, sus: true, a: P.sd * 4, r: 0.8, vol: 0.016 });
                    if (P.chance(0.04)) P.bell(t, M(dg(81, SC.penta, P.pick([0, 1, 2, 3, 4]))), 3, { ratio: 2.76, idx: 1.2, vol: 0.028, rev: 0.8, echo: 0.45, pan: P.rnd() * 1.6 - 0.8 });
                },
            },
            /* THE REGISTRY. A ledger printing, then a cluster when "terminated"
               turns out to mean "still running". */
            registry: {
                bpm: 96, echoSteps: 3,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4, R = 36, a = P.age(t);
                    if (pos === 0 && bar % 4 === 0) P.tone(t, M(R - 12), P.sd * 64, { type: 'sawtooth', lp: 200, sus: true, a: 1.5, r: 2, vol: 0.12 });
                    if (pos % 2 === 0 && a < 6.2) P.wood(t, 2200 + (pos % 4) * 150, { vol: 0.018, rev: 0.1, pan: pos % 4 ? 0.4 : -0.4 });
                    if (a >= 6.2 && pos === 0 && bar % 2 === 0) P.pad(t, [R + 24, R + 25, R + 31], P.sd * 32, { lp: 800, a: 1.5, r: 2, vol: 0.07 });
                    if (a >= 6.2 && !P.st.whine) { P.st.whine = 1; P.tone(t, M(95), 6, { sus: true, a: 2, r: 2, vol: 0.012, vib: [6, 30], rev: 0.7 }); }
                },
            },
            /* THE CHAIR. One bar that repeats and wears out (THE LONG ITERATION),
               a slow heartbeat, and the motif without its last note. */
            chair: {
                bpm: 64, echoSteps: 3,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4, R = 38;
                    const LOOP = { 0: 62, 3: 65, 6: 69, 8: 64, 11: 65, 14: 57 };
                    if (LOOP[pos] && !P.chance(Math.min(0.6, bar * 0.1)))
                        P.tone(t, M(LOOP[pos]), 0.5, { type: 'triangle', lp: 1400, vol: 0.06, rev: 0.5, echo: 0.3, det: (P.rnd() - 0.5) * bar * 8 });
                    if (pos === 0 && bar % 2 === 0) {
                        P.tone(t, M(R), P.sd * 32, { sus: true, a: 1, r: 2, vol: 0.13 });
                        P.pad(t, triad(R + 12, SC.minor, 0), P.sd * 32, { lp: 700, a: 1.5, r: 2, vol: 0.06 });
                    }
                    if (pos === 0) P.heartbeat(t, 0.16);
                    if (pos === 0 && bar === 2) P.motif(t, R + 36, SC.minor, (m, tt, d) => P.tone(tt, M(m), d, { sus: true, a: 0.05, r: 0.8, vol: 0.07, vib: [4.5, 6], rev: 0.6, echo: 0.5 }), { dropLast: true });
                },
            },
            /* THE DOOR. A held note under the closed door; once it opens, the
               motif at half speed on choir and bells over the whole chord. */
            door: {
                bpm: 56, echoSteps: 4,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4, R = 50, a = P.age(t);
                    if (a < 4.2) {
                        if (pos === 0 && bar % 2 === 0) P.tone(t, M(R - 24), P.sd * 32, { sus: true, a: 1, r: 2, vol: 0.15 });
                        if (!P.st.hi) { P.st.hi = 1; P.tone(t, M(86), 4, { sus: true, a: 2.5, r: 0.5, vol: 0.012, vib: [5, 12], rev: 0.6 }); }
                        return;
                    }
                    if (pos === 0 && bar % 2 === 0) {
                        P.tone(t, M(R - 24), P.sd * 32, { sus: true, a: 0.5, r: 2, vol: 0.18 });
                        P.pad(t, [R, R + 7, R + 12, R + 16, R + 19], P.sd * 32, { lp: 1500, a: 1, r: 2.5, vol: 0.1 });
                    }
                    if (pos === 0 && bar % 4 === 1)
                        P.motif(t, R + 12, SC.minor, (m, tt, d) => { P.choir(tt, M(m), d, { v: 'o', a: 0.3, r: 0.8, vol: 0.06 }); P.bell(tt, M(m + 12), 2.5, { ratio: 3.5, idx: 1.4, vol: 0.04, rev: 0.7 }); }, { stretch: 2 });
                },
            },
            /* DAWN (the duck and the finale). The motif finally resolves, in D
               major, on bells over strings. It is allowed to stop now. */
            dawn: {
                bpm: 78, echoSteps: 3,
                step(P, s, t) {
                    const pos = s % 16, bar = s >> 4, sc = SC.major, R = 50;
                    const cd = [0, 4, 5, 3, 0, 3, 4, 0][bar % 8];
                    if (pos === 0) {
                        P.pad(t, triad(R, sc, cd).concat([dg(R + 12, sc, cd + 2)]), P.sd * 16, { lp: 1600, a: 0.8, r: 1.2, vol: 0.1 });
                        P.tone(t, M(dg(R - 12, sc, cd)), P.sd * 16, { sus: true, a: 0.2, r: 1, vol: 0.13 });
                    }
                    const arp = [0, 6, 10].indexOf(pos);
                    if (arp >= 0) P.tone(t, M(triad(R + 12, sc, cd)[arp]), 1.3, { type: 'triangle', lp: 900, fenv: 3800, ft: 0.25, vol: 0.05, rev: 0.45 });
                    if (pos === 0 && bar % 4 === 1)
                        P.motif(t, R + 24, sc, (m, tt, d) => P.bell(tt, M(m), d + 1.4, { ratio: 2, idx: 1.1, vol: 0.08, rev: 0.5, echo: 0.2 }), { lift: bar % 8 === 5 });
                },
            },
        };

        // ── One-shots ───────────────────────────────────────────────────────
        const FX = { dry: sfxBus, rev: revIn, echo: dlyIn };
        const HITS = {
            /* Click i plays note i of the motif, low and heavy, in D minor. */
            note(t, i) {
                const n = MOTIF[clamp(i, 0, 4)], f = M(dg(62, SC.minor, n[1]));
                bell(FX, t, f, 2.8, { ratio: 2, idx: 1.3, vol: 0.11, rev: 0.6, echo: 0.35 });
                bell(FX, t, f / 2, 2, { ratio: 3.5, idx: 0.8, vol: 0.05, rev: 0.4 });
                kick(FX, t, { f0: 130 - i * 12, f1: 38, d: 0.5, vol: 0.45, rev: 0.2 });
                noise(FX, t, 0.15, { type: 'lowpass', f: 900, f2: 120, vol: 0.07, rev: 0.2 });
            },
            implode(t) {
                swell(FX, t, 1.3, [50, 57, 62, 69], { vol: 0.12 });
                riser(FX, t, 1.3, { f: 200, f2: 7000, vol: 0.07 });
            },
            shatter(t) {
                kick(FX, t, { vol: 0.8, f0: 90, f1: 30, pd: 0.15, d: 1.6, rev: 0.6 });
                noise(FX, t, 1.6, { type: 'lowpass', f: 7000, f2: 150, vol: 0.16, rev: 0.8 });
                pad(FX, t, [38, 45, 50, 57], 3.5, { uni: 3, lp: 1800, a: 0.02, r: 2.5, vol: 0.13, rev: 0.8 });
                for (let k = 0; k < 5; k++) glitch(FX, t + 0.15 + k * 0.14, { vol: 0.03 - k * 0.004, pan: k % 2 ? 0.6 : -0.6 });
            },
            collapse(t) {
                swell(FX, t, 2.2, [26, 38, 45], { vol: 0.12, lp: 600 });
                kick(FX, t + 2.2, { vol: 0.6, f0: 70, f1: 25, d: 2.4, rev: 0.9, click: false });
            },
            chime(t) {
                MOTIF.forEach((n, i) => bell(FX, t + i * 0.11, M(dg(86, SC.major, n[1] + (i === 4 ? 2 : 0))), 2.2, { ratio: 2, idx: 1, vol: 0.06, rev: 0.7, echo: 0.3 }));
            },
            blip(t, i) { tone(FX, t, M(81 + [0, 3, 7][i % 3]), 0.05, { type: 'square', lp: 3000, vol: 0.03, rev: 0.1 }); },
            flip(t) { glitch(FX, t, { vol: 0.02, n: 4, pan: Math.random() - 0.5 }); },
            ghost(t) {
                const side = Math.random() < 0.5 ? -0.95 : 0.95;
                [0, 0.9].forEach(dt => noise(FX, t + dt, 0.03, { type: 'bandpass', f: 3200, q: 1.5, vol: 0.1, pan: side, rev: 0.1 }));
                tone(FX, t + 0.3, M(95), 1.8, { sus: true, a: 0.8, r: 0.6, vol: 0.018, vib: [6, 30], pan: -side, rev: 0.7 });
            },
            whiteout(t) { riser(FX, t, 2.6, { f: 400, f2: 9000, vol: 0.06 }); },
            doorRise(t) { riser(FX, t, 1.6, { f: 150, f2: 5000, vol: 0.08 }); },
            open(t) {
                kick(FX, t, { vol: 0.75, f0: 70, f1: 28, d: 2, rev: 0.8, click: false });
                noise(FX, t, 2.2, { type: 'lowpass', f: 3000, f2: 200, vol: 0.1, rev: 0.9 });
                pad(FX, t, [50, 57, 62, 66, 69], 4.5, { uni: 3, lp: 2600, a: 0.02, r: 3, vol: 0.13, rev: 0.8 });
            },
            unveil(t) {
                swell(FX, t, 1.2, [62, 69, 74], { vol: 0.08 });
                [74, 78, 81, 86].forEach(n => bell(FX, t + 1.2, M(n), 2.6, { ratio: 3.5, idx: 1.5, vol: 0.045, rev: 0.8, echo: 0.3 }));
            },
            /* Scene transitions: each scene arrives on its own sound, under the crossfade. */
            toRegistry(t) {
                for (let k = 0; k < 8; k++) wood(FX, t + k * 0.06, 2600 - k * 140, { vol: 0.018, rev: 0.3, pan: k % 2 ? 0.5 : -0.5 });
                swell(FX, t, 1.4, [60, 61, 67], { vol: 0.05, lp: 900 });
            },
            toChair(t) {
                tone(FX, t, M(62), 1.6, { type: 'triangle', lp: 1200, sus: true, a: 0.05, r: 0.6, glide: 0.5, gt: 1.6, vol: 0.05, rev: 0.6 });
                noise(FX, t, 1.8, { type: 'lowpass', f: 1400, f2: 150, vol: 0.05, rev: 0.6 });
            },
            toDoor(t) {
                noise(FX, t, 3, { type: 'lowpass', f: 8000, f2: 300, vol: 0.07, rev: 0.9 });
                bell(FX, t + 0.4, M(86), 3, { ratio: 3.5, idx: 1, vol: 0.03, rev: 0.9, echo: 0.3 });
            },
            toDawn(t) {
                [74, 78, 81, 86, 90].forEach((n, i) => bell(FX, t + 0.3 + i * 0.09, M(n), 2.2, { ratio: 2, idx: 1, vol: 0.035, rev: 0.7, echo: 0.3 }));
                swell(FX, t, 1.8, [62, 66, 69], { vol: 0.06, lp: 1400 });
            },
            flap(t, pan) { noise(FX, t, 0.14, { type: 'bandpass', f: 520, f2: 240, q: 1.2, vol: 0.03, pan: pan || 0, rev: 0.35 }); },
            rest(t) { [62, 74, 81].forEach((n, i) => bell(FX, t + i * 0.25, M(n), 4, { ratio: 2, idx: 0.8, vol: 0.05, rev: 0.9, echo: 0.3 })); },
            quack(t, v) { tone(FX, t, M(57), 0.16, { type: 'sawtooth', bp: 1400, fenv: 700, ft: 0.06, q: 5, glide: 0.82, vol: v || 0.22, rev: 0.25 }); },
            coin(t, i) {
                const n = [74, 78, 81, 86, 90][i % 5];
                bell(FX, t, M(n), 0.4, { ratio: 2, idx: 1, vol: 0.05, rev: 0.4 });
                bell(FX, t + 0.06, M(n + 7), 0.5, { ratio: 2, idx: 1, vol: 0.04, rev: 0.4 });
            },
        };

        return {
            resume() { if (ctx.state === 'suspended') ctx.resume(); },
            cue(name, fade) {
                if (!CUES[name] || (current && current.name === name)) return;
                const t = ctx.currentTime + 0.05, f = fade === undefined ? 2 : fade;
                if (current) fadeOutPlayer(current, f);
                current = makePlayer(name, t, f);
                const echo = (current.cue.echoSteps || 3) * current.sd;
                dly.delayTime.setTargetAtTime(Math.min(2.4, echo), ctx.currentTime, 0.3);
                players.push(current);
            },
            hit(name, ...args) {
                if (HITS[name]) try { HITS[name](ctx.currentTime + 0.02, ...args); } catch (e) { console.warn('[TheEndScore]', name, e); }
            },
            mute(on) {
                muted = on === undefined ? !muted : !!on;
                master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.15);
                return muted;
            },
            get muted() { return muted; },
            fadeOut(sec) {
                const now = ctx.currentTime;
                master.gain.cancelScheduledValues(now);
                master.gain.setValueAtTime(master.gain.value, now);
                master.gain.linearRampToValueAtTime(0.0001, now + sec);
            },
            close() {
                clearInterval(pumpTimer);
                try { ctx.close(); } catch (e) {}
            },
        };
    }

    window.TheEndScore = { create };
})();
