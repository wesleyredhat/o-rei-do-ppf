// Peças do simulador e níveis de película. Usado pela página e pelo studio 3D.
// A ordem importa: o índice é o mesmo usado no shader (assets/js/estudio3d.js).
export const PARTES = [
  { id: 'capo', nome: 'Capô' },
  { id: 'parachoque-d', nome: 'Para-choque dianteiro' },
  { id: 'paralamas-d', nome: 'Para-lamas dianteiros' },
  { id: 'farois', nome: 'Faróis' },
  { id: 'retrovisores', nome: 'Retrovisores' },
  { id: 'portas', nome: 'Portas' },
  { id: 'teto', nome: 'Teto e colunas' },
  { id: 'laterais-t', nome: 'Laterais traseiras' },
  { id: 'tampa', nome: 'Tampa traseira' },
  { id: 'parachoque-t', nome: 'Para-choque traseiro' },
  { id: 'lanternas', nome: 'Lanternas' },
  { id: 'saias', nome: 'Saias e spoilers' },
  { id: 'vidros', nome: 'Vidros (película)' },
];

export const PACOTES = {
  frontal: ['capo', 'parachoque-d', 'paralamas-d', 'farois', 'retrovisores'],
  full: PARTES.map((p) => p.id).filter((id) => id !== 'vidros'),
  farois: ['farois', 'lanternas'],
};

// opacidade: quanto o vidro do carro 3D escurece
export const PELICULAS = [
  { g: 5, opacidade: .94, desc: 'Máxima privacidade. De fora, quase não se vê o interior.' },
  { g: 20, opacidade: .84, desc: 'Bem escura. Privacidade alta e visual esportivo.' },
  { g: 35, opacidade: .7, desc: 'Equilíbrio entre privacidade e visibilidade.' },
  { g: 50, opacidade: .55, desc: 'Leve. Corta o brilho do sol sem escurecer muito.' },
  { g: 70, opacidade: .36, desc: 'Quase transparente. Conforto térmico sem mudar o visual.' },
];
