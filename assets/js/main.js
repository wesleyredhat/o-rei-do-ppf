import { CONFIG, SERVICOS, waLink, supabaseLigado, fotoUrl } from './config.js';
import { iniciaBancada } from './bancada.js';

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

// ---------- monte sua proteção ----------
const PARTES = {
  'parachoque-d': 'Para-choque dianteiro',
  farois: 'Faróis',
  capo: 'Capô',
  'paralamas-d': 'Para-lamas dianteiros',
  retrovisores: 'Retrovisores',
  portas: 'Portas',
  teto: 'Teto e colunas',
  'paralamas-t': 'Laterais traseiras',
  tampa: 'Tampa traseira',
  'parachoque-t': 'Para-choque traseiro',
  lanternas: 'Lanternas',
  vidros: 'Vidros (película)',
};
const FRONTAL = ['parachoque-d', 'farois', 'capo', 'paralamas-d', 'retrovisores'];
const PPF = Object.keys(PARTES).filter((p) => p !== 'vidros');
const PACOTES = { frontal: FRONTAL, full: PPF, vidros: ['vidros'] };
const escolhidas = new Set();
const pecas = $$('#carro-topo .partes path');

for (const p of pecas) {
  p.setAttribute('tabindex', '0');
  p.setAttribute('role', 'checkbox');
  p.setAttribute('aria-label', PARTES[p.dataset.parte]);
  const irmas = () => pecas.filter((q) => q.dataset.parte === p.dataset.parte);
  p.addEventListener('pointerenter', () => irmas().forEach((q) => q.classList.add('foco')));
  p.addEventListener('pointerleave', () => irmas().forEach((q) => q.classList.remove('foco')));
  p.addEventListener('click', () => alterna(p.dataset.parte));
  p.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alterna(p.dataset.parte); }
  });
}
function alterna(parte) {
  escolhidas.has(parte) ? escolhidas.delete(parte) : escolhidas.add(parte);
  atualizaMonte();
}
for (const b of $$('[data-pacote]')) {
  b.addEventListener('click', () => {
    const pacote = PACOTES[b.dataset.pacote];
    if (!pacote) escolhidas.clear();
    else if (pacote.every((p) => escolhidas.has(p))) pacote.forEach((p) => escolhidas.delete(p));
    else pacote.forEach((p) => escolhidas.add(p));
    atualizaMonte();
  });
}
function servicoSugerido() {
  const ppf = PPF.filter((p) => escolhidas.has(p));
  if (ppf.length === PPF.length) return 'ppf-full';
  if (!ppf.length) return escolhidas.has('vidros') ? 'pelicula' : null;
  return ppf.every((p) => FRONTAL.includes(p)) ? 'ppf-frontal' : 'ppf-partes';
}
function atualizaMonte() {
  const total = Object.keys(PARTES).length;
  const lista = Object.keys(PARTES).filter((p) => escolhidas.has(p));
  for (const p of pecas) {
    const on = escolhidas.has(p.dataset.parte);
    p.classList.toggle('on', on);
    p.setAttribute('aria-checked', String(on));
  }
  for (const b of $$('[data-pacote]')) {
    const pacote = PACOTES[b.dataset.pacote];
    if (pacote) b.setAttribute('aria-pressed', String(pacote.every((p) => escolhidas.has(p))));
  }
  $('#monte-total').textContent = lista.length;
  $('#monte-max').textContent = total;
  $('#monte-barra').style.width = `${(lista.length / total) * 100}%`;
  $('#monte-lista').innerHTML = lista.length
    ? lista.map((p) => `<li>${PARTES[p]}</li>`).join('')
    : '<li class="vazio">Nenhuma parte escolhida ainda.</li>';
  $('#f-partes-campo').hidden = !lista.length;
  $('#f-partes').textContent = lista.map((p) => PARTES[p]).join(', ');
}
$('#monte-enviar').addEventListener('click', () => {
  const s = servicoSugerido();
  if (s) selServico.value = s;
});
atualizaMonte();

// ---------- simulador de película ----------
const PELICULAS = [
  { g: 5, tinta: .93, desc: 'Máxima privacidade. De fora, quase não se vê o interior.' },
  { g: 20, tinta: .8, desc: 'Bem escura. Privacidade alta e visual esportivo.' },
  { g: 35, tinta: .64, desc: 'Equilíbrio entre privacidade e visibilidade.' },
  { g: 50, tinta: .46, desc: 'Leve. Corta o brilho do sol sem escurecer muito.' },
  { g: 70, tinta: .24, desc: 'Quase transparente. Conforto térmico sem mudar o visual.' },
];
const faixa = $('#sim-faixa');
function atualizaSimulador() {
  const p = PELICULAS[Number(faixa.value)];
  $('#tinta').setAttribute('opacity', p.tinta);
  $('#sim-g').textContent = `G${p.g}`;
  $('#sim-luz').textContent = `${p.g}%`;
  $('#sim-desc').textContent = p.desc;
  $('#sim-priv').style.width = `${((100 - p.g) / 95) * 100}%`;
  $('#sim-vis').style.width = `${(p.g / 70) * 100}%`;
  faixa.setAttribute('aria-valuetext', `G${p.g}, ${p.g}% da luz passa`);
}
faixa.addEventListener('input', atualizaSimulador);
atualizaSimulador();

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
  const partes = Object.keys(PARTES).filter((p) => escolhidas.has(p)).map((p) => PARTES[p]);
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
const revelar = [...$$('.secao__topo'), ...$$('.grid-largada > li'), ...$$('.volta__etapa'), $('.bancada__quadro'), $('.bancada__painel'), $('.monte__planta'), $('.monte__painel'), $('.simulador__cena'), $('.simulador__controle'), $('.faq'), $('.form')].filter(Boolean);
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

// o botão flutuante sai de cena quando o formulário está na tela
if ('IntersectionObserver' in window) {
  const flutuante = $('#wa-flutuante');
  new IntersectionObserver(([it]) => flutuante.classList.toggle('escondido', it.isIntersecting), { threshold: .2 }).observe($('#orcamento'));
}
