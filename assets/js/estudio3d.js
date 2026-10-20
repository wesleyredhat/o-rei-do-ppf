// Studio 3D: o carro no piso do studio, luzes hexagonais refletidas na pintura,
// o logo projetado no chão e a película aplicada peça por peça.
// Modelo: Car Concept (Eric Chadwick, Darmstadt Graphics Group, CC BY 4.0), preparado por ferramentas/prepara-modelo.mjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTES, PELICULAS } from './partes.js';

const VIDROS = 12;
const N_PINTURA = 12;
const FRENTE = -1;
const TRAS = -2;
const AMARELO = new THREE.Color('#ffc61a');
const DURACAO = .9; // segundos da passada do rodo

// Peças pelo nome do nó do modelo. Frente e traseira vêm inteiras e são separadas por posição.
function parteDoNo(nome) {
  if (nome === 'BodyHood') return FRENTE;
  if (nome === 'BodyRearPanelsColor1') return TRAS;
  if (nome === 'BodyHoodTopgrill') return 0;
  if (nome === 'BodyHeadlights') return 3;
  if (/^BodyDoor[LR]MirrorColor/.test(nome)) return 4;
  if (/^BodyDoor[LR](Color|Handle)/.test(nome)) return 5;
  if (nome === 'BodyRoofPanel' || nome === 'BodyPillars') return 6;
  if (/^Body(Taillights|TaillightsPanels|TurnsignalsRear)$/.test(nome)) return 10;
  if (nome === 'BodyPanelsColor2') return 11;
  if (/^Body(Windshield|Rearwindow|WindowsRearSides|Door[LR]Window)$/.test(nome)) return VIDROS;
  return null;
}
// x para a esquerda, y para cima, z para a frente (mesmas regras do shader)
function regiao(parte, p, n) {
  const ax = Math.abs(p.x);
  if (parte === FRENTE) {
    if (ax < .66 && p.y > .6 && n.y > .45) return 0;
    if ((p.z > 2.02 && ax < .98) || (p.y < .5 && p.z > 1.9 && ax < .9)) return 1;
    return 2;
  }
  if (parte === TRAS) {
    if (ax < .74 && p.y > .86 && n.y > .45) return 8;
    if ((p.z < -1.62 && p.y < .93) || (p.y < .55 && p.z < -1.35)) return 9;
    return 7;
  }
  return parte;
}
const GLSL_REGIAO = `
int regiao(vec3 p, vec3 n) {
  if (uParte >= 0) return uParte;
  float ax = abs(p.x);
  if (uParte == -1) {
    if (ax < .66 && p.y > .6 && n.y > .45) return 0;
    if ((p.z > 2.02 && ax < .98) || (p.y < .5 && p.z > 1.9 && ax < .9)) return 1;
    return 2;
  }
  if (ax < .74 && p.y > .86 && n.y > .45) return 8;
  if ((p.z < -1.62 && p.y < .93) || (p.y < .55 && p.z < -1.35)) return 9;
  return 7;
}`;

// uniforms compartilhados por todos os materiais com película
const comum = {
  uSel: { value: new Array(N_PINTURA).fill(0) },
  uFaixa: { value: Array.from({ length: N_PINTURA }, () => new THREE.Vector2(-2, 2.5)) },
  uHover: { value: -9 },
  uAmarelo: { value: AMARELO },
};

// Película no shader: a passada do rodo vai da frente para trás deixando a peça com brilho e tom amarelo.
function comPelicula(material, parte) {
  const m = material.clone();
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, comum, { uParte: { value: parte } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosM;\nvarying vec3 vNorM;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvPosM = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNorM = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPosM;
varying vec3 vNorM;
uniform float uSel[${N_PINTURA}];
uniform vec2 uFaixa[${N_PINTURA}];
uniform int uParte;
uniform int uHover;
uniform vec3 uAmarelo;
${GLSL_REGIAO}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  int k = regiao(vPosM, normalize(vNorM));
  float s = uSel[k];
  vec2 f = uFaixa[k];
  float t = clamp((f.y - vPosM.z) / max(f.y - f.x, .001), 0., 1.);
  float aplicado = s > .001 ? 1. - smoothstep(s - .02, s, t) : 0.;
  float linha = (s > .001 && s < .999) ? 1. - smoothstep(0., .035, abs(t - s)) : 0.;
  diffuseColor.rgb = mix(diffuseColor.rgb, uAmarelo, .32 * aplicado);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * .45, aplicado);
  totalEmissiveRadiance += uAmarelo * (.07 * aplicado + 2.4 * linha);
  if (k == uHover) totalEmissiveRadiance += vec3(.06, .05, .015);
}`);
  };
  m.customProgramCacheKey = () => `pelicula${parte}`;
  return m;
}

// ---------- texturas desenhadas no canvas ----------
function texturaPiso() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const lado = 256;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const x0 = i * lado;
      const y0 = j * lado;
      g.fillStyle = '#121213';
      g.fillRect(x0, y0, lado, lado);
      // relevo em losango, girado em placas alternadas como no piso do studio
      g.save();
      g.beginPath();
      g.rect(x0 + 3, y0 + 3, lado - 6, lado - 6);
      g.clip();
      g.translate(x0 + lado / 2, y0 + lado / 2);
      g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4);
      for (let k = -lado; k < lado; k += 9) {
        g.fillStyle = '#1d1d1f';
        g.fillRect(-lado, k, lado * 2, 3);
        g.fillStyle = '#0a0a0b';
        g.fillRect(-lado, k + 3, lado * 2, 1);
      }
      g.restore();
      g.strokeStyle = '#050505';
      g.lineWidth = 6;
      g.strokeRect(x0 + 1, y0 + 1, lado - 2, lado - 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaSombra() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.filter = 'blur(26px)';
  g.fillStyle = 'rgba(0,0,0,.95)';
  g.beginPath();
  g.roundRect(48, 52, 160, 408, 60);
  g.fill();
  g.filter = 'blur(10px)';
  for (const [x, y] of [[56, 120], [200, 120], [56, 380], [200, 380]]) {
    g.beginPath();
    g.ellipse(x, y, 22, 52, 0, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// Logo do projetor: coroa e nome nítidos, com um leve halo de luz em volta (gobo).
const LOGO_W = 2048;
const LOGO_H = 1360;
async function texturaLogo(urlCoroa, anisotropia) {
  try { await document.fonts.load('900 150px Nunito'); } catch { /* sem a fonte usa a do sistema */ }
  const coroa = await new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falha;
    img.src = urlCoroa;
  });
  const c = document.createElement('canvas');
  c.width = LOGO_W;
  c.height = LOGO_H;
  const g = c.getContext('2d');
  const w = 1080;
  const h = (w * coroa.height) / coroa.width;
  const topo = 90;
  const base = topo + h + 300;
  g.imageSmoothingQuality = 'high';
  g.font = '900 340px Nunito, "Arial Rounded MT Bold", sans-serif';
  g.textAlign = 'center';
  // halo: a mesma arte desfocada por baixo, como a luz que vaza do projetor
  g.save();
  g.filter = 'blur(18px)';
  g.globalAlpha = .28;
  g.drawImage(coroa, (LOGO_W - w) / 2, topo, w, h);
  g.fillStyle = '#fff3d6';
  g.fillText('Oreidoppf', LOGO_W / 2, base);
  g.restore();
  // arte nítida por cima
  g.drawImage(coroa, (LOGO_W - w) / 2, topo, w, h);
  g.fillStyle = '#f6f3ea';
  g.fillText('Oreidoppf', LOGO_W / 2, base);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // sem anisotropia o nome borra quando visto rasante no chão
  t.anisotropy = anisotropia;
  return t;
}

// poça de luz do projetor no piso, por baixo do logo
function texturaFacho() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,240,210,.5)');
  r.addColorStop(.45, 'rgba(255,236,200,.2)');
  r.addColorStop(1, 'rgba(255,236,200,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// grade de luminárias hexagonais (tubos) como nos studios de estética automotiva
// plano = faixas viradas para baixo (de cima não aparecem); sem plano = tubos, para o reflexo
function gradeHex({ raio = .62, colunas = 9, linhas = 7, espessura = .05, plano = false } = {}) {
  const pecas = [];
  const largura = Math.sqrt(3) * raio;
  for (let l = 0; l < linhas; l++) {
    for (let c = 0; c < colunas; c++) {
      const cx = (c - (colunas - 1) / 2) * largura + (l % 2) * (largura / 2);
      const cz = (l - (linhas - 1) / 2) * 1.5 * raio;
      for (let i = 0; i < 6; i++) {
        const a1 = Math.PI / 6 + (i * Math.PI) / 3;
        const a2 = a1 + Math.PI / 3;
        const x1 = cx + raio * .92 * Math.cos(a1);
        const z1 = cz + raio * .92 * Math.sin(a1);
        const x2 = cx + raio * .92 * Math.cos(a2);
        const z2 = cz + raio * .92 * Math.sin(a2);
        const comprimento = Math.hypot(x2 - x1, z2 - z1) * .9;
        const geo = plano ? new THREE.PlaneGeometry(comprimento, espessura).rotateX(Math.PI / 2) : new THREE.BoxGeometry(comprimento, espessura, espessura);
        geo.rotateY(-Math.atan2(z2 - z1, x2 - x1));
        geo.translate((x1 + x2) / 2, 0, (z1 + z2) / 2);
        pecas.push(geo);
      }
    }
  }
  return mergeGeometries(pecas);
}

function ambienteStudio(renderer) {
  const sala = new THREE.Scene();
  sala.background = new THREE.Color('#030303');
  const luz = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(9) });
  const hex = new THREE.Mesh(gradeHex({ espessura: .16 }), luz);
  hex.position.y = 3.6;
  sala.add(hex);
  // softboxes compridos dos lados e um atrás
  for (const [x, z, ry] of [[-5, 0, Math.PI / 2], [5, 0, -Math.PI / 2], [0, -6, 0]]) {
    const caixa = new THREE.Mesh(new THREE.PlaneGeometry(7, .5), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.2), side: THREE.DoubleSide }));
    caixa.position.set(x, 1.6, z);
    caixa.rotation.y = ry;
    sala.add(caixa);
  }
  // painel difuso grande no teto: dá corpo à pintura sem apagar o desenho dos hexágonos
  const painel = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(.32), side: THREE.DoubleSide }));
  painel.rotation.x = Math.PI / 2;
  painel.position.y = 4.2;
  sala.add(painel);
  // piso escuro para o reflexo de baixo não clarear a lataria
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: '#0b0b0b' }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -.4;
  sala.add(chao);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sala, .015).texture;
  pmrem.dispose();
  return env;
}

// ---------- cena ----------
// deslocaX: quantos px o carro anda para a esquerda (no computador o painel cobre a direita do palco)
export async function montaStudio(palco, { urlModelo, urlCoroa, aoProgresso, aoClicar, aoPassar, deslocaX, foto = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: foto, powerPreference: 'high-performance' });
  renderer.setPixelRatio(foto ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  palco.prepend(renderer.domElement);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#060607');
  cena.fog = new THREE.Fog('#060607', 10, 24);
  // o envMapIntensity só vale com o envMap no próprio material, então o ambiente vai em cada um
  const ambiente = ambienteStudio(renderer);
  cena.environment = ambiente;

  const camera = new THREE.PerspectiveCamera(32, 1, .1, 80);
  camera.position.set(5.2, 1.7, 5.6);

  // piso de placas
  const tPiso = texturaPiso();
  tPiso.repeat.set(30, 30);
  tPiso.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: tPiso, roughness: .7, metalness: 0, envMap: ambiente, envMapIntensity: .32 }));
  piso.rotation.x = -Math.PI / 2;
  cena.add(piso);

  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 5.3), new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.set(0, .004, .24);
  cena.add(sombra);

  // logo projetado no chão, como o projetor do studio
  const anisotropia = renderer.capabilities.getMaxAnisotropy();
  const facho = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3),
    new THREE.MeshBasicMaterial({ map: texturaFacho(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 }),
  );
  facho.rotation.x = -Math.PI / 2;
  facho.position.y = .004;
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 2.7 * LOGO_H / LOGO_W),
    new THREE.MeshBasicMaterial({ map: await texturaLogo(urlCoroa, anisotropia), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  logo.rotation.x = -Math.PI / 2;
  logo.position.y = .006;
  // o grupo gira em torno do eixo vertical para o logo ficar de frente para quem olha
  const projecao = new THREE.Group().add(facho, logo);
  cena.add(projecao);
  function posicionaLogo({ x = 0, z = 3.5, giro = 0 } = {}) {
    projecao.position.set(x, 0, z);
    projecao.rotation.y = giro;
  }
  posicionaLogo();

  // luminárias no teto (aparecem quando a câmera olha para cima)
  const teto = new THREE.Mesh(gradeHex({ colunas: 13, linhas: 9, espessura: .07, plano: true }), new THREE.MeshBasicMaterial({ color: '#e8e8e8' }));
  teto.position.y = 5;
  cena.add(teto);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.target.set(0, .55, .2);
  controles.enablePan = false;
  controles.enableDamping = true;
  controles.dampingFactor = .07;
  controles.minDistance = 4.6;
  controles.maxDistance = 10;
  controles.minPolarAngle = .5;
  controles.maxPolarAngle = 1.48;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  controles.autoRotate = !foto && !reduzido;
  // no modo foto a câmera vai aonde a cena pedir
  if (foto) {
    controles.maxDistance = 40;
    controles.minPolarAngle = 0;
    controles.maxPolarAngle = Math.PI / 2;
  }
  controles.autoRotateSpeed = .55;
  controles.update();
  // no celular o arraste vertical continua rolando a página
  renderer.domElement.style.touchAction = 'pan-y';

  // ---------- carro ----------
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((ok, falha) => loader.load(urlModelo, ok, (e) => e.total && aoProgresso?.(e.loaded / e.total), falha));
  const carro = gltf.scene;
  cena.add(carro);

  const pintura = new THREE.MeshPhysicalMaterial({ color: '#22242a', metalness: .2, roughness: .32, clearcoat: 1, clearcoatRoughness: .03, envMap: ambiente, envMapIntensity: 1.25 });
  const detalhe = new THREE.MeshPhysicalMaterial({ color: '#0b0b0c', metalness: .1, roughness: .28, clearcoat: 1, clearcoatRoughness: .05, envMap: ambiente });
  const vidro = new THREE.MeshPhysicalMaterial({ color: '#05070a', metalness: 0, roughness: .04, transparent: true, opacity: PELICULAS[4].opacidade, envMap: ambiente, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const parabrisa = vidro.clone();
  parabrisa.opacity = .3;
  const clicaveis = [];
  const faixas = Array.from({ length: N_PINTURA }, () => new THREE.Box3());
  const materiaisPintura = new Map();

  carro.updateMatrixWorld(true);
  carro.traverse((o) => {
    if (!o.isMesh) return;
    // peças com mais de um material chegam como BodyHood_1, BodyHood_2...
    const nome = (o.name || o.parent?.name || '').replace(/_\d+$/, '');
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat.name === 'Brake') mat.color.set('#ffc61a');
    const parte = parteDoNo(nome);
    if (parte === null) return;
    if (parte === VIDROS) {
      o.material = nome === 'BodyWindshield' ? parabrisa : vidro;
      o.renderOrder = 2;
      o.userData.parte = VIDROS;
      clicaveis.push(o);
      return;
    }
    const ehPintura = /Paint/.test(mat.name);
    const base = ehPintura ? (/Color2|Paint 2/.test(nome + mat.name) ? detalhe : pintura) : mat;
    const chave = `${base.uuid}:${parte}`;
    if (!materiaisPintura.has(chave)) {
      const m = comPelicula(base, parte);
      if (base === pintura) m.userData.base = 'pintura';
      materiaisPintura.set(chave, m);
    }
    o.material = materiaisPintura.get(chave);
    o.userData.parte = parte;
    clicaveis.push(o);
    const caixa = new THREE.Box3().setFromObject(o);
    if (parte >= 0) faixas[parte].union(caixa);
  });
  // faixas (em z) das peças que saem da frente e da traseira
  const faixasFixas = { 0: [1.17, 2.42], 1: [1.85, 2.42], 2: [1.17, 2.3], 7: [-1.8, -.43], 8: [-1.94, -.43], 9: [-1.94, -1.3] };
  comum.uFaixa.value.forEach((v, i) => {
    if (faixasFixas[i]) v.set(...faixasFixas[i]);
    else if (!faixas[i].isEmpty()) v.set(faixas[i].min.z, faixas[i].max.z);
  });

  // ---------- animação das peças ----------
  const alvo = new Array(PARTES.length).fill(0);
  const progresso = new Array(N_PINTURA).fill(0);
  const suave = (x) => x * x * (3 - 2 * x);
  let pelicula = 4;

  function aplicaVidro() {
    vidro.opacity = alvo[VIDROS] ? PELICULAS[pelicula].opacidade : PELICULAS[4].opacidade;
  }

  // ---------- câmera indo até a peça ----------
  let voo = null;
  let parado = 0;
  function olhaPara(parte) {
    const caixa = faixas[parte] && !faixas[parte].isEmpty() ? faixas[parte] : null;
    const faixa = comum.uFaixa.value[parte];
    const z = caixa ? (caixa.min.z + caixa.max.z) / 2 : faixa ? (faixa.x + faixa.y) / 2 : 0;
    const azimute = z > .9 ? .75 : z < -.6 ? 2.45 : 1.45;
    const atual = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controles.target));
    let delta = azimute - atual.theta;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    voo = { de: atual.theta, ate: atual.theta + delta, raio: Math.max(atual.radius, 8.4), phi: Math.min(atual.phi, 1.25), t: 0 };
    parado = 6;
  }

  // ---------- clique e passagem do mouse ----------
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  const normal = new THREE.Vector3();
  function pecaEm(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const hit = raio.intersectObjects(clicaveis, false)[0];
    if (!hit) return -1;
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    return regiao(hit.object.userData.parte, hit.point, normal);
  }
  let inicio = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    inicio = { x: e.clientX, y: e.clientY, t: performance.now() };
    parado = 6;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const moveu = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    const rapido = performance.now() - inicio.t < 500;
    inicio = null;
    if (moveu > 6 || !rapido) return;
    const k = pecaEm(e);
    if (k >= 0) aoClicar?.(PARTES[k].id);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const k = pecaEm(e);
    comum.uHover.value = k >= 0 && k < N_PINTURA ? k : -9;
    renderer.domElement.style.cursor = k >= 0 ? 'pointer' : 'grab';
    aoPassar?.(k >= 0 ? { id: PARTES[k].id, nome: PARTES[k].nome, x: e.clientX, y: e.clientY } : null);
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    comum.uHover.value = -9;
    aoPassar?.(null);
  });

  // ---------- tamanho e laço ----------
  function dimensiona() {
    const w = palco.clientWidth;
    const h = palco.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // em tela estreita a câmera recua para o carro caber
    camera.fov = w / h < .9 ? 46 : 32;
    // no computador o carro anda para o lado do painel; em pé (celular) sobe um pouco e o teto some
    const retrato = w / h < .9;
    const dx = deslocaX?.() || 0;
    const dy = retrato && !foto ? h * .1 : 0;
    if (dx || dy) camera.setViewOffset(w, h, dx, dy, w, h);
    else camera.clearViewOffset();
    if (!foto) teto.visible = !retrato;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(dimensiona).observe(palco);
  dimensiona();

  let visivel = true;
  let ultimo = performance.now();
  function quadro(agora) {
    const dt = Math.min(.05, (agora - ultimo) / 1000);
    ultimo = agora;
    for (let k = 0; k < N_PINTURA; k++) {
      const passo = dt / DURACAO;
      progresso[k] = alvo[k] ? Math.min(1, progresso[k] + passo) : Math.max(0, progresso[k] - passo * 1.6);
      comum.uSel.value[k] = suave(progresso[k]);
    }
    if (voo) {
      voo.t = Math.min(1, voo.t + dt / .9);
      const e = suave(voo.t);
      const s = new THREE.Spherical(voo.raio, voo.phi, voo.de + (voo.ate - voo.de) * e);
      camera.position.copy(controles.target).add(new THREE.Vector3().setFromSpherical(s));
      if (voo.t >= 1) voo = null;
    }
    parado = Math.max(0, parado - dt);
    controles.autoRotate = !foto && !reduzido && parado <= 0 && !voo;
    controles.update();
    renderer.render(cena, camera);
    if (visivel) requestAnimationFrame(quadro);
  }
  new IntersectionObserver(([it]) => {
    const antes = visivel;
    visivel = it.isIntersecting;
    if (visivel && !antes) {
      ultimo = performance.now();
      requestAnimationFrame(quadro);
    }
  }).observe(palco);
  requestAnimationFrame(quadro);

  return {
    renderer,
    carro,
    camera,
    controles,
    define(ids) {
      const novos = PARTES.map((p) => (ids.has(p.id) ? 1 : 0));
      const ligadas = novos.map((v, i) => (v && !alvo[i] ? i : -1)).filter((i) => i >= 0);
      novos.forEach((v, i) => { alvo[i] = v; });
      aplicaVidro();
      if (ligadas.length === 1) olhaPara(ligadas[0]);
    },
    pelicula(indice) {
      pelicula = indice;
      aplicaVidro();
    },
    cor(hex) {
      pintura.color.set(hex);
      for (const m of materiaisPintura.values()) if (m.userData.base === 'pintura') m.color.set(hex);
    },
    pose({ azimute, polar, distancia, alvo = [0, .55, .2] }) {
      controles.target.set(...alvo);
      camera.position.copy(controles.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(distancia, polar, azimute)));
      controles.update();
    },
    logo: posicionaLogo,
    teto(visivel) { teto.visible = visivel; },
    renderiza() { renderer.render(cena, camera); },
  };
}
