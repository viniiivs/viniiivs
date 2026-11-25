// Treinos reutilizáveis que MEDEM o aluno usando o motor DJSynth.
//  <div class="tap-test" data-bpm="124" data-bars="8"></div>      precisão de tempo em ms
//  <div class="section-samples" data-bpm="124"></div>              botões para ouvir cada tipo de seção
//  <div class="section-mapper" data-bpm="124"></div>               faixa surpresa; você marca as seções
//  <div class="timestamp-mapper" data-bpm="130"></div>             converte minutagem de uma faixa real em compassos
(function () {
  const NAMES = { intro: 'Intro', groove: 'Groove', breakdown: 'Breakdown', build: 'Build-up', drop: 'Drop', outro: 'Outro' };
  const COLORS = { intro: '#8a8f98', groove: '#2f7a3e', breakdown: '#3a6fb0', build: '#c98a12', drop: '#b3341d', outro: '#6b5a8e' };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('dj:' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('dj:' + k, JSON.stringify(v)); } catch (e) { } }
  };
  const h = (tag, attrs, html) => { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html != null) e.innerHTML = html; return e; };
  const fmt = n => (n > 0 ? '+' : '') + Math.round(n);

  /* ---------- 1. Teste de tempo ---------- */
  function tapTest(root) {
    const bpm = +root.dataset.bpm || 124, bars = +root.dataset.bars || 8, countIn = 2;
    root.innerHTML = `
      <div class="tt-head"><button type="button" data-go>▶ Começar teste</button><span class="tt-status" aria-live="polite">Use fone e volume confortável. Você vai ouvir 2 compassos de contagem e então ${bars} compassos de groove.</span></div>
      <button type="button" class="tt-pad" data-pad disabled>Bata aqui (ou espaço) em cada bumbo</button>
      <div class="tt-bar"><i data-prog></i></div>
      <div class="tt-result" data-res hidden></div>`;
    const go = root.querySelector('[data-go]'), pad = root.querySelector('[data-pad]'), status = root.querySelector('.tt-status'), prog = root.querySelector('[data-prog]'), res = root.querySelector('[data-res]');
    let run = null, offs = [], active = false;
    function tap(e) {
      if (!active || !run) return;
      const t = DJSynth.heard(e.timeStamp);
      const k = Math.round((t - run.t0) / run.beat);
      if (k < countIn * 4) return;
      const off = (t - (run.t0 + k * run.beat)) * 1000;
      if (Math.abs(off) < run.beat * 500) offs.push(off);
      pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 80);
    }
    pad.addEventListener('pointerdown', tap);
    root._key = e => { if (active && e.code === 'Space') { e.preventDefault(); tap(e); } };
    document.addEventListener('keydown', root._key);
    go.addEventListener('click', async () => {
      offs = []; res.hidden = true;
      run = DJSynth.play([{ type: 'intro', bars: countIn }, { type: 'groove', bars }], bpm);
      active = true; pad.disabled = false; go.disabled = true;
      status.textContent = 'Contagem… comece a bater quando o groove entrar (ou já na contagem, ela não conta).';
      const tick = () => { if (!active) return; const p = (DJSynth.ctx.currentTime - run.t0) / (run.totalBars * 4 * run.beat); prog.style.width = Math.min(100, Math.max(0, p * 100)) + '%'; requestAnimationFrame(tick); };
      tick();
      await run.done; active = false; pad.disabled = true; go.disabled = false; go.textContent = '↻ Repetir teste';
      show();
    });
    function show() {
      if (offs.length < 8) { status.textContent = `Só ${offs.length} batidas válidas. Tente de novo batendo em todos os bumbos.`; return; }
      const mean = offs.reduce((a, b) => a + b, 0) / offs.length;
      const sd = Math.sqrt(offs.reduce((a, b) => a + (b - mean) ** 2, 0) / offs.length);
      const best = store.get('tap-best');
      if (!best || sd < best) store.set('tap-best', Math.round(sd));
      const verdict = sd < 20 ? 'excelente: nível de quem tem anos de prática rítmica' : sd < 35 ? 'bom: firme o suficiente para mixar' : sd < 60 ? 'regular: o tempo oscila, treine mais' : 'instável: tente de novo, relaxado';
      const lat = mean > 80 ? `<p><b>Seu atraso médio é alto (${fmt(mean)} ms).</b> Pessoas batendo junto com um som costumam ficar <em>adiantadas</em> 20 a 50 ms, então um atraso grande e constante provavelmente vem do fone. Com fone Bluetooth o som chega atrasado e você bate atrasado junto. É exatamente por isso que DJs não usam Bluetooth para mixar.</p>`
        : mean < -60 ? `<p>Você está adiantado ${Math.round(-mean)} ms em média: está antecipando o bumbo. Tente ouvir mais e "cair junto" com ele.</p>`
        : `<p>Seu desvio médio é ${fmt(mean)} ms. Ficar um pouco adiantado (20 a 50 ms) é o normal humano.</p>`;
      const dots = offs.map(o => `<i style="left:${50 + Math.max(-150, Math.min(150, o)) / 3}%"></i>`).join('');
      res.innerHTML = `
        <div class="tt-nums"><div><b>${Math.round(sd)} ms</b><span>consistência (quanto menor, melhor)</span></div><div><b>${fmt(mean)} ms</b><span>desvio médio (+ atrasado, − adiantado)</span></div><div><b>${offs.length}</b><span>batidas medidas</span></div></div>
        <div class="tt-strip">${dots}<span class="l">−150 ms</span><span class="c">no tempo</span><span class="r">+150 ms</span></div>
        <p>Consistência: <b>${verdict}</b>.${best ? ` Seu melhor até agora: ${Math.min(best, Math.round(sd))} ms.` : ''}</p>${lat}`;
      res.hidden = false;
      status.textContent = 'Pronto. Resultado abaixo.';
    }
  }

  /* ---------- 2. Amostras de seção ---------- */
  function samples(root) {
    const bpm = +root.dataset.bpm || 124;
    const ex = { intro: 4, groove: 2, breakdown: 2, build: 4, drop: 2, outro: 2 };
    root.innerHTML = Object.keys(NAMES).map(k => `<button type="button" class="secondary" data-k="${k}"><span class="sw" style="background:${COLORS[k]}"></span>${NAMES[k]}</button>`).join('') + `<button type="button" class="secondary" data-stop>■ Parar</button>`;
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.stop != null) return DJSynth.stop();
      const k = b.dataset.k; DJSynth.play([{ type: k, bars: ex[k] }], bpm);
    });
  }

  /* ---------- 3. Mapeador de seções ---------- */
  function mapper(root) {
    const bpm = +root.dataset.bpm || 124;
    const keys = ['groove', 'breakdown', 'build', 'drop', 'outro'];
    root.innerHTML = `
      <div class="tt-head"><button type="button" data-go>▶ Tocar faixa surpresa</button><button type="button" class="secondary" data-stop disabled>■ Parar e ver resultado</button></div>
      <div class="sm-live"><b data-bar>–</b><span data-ph>A faixa começa na Intro. Marque cada seção nova no momento em que ela começa.</span></div>
      <div class="sm-btns">${keys.map((k, i) => `<button type="button" class="secondary" data-k="${k}" disabled><span class="sw" style="background:${COLORS[k]}"></span>${i + 1} · ${NAMES[k]}</button>`).join('')}</div>
      <ol class="sm-log" data-log></ol>
      <div data-res hidden></div>`;
    const go = root.querySelector('[data-go]'), stopB = root.querySelector('[data-stop]'), barEl = root.querySelector('[data-bar]'), ph = root.querySelector('[data-ph]'), log = root.querySelector('[data-log]'), res = root.querySelector('[data-res]');
    const btns = [...root.querySelectorAll('[data-k]')];
    let run = null, track = null, marks = [], live = false;
    function mark(k, e) {
      if (!live) return;
      const beatPos = (DJSynth.heard(e && e.timeStamp) - run.t0) / run.beat;
      marks.push({ k, beat: beatPos });
      const bar = Math.floor(beatPos / 4) + 1, beat = Math.floor(beatPos % 4) + 1;
      log.appendChild(h('li', {}, `${NAMES[k]} no compasso ${bar}, tempo ${beat}`));
    }
    btns.forEach(b => b.addEventListener('pointerdown', e => mark(b.dataset.k, e)));
    root._key = e => { if (!live) return; const n = +e.key; if (n >= 1 && n <= 5) mark(keys[n - 1], e); };
    document.addEventListener('keydown', root._key);
    go.addEventListener('click', async () => {
      track = DJSynth.randomTrack(); marks = []; log.innerHTML = ''; res.hidden = true;
      run = DJSynth.play(track, bpm); live = true;
      btns.forEach(b => b.disabled = false); stopB.disabled = false; go.disabled = true;
      const tick = () => {
        if (!live) return;
        const pos = (DJSynth.ctx.currentTime - run.t0) / run.beat;
        if (pos >= 0) { const bar = Math.floor(pos / 4); barEl.textContent = 'Compasso ' + (bar + 1); ph.textContent = `frase de 8: compasso ${(bar % 8) + 1} · tempo ${Math.floor(pos % 4) + 1}`; }
        requestAnimationFrame(tick);
      };
      tick();
      const why = await run.done; finish(why);
    });
    stopB.addEventListener('click', () => DJSynth.stop());
    function finish() {
      live = false; btns.forEach(b => b.disabled = true); stopB.disabled = true; go.disabled = false; go.textContent = '↻ Outra faixa surpresa';
      const total = run.totalBars, played = Math.min(total, Math.ceil((DJSynth.ctx.currentTime - run.t0) / run.beat / 4));
      const used = new Set(); let perfect = 0, right = 0, errs = [];
      const rows = track.map((s, i) => {
        const startBar = run.sectionStarts[i];
        if (i === 0) return `<tr><td>${NAMES[s.type]}</td><td>1</td><td>${s.bars} (${s.bars * 4} t)</td><td>começo da faixa</td></tr>`;
        if (startBar >= played) return `<tr><td>${NAMES[s.type]}</td><td>${startBar + 1}</td><td>${s.bars} (${s.bars * 4} t)</td><td>não chegou a tocar</td></tr>`;
        const target = startBar * 4;
        let bestJ = -1, bestD = 1e9;
        marks.forEach((m, j) => { const d = m.beat - target; if (!used.has(j) && d > -4 && d < 8 && Math.abs(d) < Math.abs(bestD)) { bestD = d; bestJ = j; } });
        let out;
        if (bestJ < 0) out = '<span class="bad">não marcado</span>';
        else {
          used.add(bestJ); const m = marks[bestJ]; errs.push(Math.abs(bestD));
          const t = Math.abs(bestD) <= 1.5 ? 'no tempo' : (bestD > 0 ? `${bestD.toFixed(1)} tempos atrasado` : `${(-bestD).toFixed(1)} tempos adiantado`);
          if (m.k === s.type) { right++; if (Math.abs(bestD) <= 1.5) perfect++; out = `<span class="ok">✓ ${t}</span>`; }
          else out = `<span class="bad">momento certo (${t}), nome errado: você disse ${NAMES[m.k]}</span>`;
        }
        return `<tr><td>${NAMES[s.type]}</td><td>${startBar + 1}</td><td>${s.bars} (${s.bars * 4} t)</td><td>${out}</td></tr>`;
      }).join('');
      const scored = track.filter((s, i) => i > 0 && run.sectionStarts[i] < played).length;
      const extra = marks.length - used.size;
      const lane = track.map((s, i) => `<div style="width:${s.bars / total * 100}%;background:${COLORS[s.type]}" title="${NAMES[s.type]}"><span>${NAMES[s.type]}</span></div>`).join('');
      const ticks = marks.map(m => `<i style="left:${Math.min(100, m.beat / 4 / total * 100)}%;background:${COLORS[m.k]}"></i>`).join('');
      const hist = store.get('map-hist') || []; hist.push({ right, perfect, scored, d: Date.now() }); store.set('map-hist', hist.slice(-20));
      res.innerHTML = `
        <div class="tt-nums"><div><b>${right}/${scored}</b><span>seções com nome certo</span></div><div><b>${perfect}/${scored}</b><span>certas e no tempo (±1,5 tempo)</span></div><div><b>${errs.length ? (errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(1) : '–'}</b><span>erro médio em tempos</span></div></div>
        <p class="sm-cap">A faixa real (em cima) e as suas marcas (embaixo)</p>
        <div class="sm-lane">${lane}</div><div class="sm-ticks">${ticks}</div>
        <div class="table-wrap"><table><tr><th>Seção</th><th>Começa</th><th>Compassos</th><th>Sua marca</th></tr>${rows}</table></div>
        ${extra > 0 ? `<p class="bad">${extra} marca(s) a mais, sem seção correspondente.</p>` : ''}
        <p>Repare no tamanho de cada seção: todas são múltiplos de 4 compassos, e a maioria tem 8 ou 16. Cada faixa surpresa sorteia tamanhos diferentes. Para gravar, a meta é acertar 5/5 com nome certo em duas faixas seguidas.</p>`;
      res.hidden = false;
    }
  }

  /* ---------- 4. Mapa de faixa real por minutagem ---------- */
  function tsMapper(root) {
    const bpm0 = +root.dataset.bpm || 130;
    const rows = ['Intro', 'Groove', 'Breakdown', 'Build-up', 'Drop', 'Breakdown 2', 'Drop 2', 'Outro', 'Fim da faixa'];
    root.innerHTML = `
      <div class="ts-top"><label>BPM <input id="ts-bpm" type="number" value="${bpm0}" min="60" max="200" step="0.1" inputmode="decimal"></label>
      <label>Primeiro bumbo em <input id="ts-first" type="text" value="0:00" inputmode="numeric" placeholder="m:ss"></label></div>
      <div class="table-wrap"><table><tr><th>Seção</th><th>Começa em (m:ss)</th><th>Compasso</th><th>Tamanho</th></tr>
      ${rows.map((r, i) => `<tr><td><input id="ts-n${i}" type="text" value="${r}" aria-label="Nome da seção"></td><td><input id="ts-t${i}" type="text" inputmode="numeric" placeholder="m:ss" aria-label="Tempo de início de ${r}"></td><td data-bar="${i}">–</td><td data-len="${i}">–</td></tr>`).join('')}
      </table></div>
      <label class="ts-out">Resumo para colar no chat<textarea id="ts-out" rows="5" readonly></textarea></label>`;
    const q = s => root.querySelector(s);
    const parse = v => { const m = /^(\d+):(\d{1,2}(?:[.,]\d+)?)$/.exec((v || '').trim()); return m ? +m[1] * 60 + parseFloat(m[2].replace(',', '.')) : null; };
    function calc() {
      const bpm = parseFloat(q('#ts-bpm').value) || bpm0, first = parse(q('#ts-first').value) || 0, barS = 240 / bpm;
      const pts = rows.map((_, i) => ({ n: q('#ts-n' + i).value, t: parse(q('#ts-t' + i).value) }));
      const out = [`Mapa (${bpm} BPM):`];
      pts.forEach((p, i) => {
        const bc = q(`[data-bar="${i}"]`), lc = q(`[data-len="${i}"]`);
        if (p.t == null) { bc.textContent = '–'; lc.textContent = '–'; return; }
        const bar = (p.t - first) / barS + 1; bc.textContent = bar.toFixed(1);
        const nx = pts.slice(i + 1).find(x => x.t != null);
        if (nx) { const len = (nx.t - p.t) / barS, r = Math.round(len), ok = Math.abs(len - r) < 0.6 && r % 4 === 0; lc.innerHTML = `${len.toFixed(1)} compassos <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '?'}</span>`; out.push(`${p.n}: ${q('#ts-t' + i).value} → compasso ${bar.toFixed(1)}, ${len.toFixed(1)} compassos`); }
        else { lc.textContent = '–'; out.push(`${p.n}: ${q('#ts-t' + i).value} → compasso ${bar.toFixed(1)}`); }
      });
      q('#ts-out').value = out.join('\n');
    }
    root.addEventListener('input', calc); calc();
  }

  document.querySelectorAll('.tap-test').forEach(tapTest);
  document.querySelectorAll('.section-samples').forEach(samples);
  document.querySelectorAll('.section-mapper').forEach(mapper);
  document.querySelectorAll('.timestamp-mapper').forEach(tsMapper);
})();
