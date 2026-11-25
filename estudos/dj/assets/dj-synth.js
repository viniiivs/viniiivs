// Motor de áudio reutilizável: sintetiza no navegador uma faixa de house com estrutura conhecida.
// Como a página sabe exatamente onde cai cada tempo e cada seção, ela consegue MEDIR o aluno.
// API: DJSynth.play(sections, bpm) -> {t0, beat, bars, sectionStarts, totalBars, done:Promise}
//      DJSynth.stop(), DJSynth.heard(eventTimeStamp) -> tempo do áudio que está saindo no fone agora
//      DJSynth.randomTrack() -> [{type, bars}]
window.DJSynth = (function () {
  let ctx, master, noiseBuf, cur = null, last = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.7;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noiseHit(t, out, type, freq, v, d, q) {
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    env(g, t, v, 0.001, d); s.connect(f); f.connect(g); g.connect(out);
    s.start(t); s.stop(t + d + 0.05);
  }
  const I = {
    kick(t, out) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      env(g, t, 1, 0.002, 0.38); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.45);
    },
    hatOpen(t, out, v) { noiseHit(t, out, 'highpass', 7000, v || 0.22, 0.16); },
    hatClosed(t, out, v) { noiseHit(t, out, 'highpass', 9000, v || 0.07, 0.035); },
    clap(t, out, v) { noiseHit(t, out, 'bandpass', 1500, v || 0.4, 0.15, 0.8); },
    snare(t, out, v) { noiseHit(t, out, 'bandpass', 2200, v, 0.07, 0.9); },
    crash(t, out) { noiseHit(t, out, 'highpass', 5000, 0.18, 1.3); },
    bass(t, out, freq, dur) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = freq; f.type = 'lowpass';
      f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(140, t + dur);
      env(g, t, 0.45, 0.005, dur); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    },
    pad(t, out, freqs, dur, v) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1400;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.5, dur / 3));
      g.gain.setValueAtTime(v, t + dur - 0.25); g.gain.linearRampToValueAtTime(0, t + dur);
      f.connect(g); g.connect(out);
      freqs.forEach(fr => [-8, 8].forEach(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      }));
    },
    stab(t, out, freqs, v) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 2600; env(g, t, v, 0.003, 0.16); f.connect(g); g.connect(out);
      freqs.forEach(fr => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr * 2; o.connect(f); o.start(t); o.stop(t + 0.22); });
    },
    lead(t, out, freq, v) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = 3200;
      env(g, t, v, 0.004, 0.22); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    },
    riser(t, out, dur) {
      const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.loop = true; f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0.01, t); g.gain.linearRampToValueAtTime(0.32, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur);
    }
  };

  // Dó menor: Cm - Ab - Bb - Gm, um acorde por compasso
  const BASS = [65.41, 51.91, 58.27, 49.0];
  const CHORD = [[261.63, 311.13, 392.0], [207.65, 261.63, 311.13], [233.08, 293.66, 349.23], [196.0, 233.08, 293.66]];
  const MOTIF = [{ 0: 783.99, 3: 622.25, 6: 523.25, 10: 622.25 }, { 0: 698.46, 3: 622.25, 6: 466.16, 10: 523.25 }];

  function step(type, b, L, s, t, st, out) {
    const P = b % 4, onBeat = s % 4 === 0, off = s % 4 === 2;
    const bar = st * 16;
    switch (type) {
      case 'intro':
        if (onBeat) I.kick(t, out);
        if (off) I.hatOpen(t, out, 0.16);
        if (b >= L / 2 && s % 2 === 1) I.hatClosed(t, out, 0.05);
        break;
      case 'groove':
        if (b === 0 && s === 0) I.crash(t, out);
        if (onBeat) I.kick(t, out);
        if (off) { I.hatOpen(t, out); I.bass(t, out, BASS[P], st * 1.6); }
        if (s === 4 || s === 12) I.clap(t, out);
        if (s === 6 && b % 2 === 1) I.stab(t, out, CHORD[P], 0.05);
        break;
      case 'breakdown':
        if (s === 0) I.pad(t, out, CHORD[P], bar, b === 0 ? 0.05 : 0.07);
        if (b === 0 && s === 0) I.crash(t, out);
        if (MOTIF[b % 2][s]) I.lead(t, out, MOTIF[b % 2][s], 0.06);
        break;
      case 'build': {
        if (s === 0) I.pad(t, out, CHORD[P], bar, 0.07);
        if (b === 0 && s === 0) I.riser(t, out, L * bar);
        const p = (b * 16 + s) / (L * 16);
        const every = L - b <= 1 ? 1 : p >= 0.5 ? 2 : 4;
        if (s % every === 0) I.snare(t, out, 0.08 + 0.4 * p);
        break;
      }
      case 'drop':
        if (b === 0 && s === 0) I.crash(t, out);
        if (onBeat) I.kick(t, out);
        if (off) { I.hatOpen(t, out); I.bass(t, out, BASS[P], st * 1.6); }
        if (s % 2 === 1) I.hatClosed(t, out);
        if (s === 4 || s === 12) I.clap(t, out);
        if (s === 3 || s === 11) I.stab(t, out, CHORD[P], 0.07);
        if (MOTIF[b % 2][s]) I.lead(t, out, MOTIF[b % 2][s], 0.1);
        break;
      case 'outro':
        if (onBeat) I.kick(t, out);
        if (off) I.hatOpen(t, out, 0.16);
        if (b < L / 2 && (s === 4 || s === 12)) I.clap(t, out, 0.3);
        break;
    }
  }

  function stop() {
    if (!cur) return;
    clearInterval(cur.timer);
    const bus = cur.bus;
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    setTimeout(() => bus.disconnect(), 400);
    cur.resolve && cur.resolve('stopped');
    cur = null;
  }

  function play(sections, bpm) {
    ensure(); stop();
    const st = 60 / bpm / 4, beat = 60 / bpm;
    const bars = [];
    const sectionStarts = [];
    sections.forEach((sec, i) => { sectionStarts.push(bars.length); for (let b = 0; b < sec.bars; b++) bars.push({ type: sec.type, b, L: sec.bars, i }); });
    const bus = ctx.createGain(); bus.connect(master);
    const t0 = ctx.currentTime + 0.35;
    const total = bars.length * 16;
    let idx = 0;
    const me = { bus, t0, beat, bars, sectionStarts, totalBars: bars.length };
    me.done = new Promise(r => { me.resolve = r; });
    me.timer = setInterval(() => {
      while (idx < total && t0 + idx * st < ctx.currentTime + 0.15) {
        const bar = bars[Math.floor(idx / 16)];
        step(bar.type, bar.b, bar.L, idx % 16, t0 + idx * st, st, bus);
        idx++;
      }
      if (idx >= total && ctx.currentTime > t0 + total * st + 0.6) {
        clearInterval(me.timer); if (cur === me) cur = null; me.resolve('ended');
      }
    }, 25);
    cur = me; last = me;
    return me;
  }

  // Momento do áudio que está saindo agora (inclui a latência de saída que o navegador conhece).
  function heard(evStamp) {
    const now = performance.now();
    const ev = typeof evStamp === 'number' && evStamp > 0 && evStamp <= now + 5 ? evStamp : now;
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (ev - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - (now - ev) / 1000;
  }

  function randomTrack() {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    return [
      { type: 'intro', bars: pick([8, 16]) },
      { type: 'groove', bars: pick([8, 16]) },
      { type: 'breakdown', bars: 8 },
      { type: 'build', bars: pick([4, 8]) },
      { type: 'drop', bars: 16 },
      { type: 'outro', bars: pick([8, 16]) }
    ];
  }

  return { play, stop, heard, randomTrack, ensure, get ctx() { return ctx; }, get last() { return last; } };
})();
