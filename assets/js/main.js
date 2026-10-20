import { CONFIG, SERVICOS, waLink, supabaseLigado, fotoUrl } from './config.js';
import { iniciaBancada } from './bancada.js';
import { PARTES, PACOTES, PELICULAS } from './partes.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomeServico = (id) => SERVICOS.find((s) => s.id === id)?.nome ?? id ?? '';

// ---------- topo e menu ----------
const topo = $('#topo');
const marcaTopo = () => topo.classList.toggle('rolou', scrollY > 30);
addEventListener('scroll', marcaTopo, { passive: true });
marcaTopo();

const menu = $('#menu');
const menuBotao = $('#menu-botao');
function abreMenu(aberto) {
  menu.classList.toggle('aberto', aberto);
  menuBotao.setAttribute('aria-expanded', String(aberto));
  document.body.classList.toggle('menu-aberto', aberto);
}
menuBotao.addEventListener('click', () => abreMenu(!menu.classList.contains('aberto')));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) abreMenu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') abreMenu(false); });

// ---------- links de WhatsApp ----------
for (const a of $$('[data-wa]')) {
  a.href = waLink(a.dataset.wa);
  a.target = '_blank';
  a.rel = 'noopener';
}
for (const a of [$('#contato-wa'), $('#wa-flutuante')]) a.href = waLink('Olá! Vim pelo site do Rei do PPF.');
$('#ano').textContent = new Date().getFullYear();

// ---------- grid de largada ----------
$('#lista-servicos').innerHTML = SERVICOS.map((s, i) => `
  <li>
    <article class="posicao">
      <span class="posicao__p" aria-hidden="true">P${i + 1}</span>
      <span class="posicao__tag">Posição ${i + 1}</span>
      <h3>${esc(s.nome)}</h3>
      <p>${esc(s.texto)}</p>
      <ul>${s.itens.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
      <div class="posicao__rodape">
        <span class="posicao__preco">${esc(s.preco)}</span>
        <a class="posicao__link" href="#orcamento" data-servico="${s.id}">Quero esse</a>
      </div>
    </article>
  </li>`).join('');

// ---------- formulário ----------
const selServico = $('#f-servico');
selServico.innerHTML = [
  ...SERVICOS.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`),
  '<option value="ppf-partes">PPF em partes do carro</option>',
  '<option value="indicacao">Ainda não sei, quero uma indicação</option>',
].join('');
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-servico]');
  if (link) selServico.value = link.dataset.servico;
});

// ---------- teste de bancada ----------
iniciaBancada($('#bancada-tela'), {
  placarSem: $('#placar-sem'),
  placarCom: $('#placar-com'),
  dica: $('#bancada-dica'),
  botaoPedra: $('#bancada-pedra'),
  botaoLimpar: $('#bancada-limpar'),
});

// ---------- simulador 3D: monte sua proteção ----------
const escolhidas = new Set();
let studio = null;
let pelicula = 4;
let corAtual = '#22242a';

$('#pecas').innerHTML = PARTES.map((p) => `<button type="button" class="chip chip--peca" data-peca="${p.id}" aria-pressed="false">${esc(p.nome)}</button>`).join('');
$('#pecas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-peca]');
  if (b) alterna(b.dataset.peca);
});
function alterna(id) {
  escolhidas.has(id) ? escolhidas.delete(id) : escolhidas.add(id);
  atualizaMonte();
}
for (const b of $$('[data-pacote]')) {
  b.addEventListener('click', () => {
    const pacote = PACOTES[b.dataset.pacote];
    if (!pacote) escolhidas.clear();
    else if (pacote.every((id) => escolhidas.has(id))) pacote.forEach((id) => escolhidas.delete(id));
    else pacote.forEach((id) => escolhidas.add(id));
    atualizaMonte();
  });
}
function servicoSugerido() {
  const ppf = PACOTES.full.filter((id) => escolhidas.has(id));
  if (ppf.length === PACOTES.full.length) return 'ppf-full';
  if (!ppf.length) return escolhidas.has('vidros') ? 'pelicula' : null;
  if (ppf.every((id) => PACOTES.farois.includes(id))) return 'ppf-farois';
  return ppf.every((id) => PACOTES.frontal.includes(id)) ? 'ppf-frontal' : 'ppf-partes';
}
function atualizaMonte() {
  const lista = PARTES.filter((p) => escolhidas.has(p.id));
  for (const b of $$('[data-peca]')) b.setAttribute('aria-pressed', String(escolhidas.has(b.dataset.peca)));
  for (const b of $$('[data-pacote]')) {
    const pacote = PACOTES[b.dataset.pacote];
    if (pacote) b.setAttribute('aria-pressed', String(pacote.every((id) => escolhidas.has(id))));
  }
  $('#monte-total').textContent = lista.length;
  $('#monte-max').textContent = PARTES.length;
  $('#monte-barra').style.width = `${(lista.length / PARTES.length) * 100}%`;
  $('#f-partes-campo').hidden = !lista.length;
  $('#f-partes').textContent = lista.map((p) => p.nome).join(', ');
  studio?.define(escolhidas);
}
$('#monte-enviar').addEventListener('click', () => {
  const s = servicoSugerido();
  if (s) selServico.value = s;
});

// película: mexer no controle já coloca os vidros na proteção
const faixa = $('#sim-faixa');
function mostraPelicula() {
  const p = PELICULAS[pelicula];
  $('#sim-g').textContent = `G${p.g}`;
  $('#sim-desc').textContent = `${p.g}% da luz passa. ${p.desc}`;
  faixa.setAttribute('aria-valuetext', `G${p.g}, ${p.g}% da luz passa`);
}
faixa.addEventListener('input', () => {
  pelicula = Number(faixa.value);
  escolhidas.add('vidros');
  mostraPelicula();
  studio?.pelicula(pelicula);
  atualizaMonte();
});
mostraPelicula();
atualizaMonte();

for (const b of $$('[data-cor]')) {
  b.addEventListener('click', () => {
    corAtual = b.dataset.cor;
    for (const o of $$('[data-cor]')) o.setAttribute('aria-pressed', String(o === b));
    studio?.cor(corAtual);
  });
}

// o 3D só carrega quando o visitante chega perto do simulador
const palco = $('#studio-palco');
const rotulo = $('#studio-rotulo');
let abrindo = false;
function semTresD(msg) {
  palco.classList.add('sem-3d');
  $('#studio-status').textContent = msg;
}
function abreStudio() {
  if (abrindo) return;
  abrindo = true;
  if (!window.WebGL2RenderingContext) return semTresD('Este aparelho não abre o 3D. Escolha as peças aqui embaixo.');
  import('./estudio3d.js')
    .then(({ montaStudio }) => montaStudio(palco, {
      urlModelo: 'assets/3d/carro.glb',
      urlCoroa: 'assets/img/logo.png',
      deslocaX: () => (matchMedia('(min-width: 1100px)').matches ? $('#studio-painel').offsetWidth / 2 : 0),
      aoProgresso: (p) => {
        $('#studio-barra').style.width = `${Math.round(p * 100)}%`;
        $('#studio-status').textContent = `Abrindo o studio ${Math.round(p * 100)}%`;
      },
      aoClicar: (id) => {
        $('#studio-dica').classList.add('some');
        alterna(id);
      },
      aoPassar: (info) => {
        rotulo.hidden = !info;
        if (!info) return;
        rotulo.textContent = `${info.nome} · ${escolhidas.has(info.id) ? 'protegida' : 'toque para proteger'}`;
        rotulo.style.left = `${info.x + 14}px`;
        rotulo.style.top = `${info.y + 14}px`;
      },
    }))
    .then((s) => {
      studio = s;
      studio.cor(corAtual);
      studio.pelicula(pelicula);
      studio.define(escolhidas);
      palco.classList.add('pronto');
    })
    .catch((err) => {
      console.warn('studio 3D indisponível', err);
      semTresD('O 3D não abriu neste aparelho. Escolha as peças aqui embaixo.');
    });
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(([it]) => {
    if (!it.isIntersecting) return;
    io.disconnect();
    abreStudio();
  }, { rootMargin: '700px 0px' });
  io.observe(palco);
} else {
  abreStudio();
}

// ---------- galeria ----------
let fotos = [];
let filtro = null;
let visiveis = [];

function vagas() {
  $('#galeria-lista').innerHTML = Array.from({ length: 6 }, () => `
    <li><div class="vaga"><img src="assets/img/logo-160.png" alt=""><span>Fotos em breve</span></div></li>`).join('');
}
function renderGaleria() {
  visiveis = filtro ? fotos.filter((f) => f.servico === filtro) : fotos;
  $('#galeria-lista').innerHTML = visiveis.map((f, i) => `
    <li class="revela visto">
      <button type="button" data-foto="${i}" aria-label="Ampliar foto ${esc(f.carro || '')}">
        <img src="${fotoUrl(f.thumb || f.path)}" alt="${esc([f.carro, nomeServico(f.servico)].filter(Boolean).join(', ')) || 'Carro protegido pelo Rei do PPF'}" loading="lazy" decoding="async">
      </button>
      ${f.carro || f.servico ? `<div class="legenda"><strong>${esc(f.carro)}</strong><span>${esc(nomeServico(f.servico))}</span></div>` : ''}
    </li>`).join('');
}
function renderFiltros() {
  const usados = [...new Set(fotos.map((f) => f.servico).filter(Boolean))];
  const caixa = $('#galeria-filtros');
  caixa.hidden = usados.length < 2;
  caixa.innerHTML = [`<button type="button" class="chip" data-filtro="" aria-pressed="${!filtro}">Todos</button>`,
    ...usados.map((s) => `<button type="button" class="chip" data-filtro="${esc(s)}" aria-pressed="${filtro === s}">${esc(nomeServico(s))}</button>`)].join('');
}
$('#galeria-filtros').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (!b) return;
  filtro = b.dataset.filtro || null;
  renderFiltros();
  renderGaleria();
});

async function carregaFotos() {
  if (!supabaseLigado()) return vagas();
  try {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/fotos?select=id,path,thumb,carro,servico,legenda,destaque&publicado=eq.true&order=destaque.desc,created_at.desc&limit=60`;
    const r = await fetch(url, { headers: { apikey: CONFIG.SUPABASE_ANON_KEY } });
    if (!r.ok) throw new Error(r.status);
    fotos = await r.json();
  } catch (err) {
    console.warn('galeria indisponível', err);
  }
  if (!fotos.length) return vagas();
  renderFiltros();
  renderGaleria();
  const capa = fotos.find((f) => f.destaque);
  if (capa) {
    const img = new Image();
    img.onload = () => {
      $('#hero-foto').style.backgroundImage = `url("${img.src}")`;
      $('.hero').classList.add('tem-foto');
    };
    img.src = fotoUrl(capa.path);
  }
}
carregaFotos();

// ---------- lightbox ----------
const lb = $('#lightbox');
let atual = 0;
function mostra(i) {
  atual = (i + visiveis.length) % visiveis.length;
  const f = visiveis[atual];
  $('#lightbox-img').src = fotoUrl(f.path);
  $('#lightbox-img').alt = f.carro || 'Carro protegido pelo Rei do PPF';
  $('#lightbox-legenda').innerHTML = [f.carro && `<strong>${esc(f.carro)}</strong>`, esc(nomeServico(f.servico)), esc(f.legenda)].filter(Boolean).join(' · ');
}
function abreLb(i) {
  mostra(i);
  lb.hidden = false;
  document.body.classList.add('menu-aberto');
  $('.lightbox__fechar').focus();
}
function fechaLb() {
  lb.hidden = true;
  document.body.classList.remove('menu-aberto');
}
$('#galeria-lista').addEventListener('click', (e) => {
  const b = e.target.closest('[data-foto]');
  if (b) abreLb(Number(b.dataset.foto));
});
lb.addEventListener('click', (e) => {
  const acao = e.target.closest('[data-lb]')?.dataset.lb;
  if (acao === 'fechar' || e.target === lb) fechaLb();
  if (acao === 'ant') mostra(atual - 1);
  if (acao === 'prox') mostra(atual + 1);
});
addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') fechaLb();
  if (e.key === 'ArrowLeft') mostra(atual - 1);
  if (e.key === 'ArrowRight') mostra(atual + 1);
});
let toqueX = null;
lb.addEventListener('touchstart', (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  if (Math.abs(dx) > 50) mostra(atual + (dx < 0 ? 1 : -1));
  toqueX = null;
});

// ---------- envio do orçamento ----------
$('#form-orcamento').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const nome = form.nome.value.trim();
  const carro = form.carro.value.trim();
  form.nome.setAttribute('aria-invalid', String(!nome));
  form.carro.setAttribute('aria-invalid', String(!carro));
  if (!nome || !carro) {
    $('#form-erro').textContent = 'Preencha seu nome e o carro.';
    (nome ? form.carro : form.nome).focus();
    return;
  }
  $('#form-erro').textContent = '';
  const partes = PARTES.filter((p) => escolhidas.has(p.id)).map((p) => p.nome);
  const servico = selServico.options[selServico.selectedIndex].text;
  const obs = form.mensagem.value.trim();
  const linhas = [
    'Olá! Vim pelo site e quero um orçamento.',
    '',
    `*Nome:* ${nome}`,
    `*Carro:* ${carro}`,
    `*Serviço:* ${servico}`,
  ];
  if (partes.length) linhas.push(`*Partes:* ${partes.join(', ')}`);
  if (obs) linhas.push(`*Obs.:* ${obs}`);
  const link = waLink(linhas.join('\n'));
  if (!window.open(link, '_blank', 'noopener')) location.href = link;
});

// ---------- revelar ao rolar ----------
const revelar = [...$$('.secao__topo'), ...$$('.grid-largada > li'), ...$$('.volta__etapa'), $('.bancada__quadro'), $('.bancada__painel'), $('.faq'), $('.form')].filter(Boolean);
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((itens) => {
    for (const it of itens) if (it.isIntersecting) { it.target.classList.add('visto'); io.unobserve(it.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  revelar.forEach((el, i) => {
    el.classList.add('revela');
    el.style.transitionDelay = `${(i % 3) * 80}ms`;
    io.observe(el);
  });
}

// o botão flutuante sai de cena no topo (que já tem o botão de WhatsApp) e no formulário
if ('IntersectionObserver' in window) {
  const flutuante = $('#wa-flutuante');
  const naTela = new Set();
  new IntersectionObserver((itens) => {
    for (const it of itens) it.isIntersecting ? naTela.add(it.target) : naTela.delete(it.target);
    flutuante.classList.toggle('escondido', naTela.size > 0);
  }, { threshold: .2 }).observe($('#orcamento'));
  new IntersectionObserver(([it]) => {
    it.isIntersecting ? naTela.add(it.target) : naTela.delete(it.target);
    flutuante.classList.toggle('escondido', naTela.size > 0);
  }, { threshold: .5 }).observe($('.hero'));
}
