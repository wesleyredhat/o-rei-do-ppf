import { CONFIG, SERVICOS, supabaseLigado, fotoUrl } from './config.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EXTRAS = { 'ppf-partes': 'PPF em partes do carro' };
const nomeServico = (id) => SERVICOS.find((s) => s.id === id)?.nome ?? EXTRAS[id] ?? id ?? '';

// Tamanhos das fotos salvas: a grande abre na tela cheia, a miniatura vai na grade.
const GRANDE = { lado: 2000, qualidade: .85 };
const MINI = { lado: 640, qualidade: .8 };

const opcoes = [
  '<option value="">Sem serviço</option>',
  ...SERVICOS.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`),
  ...Object.entries(EXTRAS).map(([id, nome]) => `<option value="${id}">${esc(nome)}</option>`),
].join('');
$('#s-servico').innerHTML = opcoes;
$('#ed-servico').innerHTML = opcoes;

let sb;
let fotos = [];
let escolhidos = [];

function tela(qual) {
  for (const id of ['tela-entrar', 'tela-sem-banco', 'tela-painel']) $(`#${id}`).hidden = id !== qual;
}

let avisoTempo;
function aviso(msg, erro = false) {
  const el = $('#aviso');
  el.textContent = msg;
  el.classList.toggle('erro', erro);
  el.hidden = false;
  clearTimeout(avisoTempo);
  avisoTempo = setTimeout(() => { el.hidden = true; }, 4000);
}

async function ehAdmin() {
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

async function inicia() {
  if (!supabaseLigado()) return tela('tela-sem-banco');
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (session && await ehAdmin()) return abrePainel();
  tela('tela-entrar');
}

$('#form-entrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const botao = e.submitter;
  const erro = $('#entrar-erro');
  erro.textContent = '';
  botao.disabled = true;
  try {
    const { error } = await sb.auth.signInWithPassword({ email: $('#e-email').value.trim(), password: $('#e-senha').value });
    if (error) throw new Error('E-mail ou senha incorretos.');
    if (!await ehAdmin()) {
      await sb.auth.signOut();
      throw new Error('Este usuário não tem acesso ao painel.');
    }
    $('#e-senha').value = '';
    abrePainel();
  } catch (err) {
    erro.textContent = err.message;
  } finally {
    botao.disabled = false;
  }
});

$('#sair').addEventListener('click', async () => {
  await sb.auth.signOut();
  tela('tela-entrar');
});

function abrePainel() {
  tela('tela-painel');
  carregaFotos();
}

// ---------- escolher fotos ----------
function adiciona(lista) {
  const novas = [...lista].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  escolhidos.push(...novas.map((file) => ({ file, url: URL.createObjectURL(file) })));
  renderPrevias();
}
function renderPrevias() {
  $('#previas').innerHTML = escolhidos.map((e, i) => `
    <li>
      <img src="${e.url}" alt="">
      ${i === 0 ? '<span class="previas__capa">1ª</span>' : ''}
      <button type="button" data-tirar="${i}" aria-label="Tirar esta foto">×</button>
    </li>`).join('');
  $('#form-subir').hidden = !escolhidos.length;
  $('#s-enviar').textContent = escolhidos.length === 1 ? 'Publicar 1 foto' : `Publicar ${escolhidos.length} fotos`;
}
$('#arquivos').addEventListener('change', (e) => {
  adiciona(e.target.files);
  e.target.value = '';
});
$('#previas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tirar]');
  if (!b) return;
  const [tirado] = escolhidos.splice(Number(b.dataset.tirar), 1);
  URL.revokeObjectURL(tirado.url);
  renderPrevias();
});
const soltar = $('#soltar');
soltar.addEventListener('dragover', (e) => { e.preventDefault(); soltar.classList.add('sobre'); });
soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
soltar.addEventListener('drop', (e) => {
  e.preventDefault();
  soltar.classList.remove('sobre');
  adiciona(e.dataTransfer.files);
});

// ---------- reduzir e enviar ----------
function carregaImagem(file) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error(`Não consegui abrir ${file.name}. Tente salvar a foto como JPG.`));
    img.src = URL.createObjectURL(file);
  });
}
async function reduz(file, { lado, qualidade }) {
  let fonte;
  try {
    fonte = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    fonte = await carregaImagem(file);
  }
  const k = Math.min(1, lado / Math.max(fonte.width, fonte.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(fonte.width * k);
  canvas.height = Math.round(fonte.height * k);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) => canvas.toBlob(
    (b) => (b ? ok(b) : falha(new Error(`Não consegui converter ${file.name}.`))), 'image/jpeg', qualidade));
}
async function envia(caminho, blob) {
  const { error } = await sb.storage.from(CONFIG.BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
}
function progresso(feitas, total) {
  const el = $('#progresso');
  el.hidden = false;
  el.querySelector('i').style.width = `${(feitas / total) * 100}%`;
  el.querySelector('span').textContent = `${feitas} de ${total}`;
}

$('#form-subir').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!escolhidos.length) return;
  const botao = $('#s-enviar');
  const erroEl = $('#subir-erro');
  erroEl.textContent = '';
  botao.disabled = true;
  const dados = {
    carro: $('#s-carro').value.trim() || null,
    servico: $('#s-servico').value || null,
    legenda: $('#s-legenda').value.trim() || null,
  };
  const capa = $('#s-destaque').checked;
  const fila = [...escolhidos];
  const falhas = [];
  const agora = new Date();
  const pasta = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, '0')}`;
  progresso(0, fila.length);

  for (const [i, item] of fila.entries()) {
    try {
      const id = crypto.randomUUID();
      const path = `${pasta}/${id}.jpg`;
      const thumb = `${pasta}/${id}-p.jpg`;
      const [grande, mini] = await Promise.all([reduz(item.file, GRANDE), reduz(item.file, MINI)]);
      await envia(path, grande);
      await envia(thumb, mini);
      const { error } = await sb.from('fotos').insert({ ...dados, path, thumb, destaque: capa && i === 0 });
      if (error) {
        await sb.storage.from(CONFIG.BUCKET).remove([path, thumb]);
        throw error;
      }
      URL.revokeObjectURL(item.url);
      escolhidos = escolhidos.filter((x) => x !== item);
    } catch (err) {
      console.error(err);
      falhas.push(`${item.file.name}: ${err.message}`);
    }
    progresso(i + 1, fila.length);
  }

  botao.disabled = false;
  $('#progresso').hidden = true;
  renderPrevias();
  const enviadas = fila.length - falhas.length;
  if (falhas.length) {
    erroEl.textContent = `Não subiram: ${falhas.join(' | ')}`;
  } else {
    for (const id of ['s-carro', 's-legenda']) $(`#${id}`).value = '';
    $('#s-servico').value = '';
    $('#s-destaque').checked = false;
  }
  if (enviadas) aviso(enviadas === 1 ? 'Foto publicada.' : `${enviadas} fotos publicadas.`);
  carregaFotos();
});

// ---------- fotos no site ----------
async function carregaFotos() {
  const { data, error } = await sb.from('fotos').select('*').order('created_at', { ascending: false });
  if (error) return aviso('Não consegui carregar as fotos.', true);
  fotos = data;
  renderFotos();
}
const COROA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4L3 18Zm0 2h18v2H3z"/></svg>';
function renderFotos() {
  const publicadas = fotos.filter((f) => f.publicado).length;
  const ocultas = fotos.length - publicadas;
  $('#contador').textContent = `${publicadas} no site${ocultas ? `, ${ocultas} oculta${ocultas > 1 ? 's' : ''}` : ''}`;
  $('#adm-fotos').innerHTML = fotos.length ? fotos.map((f) => `
    <li class="adm-foto${f.publicado ? '' : ' oculta'}" data-id="${f.id}">
      <img src="${fotoUrl(f.thumb || f.path)}" alt="" loading="lazy">
      ${f.destaque ? '<span class="adm-foto__selo">Capa</span>' : ''}
      ${f.publicado ? '' : '<span class="adm-foto__selo adm-foto__selo--oculta">Oculta</span>'}
      <div class="adm-foto__info">
        <strong>${esc(f.carro) || 'Sem nome'}</strong>
        <span>${esc(nomeServico(f.servico))}</span>
      </div>
      <div class="adm-foto__acoes">
        <button type="button" data-acao="destaque" aria-pressed="${f.destaque}" title="Capa do site">${COROA}<span class="sr">Capa do site</span></button>
        <button type="button" data-acao="publicado">${f.publicado ? 'Ocultar' : 'Mostrar'}</button>
        <button type="button" data-acao="editar">Editar</button>
        <button type="button" data-acao="apagar" class="perigo">Apagar</button>
      </div>
    </li>`).join('') : '<li class="adm-vazio">Nenhuma foto ainda. Suba as primeiras aqui em cima.</li>';
}

async function altera(foto, campos) {
  const { error } = await sb.from('fotos').update(campos).eq('id', foto.id);
  if (error) return aviso('Não consegui salvar.', true);
  Object.assign(foto, campos);
  renderFotos();
}

$('#adm-fotos').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const foto = fotos.find((f) => f.id === b.closest('[data-id]').dataset.id);
  const acao = b.dataset.acao;
  if (acao === 'destaque') return altera(foto, { destaque: !foto.destaque });
  if (acao === 'publicado') return altera(foto, { publicado: !foto.publicado });
  if (acao === 'editar') return abreEdicao(foto);
  if (acao === 'apagar') {
    if (!confirm('Apagar esta foto do site? Não dá para desfazer.')) return;
    const { error } = await sb.from('fotos').delete().eq('id', foto.id);
    if (error) return aviso('Não consegui apagar.', true);
    await sb.storage.from(CONFIG.BUCKET).remove([foto.path, foto.thumb].filter(Boolean));
    fotos = fotos.filter((f) => f !== foto);
    renderFotos();
    aviso('Foto apagada.');
  }
});

// ---------- editar ----------
const dialogo = $('#editar');
let editando = null;
function abreEdicao(foto) {
  editando = foto;
  $('#ed-img').src = fotoUrl(foto.thumb || foto.path);
  $('#ed-carro').value = foto.carro ?? '';
  $('#ed-servico').value = foto.servico ?? '';
  $('#ed-legenda').value = foto.legenda ?? '';
  dialogo.showModal();
}
dialogo.addEventListener('close', () => {
  if (dialogo.returnValue === 'salvar' && editando) {
    altera(editando, {
      carro: $('#ed-carro').value.trim() || null,
      servico: $('#ed-servico').value || null,
      legenda: $('#ed-legenda').value.trim() || null,
    });
  }
  editando = null;
  dialogo.returnValue = '';
});

inicia().catch((err) => {
  console.error(err);
  tela('tela-entrar');
  $('#entrar-erro').textContent = 'Não consegui conectar. Confira a internet e recarregue a página.';
});
