// Dados do negócio. Tudo que aparece no site e muda com o tempo fica aqui.
export const CONFIG = {
  NOME: 'O Rei do PPF',
  WHATSAPP: '5511984551361', // DDI + DDD + número, só dígitos
  INSTAGRAM: 'oreidoppf',
  INSTAGRAM_ESTUDIO: 'oreidoppf.estudio',

  // Supabase do Rei do PPF (galeria e área administrativa).
  // Sem os dois campos a galeria mostra só os espaços vazios e o painel avisa que falta ligar.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  BUCKET: 'fotos',
};

// Serviços: aparecem no grid de largada, no formulário de orçamento, no painel e nos filtros da galeria.
// preco é opcional: preencha com o texto que quiser mostrar (ex.: 'a partir de R$ 1.500').
export const SERVICOS = [
  {
    id: 'ppf-full',
    nome: 'PPF Full Body',
    texto: 'O carro inteiro coberto por filme de poliuretano transparente. Riscos, pedriscos, chuva ácida e sujeira ficam no filme, não na pintura.',
    itens: ['Brilhante ou fosco', 'Bordas acabadas à mão', 'Pintura original preservada'],
    preco: '',
  },
  {
    id: 'ppf-frontal',
    nome: 'PPF Frontal',
    texto: 'Para-choque, capô, para-lamas e retrovisores: a linha de frente que leva o impacto da estrada.',
    itens: ['Feito para estrada', 'Contra pedriscos', 'Ótimo custo-benefício'],
    preco: '',
  },
  {
    id: 'ppf-farois',
    nome: 'PPF de Faróis e Lanternas',
    texto: 'Lentes protegidas contra amarelamento, riscos e trincas de pedra, sem mudar o visual.',
    itens: ['Contra amarelamento', 'Resistente a impacto', 'Transparente ou fumê'],
    preco: '',
  },
  {
    id: 'nano-ceramica',
    nome: 'Película Nano Cerâmica',
    texto: 'Bloqueia o calor e os raios UV sem precisar escurecer demais. Conforto térmico de verdade dentro do carro.',
    itens: ['Alta rejeição de calor', 'Proteção UV', 'Sem metal: não interfere no sinal'],
    preco: '',
  },
  {
    id: 'pelicula',
    nome: 'Película Automotiva',
    texto: 'Do G5 ao G70: privacidade, conforto e visual, com orientação para cada vidro ficar dentro da lei.',
    itens: ['G5, G20, G35, G50 e G70', 'Laterais e traseiro', 'Aplicação sem bolhas'],
    preco: '',
  },
  {
    id: 'ppf-interno',
    nome: 'PPF Interno',
    texto: 'Piano black, telas e soleiras protegidos contra os riscos do dia a dia.',
    itens: ['Central multimídia', 'Console piano black', 'Soleiras de porta'],
    preco: '',
  },
];

export function waLink(texto) {
  return `https://wa.me/${CONFIG.WHATSAPP}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

export function supabaseLigado() {
  return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
}

export function fotoUrl(path) {
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${CONFIG.BUCKET}/${path}`;
}
