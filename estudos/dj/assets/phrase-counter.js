// Contador de frases reutilizável.
// Você toca uma faixa em outro aparelho e bate no botão (ou espaço) junto com o bumbo.
// O contador mostra o BPM, o tempo, o compasso e a frase. Quando ouvir uma mudança
// na música, aperte "Mudou!" e ele diz se a mudança caiu na virada da frase.
// Uso: <div class="counter" data-beats-per-phrase="32"></div>
(function () {
  function init(root) {
    const BPP = parseInt(root.dataset.beatsPerPhrase || '32', 10); // tempos por frase
    const BARS = BPP / 4;
    root.innerHTML = `
      <div class="bpm"><span data-bpm>--</span> <small>BPM</small></div>
      <div data-pos style="font-size:.95rem">Bata no botão junto com o bumbo, começando no primeiro tempo de uma frase.</div>
      <div class="grid" data-grid></div>
      <div class="controls">
        <button type="button" class="tap" data-tap>Bater no tempo (espaço)</button>
        <button type="button" class="secondary" data-change>Mudou! (M)</button>
        <button type="button" class="secondary" data-reset>Zerar</button>
      </div>
      <ol class="log" data-log></ol>`;
    const grid = root.querySelector('[data-grid]');
    for (let b = 0; b < BARS; b++) {
      const el = document.createElement('div');
      el.className = 'bar';
      el.innerHTML = (b + 1) + '<span class="beats"><i></i><i></i><i></i><i></i></span>';
      grid.appendChild(el);
    }
    const bpmEl = root.querySelector('[data-bpm]');
    const posEl = root.querySelector('[data-pos]');
    const logEl = root.querySelector('[data-log]');
    let taps = [], count = 0, hits = 0, changes = 0;

    function draw() {
      const inPhrase = (count - 1) % BPP;          // 0..31
      const bar = Math.floor(inPhrase / 4);
      const beat = inPhrase % 4;
      const phrase = Math.floor((count - 1) / BPP) + 1;
      [...grid.children].forEach((el, i) => {
        el.classList.toggle('now', i === bar);
        [...el.querySelectorAll('i')].forEach((dot, j) => dot.classList.toggle('on', i < bar || (i === bar && j <= beat)));
      });
      posEl.textContent = `Frase ${phrase} · compasso ${bar + 1} de ${BARS} · tempo ${beat + 1}`;
    }
    function tap() {
      const now = performance.now();
      if (taps.length && now - taps[taps.length - 1] > 2000) { taps = []; } // pausa longa: recomeça medição
      taps.push(now);
      if (taps.length > 16) taps.shift();
      count++;
      if (taps.length >= 4) {
        const span = taps[taps.length - 1] - taps[0];
        bpmEl.textContent = Math.round(60000 / (span / (taps.length - 1)));
      }
      draw();
    }
    function change() {
      if (!count) return;
      const inPhrase = (count - 1) % BPP;
      // Virada = último compasso da frase (tempo 4) ou primeiro tempo da próxima.
      const hit = inPhrase === 0 || inPhrase === BPP - 1;
      const near = !hit && (inPhrase >= BPP - 4 || inPhrase <= 3);
      const bar = Math.floor(inPhrase / 4) + 1, beat = (inPhrase % 4) + 1;
      changes++; if (hit) hits++;
      const li = document.createElement('li');
      li.className = hit ? 'hit' : 'miss';
      li.textContent = hit
        ? `Compasso ${bar}, tempo ${beat}: na virada da frase. Sua contagem está alinhada.`
        : near
          ? `Compasso ${bar}, tempo ${beat}: perto da virada. Talvez você tenha batido um pouco atrasado ou adiantado.`
          : `Compasso ${bar}, tempo ${beat}: no meio da frase. Ou a contagem começou fora do tempo 1, ou essa faixa usa frases de outro tamanho. Zere e recomece no início de uma seção.`;
      logEl.appendChild(li);
    }
    function reset() { taps = []; count = 0; hits = 0; changes = 0; logEl.innerHTML = ''; bpmEl.textContent = '--'; posEl.textContent = 'Zerado. Comece de novo no tempo 1 de uma frase.'; [...grid.children].forEach(el => { el.classList.remove('now'); el.querySelectorAll('i').forEach(d => d.classList.remove('on')); }); }

    root.querySelector('[data-tap]').addEventListener('click', tap);
    root.querySelector('[data-change]').addEventListener('click', change);
    root.querySelector('[data-reset]').addEventListener('click', reset);
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); tap(); }
      if (e.key === 'm' || e.key === 'M') change();
    });
  }
  document.querySelectorAll('.counter').forEach(init);
})();
