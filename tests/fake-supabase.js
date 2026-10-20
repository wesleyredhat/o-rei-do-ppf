// Supabase falso para o teste: guarda tudo na memória da página.
const fotos = [];
window.__uploads = [];
window.__removidos = [];
let sessao = null;
const SENHA = 'certa';
function consulta(tabela) {
  const st = { op: 'select', dados: null, filtros: [] };
  const exec = () => {
    if (tabela !== 'fotos') return { data: null, error: { message: 'tabela' } };
    if (!sessao) return { data: null, error: { message: 'sem sessão' } };
    if (st.op === 'insert') {
      const linha = { id: crypto.randomUUID(), publicado: true, destaque: false, created_at: new Date(Date.now() + fotos.length).toISOString(), ...st.dados };
      fotos.push(linha);
      return { data: null, error: null };
    }
    const alvo = fotos.filter((f) => st.filtros.every(([c, v]) => f[c] === v));
    if (st.op === 'update') { alvo.forEach((f) => Object.assign(f, st.dados)); return { data: null, error: null }; }
    if (st.op === 'delete') { alvo.forEach((f) => fotos.splice(fotos.indexOf(f), 1)); return { data: null, error: null }; }
    return { data: JSON.parse(JSON.stringify([...alvo].sort((a, b) => b.created_at.localeCompare(a.created_at)))), error: null };
  };
  const api = {
    select() { return api; }, order() { return api; },
    eq(c, v) { st.filtros.push([c, v]); return api; },
    insert(d) { st.op = 'insert'; st.dados = d; return api; },
    update(d) { st.op = 'update'; st.dados = d; return api; },
    delete() { st.op = 'delete'; return api; },
    then(ok, falha) { return Promise.resolve(exec()).then(ok, falha); },
  };
  return api;
}
export function createClient() {
  return {
    auth: {
      async getSession() { return { data: { session: sessao } }; },
      async signInWithPassword({ email, password }) {
        if (password !== SENHA) return { data: {}, error: { message: 'Invalid login credentials' } };
        sessao = { user: { email } };
        return { data: { session: sessao }, error: null };
      },
      async signOut() { sessao = null; return { error: null }; },
    },
    rpc: async (nome) => ({ data: nome === 'is_admin' && !!sessao && sessao.user.email === 'dono@teste.com', error: null }),
    from: consulta,
    storage: {
      from: () => ({
        async upload(caminho, blob, opcoes) {
          const bmp = await createImageBitmap(blob);
          window.__uploads.push({ caminho, tipo: opcoes.contentType, bytes: blob.size, w: bmp.width, h: bmp.height });
          return { data: { path: caminho }, error: null };
        },
        async remove(lista) { window.__removidos.push(...lista); return { data: lista, error: null }; },
      }),
    },
  };
}
