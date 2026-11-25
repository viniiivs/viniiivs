// Componente de quiz reutilizável.
// Uso: <div class="quiz" data-quiz='[{"q":"...","opts":["a","b"],"answer":0,"why":"..."}]'></div>
(function () {
  function render(root) {
    const items = JSON.parse(root.dataset.quiz);
    let answered = 0, right = 0;
    const score = document.createElement('p');
    score.className = 'quiz-score';
    items.forEach((it, qi) => {
      const box = document.createElement('div');
      box.className = 'quiz-q';
      const q = document.createElement('p');
      q.className = 'q';
      q.textContent = (qi + 1) + '. ' + it.q;
      const opts = document.createElement('div');
      opts.className = 'quiz-opts';
      const fb = document.createElement('div');
      fb.className = 'quiz-feedback';
      fb.setAttribute('aria-live', 'polite');
      let done = false;
      it.opts.forEach((o, oi) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o;
        b.addEventListener('click', () => {
          if (done) return;
          done = true; answered++;
          const ok = oi === it.answer;
          if (ok) right++;
          b.classList.add(ok ? 'right' : 'wrong');
          opts.children[it.answer].classList.add('right');
          fb.textContent = (ok ? 'Isso. ' : 'Não. ') + (it.why || '');
          if (answered === items.length) {
            score.textContent = 'Resultado: ' + right + ' de ' + items.length +
              (right === items.length ? '. Pode seguir para a prática.' : '. Releia a seção acima e tente de novo amanhã, de memória.');
          }
        });
        opts.appendChild(b);
      });
      box.append(q, opts, fb);
      root.appendChild(box);
    });
    root.appendChild(score);
  }
  document.querySelectorAll('.quiz').forEach(render);
})();
