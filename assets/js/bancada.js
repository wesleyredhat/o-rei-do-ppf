// Teste de bancada: capô preto dividido ao meio, sem proteção e com PPF.
// Na metade sem PPF o risco e o pedrisco ficam; na metade com PPF a pedra quica
// e o risco some com o calor (autorregeneração).

const ESPERA_CALOR = 450; // ms entre soltar o dedo e o filme começar a se regenerar
const REGENERA_EM = 1600; // ms até o risco sumir
const AMARELO = '#ffc61a';

export function iniciaBancada(canvas, { placarSem, placarCom, dica, botaoPedra, botaoLimpar }) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let base;
  let danos;
  let gDanos;
  let riscosFilme = [];
  let efeitos = [];
  let marcasSem = 0;
  let marcasCom = 0;
  let traco = null;
  let animando = false;
  let tocou = false;
  let demoRodando = false;

  const meio = () => W / 2;
  const sorteio = (a, b) => a + Math.random() * (b - a);

  function camada() {
    const c = document.createElement('canvas');
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    return [c, g];
  }

  function pintaBase() {
    const [c, g] = camada();
    const verniz = g.createLinearGradient(0, 0, 0, H);
    verniz.addColorStop(0, '#26272a');
    verniz.addColorStop(.38, '#0c0d0f');
    verniz.addColorStop(1, '#17181b');
    g.fillStyle = verniz;
    g.fillRect(0, 0, W, H);
    // luminárias do studio refletidas no verniz
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-.32);
    for (const [y, h, a] of [[-.46, .07, .11], [-.2, .025, .07], [.18, .14, .045]]) {
      const luz = g.createLinearGradient(0, y * H, 0, (y + h) * H);
      luz.addColorStop(0, 'rgba(255,255,255,0)');
      luz.addColorStop(.5, `rgba(255,255,255,${a})`);
      luz.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = luz;
      g.fillRect(-W, y * H, W * 2, h * H);
    }
    g.restore();
    // flocos do metálico
    for (let i = 0; i < (W * H) / 70; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * .07})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    // metade com PPF: o filme deixa o verniz um pouco mais vivo
    const filme = g.createLinearGradient(meio(), 0, W, H);
    filme.addColorStop(0, 'rgba(255,255,255,.06)');
    filme.addColorStop(.5, 'rgba(255,255,255,.012)');
    filme.addColorStop(1, 'rgba(255,255,255,.05)');
    g.fillStyle = filme;
    g.fillRect(meio(), 0, W - meio(), H);
    g.fillStyle = AMARELO;
    g.fillRect(meio() - 1.5, 0, 3, H);
    return c;
  }

  function dimensiona() {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h || (w === W && h === H)) return;
    W = w;
    H = h;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    base = pintaBase();
    limpa();
  }

  function limpa() {
    [danos, gDanos] = camada();
    riscosFilme = [];
    efeitos = [];
    marcasSem = 0;
    marcasCom = 0;
    placar();
    anima();
  }

  function placar() {
    placarSem.textContent = marcasSem;
    placarCom.textContent = marcasCom;
  }

  function soNaMetadeSem(g, desenho) {
    g.save();
    g.beginPath();
    g.rect(0, 0, meio() - 1.5, H);
    g.clip();
    desenho();
    g.restore();
  }

  function segmento(g, a, b, d = 0) {
    g.beginPath();
    g.moveTo(a[0] + d, a[1] + d);
    g.lineTo(b[0] + d, b[1] + d);
    g.stroke();
  }

  // risco no verniz: sulco escuro, borda clara e brilho fino no fundo
  function riscoPermanente(a, b) {
    soNaMetadeSem(gDanos, () => {
      gDanos.lineCap = 'round';
      gDanos.strokeStyle = 'rgba(0,0,0,.6)';
      gDanos.lineWidth = 3;
      segmento(gDanos, a, b, .8);
      gDanos.strokeStyle = 'rgba(200,200,195,.75)';
      gDanos.lineWidth = 1.6;
      segmento(gDanos, a, b);
      gDanos.strokeStyle = 'rgba(255,255,255,.9)';
      gDanos.lineWidth = .6;
      segmento(gDanos, a, b);
    });
  }

  // lascado: some o verniz, aparece o primer claro e o metal no meio
  function lascado([x, y]) {
    const r = sorteio(5, 9);
    soNaMetadeSem(gDanos, () => {
      gDanos.beginPath();
      const lados = 9;
      for (let i = 0; i < lados; i++) {
        const ang = (i / lados) * Math.PI * 2 + sorteio(-.2, .2);
        const rr = r * sorteio(.6, 1.15);
        gDanos[i ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      gDanos.closePath();
      gDanos.fillStyle = '#d6d4cd';
      gDanos.fill();
      gDanos.strokeStyle = 'rgba(0,0,0,.65)';
      gDanos.lineWidth = 1;
      gDanos.stroke();
      gDanos.beginPath();
      gDanos.arc(x + sorteio(-1, 1), y + sorteio(-1, 1), r * .38, 0, Math.PI * 2);
      gDanos.fillStyle = '#7d7c78';
      gDanos.fill();
      gDanos.strokeStyle = 'rgba(225,225,220,.5)';
      gDanos.lineWidth = .7;
      for (let i = 0; i < 3; i++) {
        const ang = sorteio(0, Math.PI * 2);
        segmento(gDanos, [x + Math.cos(ang) * r, y + Math.sin(ang) * r], [x + Math.cos(ang) * r * 1.9, y + Math.sin(ang) * r * 1.9]);
      }
    });
  }

  function pedrisco(p) {
    const t0 = performance.now();
    if (p[0] < meio()) {
      lascado(p);
      marcasSem++;
      placar();
    } else {
      efeitos.push({ tipo: 'anel', x: p[0], y: p[1], t0 });
    }
    efeitos.push({ tipo: 'pedra', x: p[0], y: p[1], t0, vx: sorteio(-.25, .25), vy: sorteio(-.55, -.35) });
    efeitos.push({ tipo: 'clarao', x: p[0], y: p[1], t0 });
    anima();
  }

  // ---------- traço do dedo ----------
  function comeca(p) {
    traco = { inicio: p, ultimo: p, moveu: false, filme: null, contouSem: false, contouCom: false };
  }
  function move(p) {
    if (!traco) return;
    if (!traco.moveu && Math.hypot(p[0] - traco.inicio[0], p[1] - traco.inicio[1]) < 6) return;
    traco.moveu = true;
    const a = traco.ultimo;
    riscoPermanente(a, p);
    if (!traco.filme) {
      traco.filme = { pts: [a], fim: null, contou: false };
      riscosFilme.push(traco.filme);
    }
    traco.filme.pts.push(p);
    if (!traco.contouSem && (a[0] < meio() || p[0] < meio())) {
      traco.contouSem = true;
      marcasSem++;
    }
    if (!traco.contouCom && (a[0] > meio() || p[0] > meio())) {
      traco.contouCom = true;
      traco.filme.contou = true;
      marcasCom++;
    }
    traco.ultimo = p;
    placar();
    anima();
  }
  function termina() {
    if (!traco) return;
    if (!traco.moveu) pedrisco(traco.inicio);
    else if (traco.filme) traco.filme.fim = performance.now();
    traco = null;
    anima();
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (demoRodando) {
      demoRodando = false;
      termina();
    }
    tocou = true;
    dica.classList.add('some');
    canvas.setPointerCapture(e.pointerId);
    comeca(pos(e));
  });
  canvas.addEventListener('pointermove', (e) => { if (!demoRodando) move(pos(e)); });
  canvas.addEventListener('pointerup', () => { if (!demoRodando) termina(); });
  canvas.addEventListener('pointercancel', () => { if (!demoRodando) termina(); });

  botaoPedra.addEventListener('click', () => {
    pedrisco([sorteio(W * .06, meio() - W * .06), sorteio(H * .15, H * .85)]);
    setTimeout(() => pedrisco([sorteio(meio() + W * .06, W * .94), sorteio(H * .15, H * .85)]), 220);
  });
  botaoLimpar.addEventListener('click', limpa);

  // ---------- quadro a quadro ----------
  function desenha(agora) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    ctx.drawImage(danos, 0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(meio() + 1.5, 0, W, H);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    riscosFilme = riscosFilme.filter((r) => {
      const idade = r.fim ? agora - r.fim - ESPERA_CALOR : -1;
      const p = idade < 0 ? 0 : Math.min(1, idade / REGENERA_EM);
      if (p >= 1) {
        if (r.contou) marcasCom--;
        placar();
        return false;
      }
      const caminho = new Path2D();
      r.pts.forEach(([x, y], i) => (i ? caminho.lineTo(x, y) : caminho.moveTo(x, y)));
      if (p > 0) {
        ctx.strokeStyle = `rgba(255,150,40,${.38 * Math.sin(p * Math.PI)})`;
        ctx.lineWidth = 10;
        ctx.stroke(caminho);
      }
      ctx.strokeStyle = `rgba(235,235,230,${.55 * (1 - p * p)})`;
      ctx.lineWidth = 1.3;
      ctx.stroke(caminho);
      return true;
    });
    ctx.restore();

    efeitos = efeitos.filter((ef) => {
      const t = agora - ef.t0;
      if (ef.tipo === 'anel') {
        if (t > 520) return false;
        const k = t / 520;
        ctx.strokeStyle = `rgba(255,198,26,${.8 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, 4 + k * 26, 0, Math.PI * 2);
        ctx.stroke();
        return true;
      }
      if (ef.tipo === 'clarao') {
        if (t > 140) return false;
        ctx.fillStyle = `rgba(255,255,255,${.6 * (1 - t / 140)})`;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, 9, 0, Math.PI * 2);
        ctx.fill();
        return true;
      }
      if (t > 650) return false;
      const x = ef.x + ef.vx * t;
      const y = ef.y + ef.vy * t + .0012 * t * t;
      ctx.fillStyle = `rgba(150,148,142,${1 - t / 650})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    return riscosFilme.length > 0 || efeitos.length > 0;
  }
  function anima() {
    if (animando || !W) return;
    animando = true;
    requestAnimationFrame(function quadro(agora) {
      if (desenha(agora) || traco) requestAnimationFrame(quadro);
      else animando = false;
    });
  }

  // ---------- demonstração automática na primeira vez ----------
  function demonstra() {
    if (tocou || !W) return;
    demoRodando = true;
    const pts = Array.from({ length: 46 }, (_, i) => {
      const t = i / 45;
      return [W * (.08 + .84 * t), H * (.3 + .32 * t + .07 * Math.sin(t * 10))];
    });
    comeca(pts[0]);
    let i = 1;
    const passo = () => {
      if (!demoRodando) return;
      move(pts[i++]);
      if (i < pts.length) return setTimeout(passo, 24);
      termina();
      demoRodando = false;
      setTimeout(() => !tocou && pedrisco([W * .27, H * .74]), 350);
      setTimeout(() => !tocou && pedrisco([W * .74, H * .26]), 700);
      setTimeout(() => { if (!tocou) dica.textContent = 'Sua vez: arraste para riscar · toque para jogar pedrisco'; }, 1000);
    };
    setTimeout(passo, 24);
  }

  new ResizeObserver(dimensiona).observe(canvas);
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduzido) {
    const io = new IntersectionObserver(([it]) => {
      if (!it.isIntersecting) return;
      io.disconnect();
      setTimeout(demonstra, 500);
    }, { threshold: .6 });
    io.observe(canvas);
  }
}
