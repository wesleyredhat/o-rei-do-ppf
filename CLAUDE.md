# O Rei do PPF: contexto para a IA

Site estático (GitHub Pages) + Supabase (galeria e login do dono). Sem build, sem framework: HTML, CSS e JS em módulos.
Repositório: https://github.com/wesleyredhat/o-rei-do-ppf · Site: https://wesleyredhat.github.io/o-rei-do-ppf/

## Como trabalhar com o usuário

- Responder sempre em **português (pt-BR)**.
- Nunca usar travessão "—" nem meia-risca "–" em nenhum texto (site, painel, docs, comentários). Usar vírgula, ponto, dois-pontos ou parênteses.
- Não inventar fatos do negócio: depoimentos, números, anos de experiência, marcas de filme, garantia, endereço, horário, preços. O que não foi informado fica genérico ("informado no orçamento").
- Sobre película, citar o Contran de forma genérica; não colocar percentuais da lei.
- O usuário pede coisas curtas e às vezes no meio do trabalho; ele gosta de ser surpreendido com ideias, mas o que ele pede explicitamente vale.

## O negócio (dados reais)

- Nome: O Rei do PPF | Aplicações de PPF. WhatsApp 5511984551361. Instagram @oreidoppf (verificado), estúdio @oreidoppf.estudio.
- Bio: "PPF de alto padrão para quem exige excelência" / "Qualidade, precisão e acabamento impecável" / "Atendimento via WhatsApp".
- Logo: coroa dourada geométrica. `assets/img/logo.png` foi recortado do print enviado pelo usuário (fundo preto removido por "unscreen"); derivados: `logo-160.png`, `logo-320.png`, `favicon.png`, `apple-touch-icon.png`.
- O usuário também mandou um logo de **águia** (círculo branco, preto, vermelho e azul-marinho). Papel desconhecido (parceiro? marca antiga?): perguntar antes de usar.

## Decisões de design

- Tema automobilismo + alto padrão. Paleta pedida pelo usuário em 20/10/2026: **preto, cinza cimento e destaques em amarelo** (`--amarelo #ffc61a`). O logo continua dourado (é a marca).
- Seções alternam preto e cimento (`.secao--cimento` troca os tokens `--texto`, `--suave`, `--linha`, `--acento`; cartões escuros dentro do cimento voltam aos tokens claros).
- Fontes: Big Shoulders Display (títulos), Archivo (texto), Chivo Mono (etiquetas).
- Elementos: etiqueta amarela de box (`.kicker`), fita amarela inclinada com os serviços, grid de largada P1 a P6, carro lateral com o "rodo" aplicando o filme, carro visto de cima clicável (Monte sua proteção), simulador G5 a G70, pit stop em 5 etapas, **teste de bancada** (`assets/js/bancada.js`: canvas com capô metade sem PPF e metade com PPF; risco e pedrisco ficam de um lado e somem/quicam do outro; tem demonstração automática).
- Orçamento não guarda nada: monta a mensagem e abre o WhatsApp.
- Bot de WhatsApp: o usuário disse que **não precisa agora**.

## Arquitetura

- `assets/js/config.js`: dados do negócio, chaves do Supabase e `SERVICOS` (fonte única para o grid, o formulário, o painel e os filtros da galeria).
- `assets/js/main.js`: site. A galeria lê `fotos` pelo REST do Supabase só com o header `apikey` (sem supabase-js no site).
- `assets/js/admin.js` + `admin.html`: painel com supabase-js via CDN (`@supabase/supabase-js@2/+esm`). Fotos reduzidas no navegador (2000 px e miniatura 640 px, JPEG), salvas em `fotos/AAAA/MM/<uuid>.jpg` e `-p.jpg`.
- `supabase/schema.sql`: idempotente. Tabelas `admins` e `fotos`, função `is_admin()`, RLS (público vê só `publicado`), bucket público `fotos` com escrita só de admin.

## Testar antes de entregar

- `python3 tests/e2e.py`: sobe um servidor local e testa site (390 px e 1440 px, sem rolagem lateral), teste de bancada, painel completo e galeria com Supabase falso. Precisa de `playwright` e `pillow`.
- SQL: Postgres 16 do Homebrew (`/opt/homebrew/opt/postgresql@16`). Montar um stub do Supabase (roles `anon`/`authenticated`, `auth.users`, `auth.uid()` lendo `request.jwt.claim.sub`, `storage.buckets` e `storage.objects` com RLS), rodar o `schema.sql` duas vezes e testar como anon, logado comum e admin. No scratchpad o caminho é longo demais para socket Unix: subir com `-c unix_socket_directories=''` e conectar por `-h 127.0.0.1`.
- Conferir também com screenshots no celular e no computador.

## Pendências (atualizar esta lista ao concluir)

- [ ] **GitHub Pages**: ativar em Settings > Pages (main / root). O `gh` não está instalado neste Mac; o push funciona pelo git com HTTPS.
- [ ] **Supabase**: o usuário precisa criar o projeto; depois preencher `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `config.js`, rodar o `schema.sql`, criar o usuário do dono e inserir em `admins` (passo a passo no README).
- [ ] **Domínio**: contratar (sugestão `oreidoppf.com.br`, estava livre no whois em 20/10/2026), configurar DNS, criar `CNAME`, trocar `og:url`/`og:image`.
- [ ] Fotos reais dos carros (o dono sobe pelo painel) e, se quiser, uma foto de capa marcada com a coroa.
- [ ] Perguntar: papel do logo da águia; endereço e horário do estúdio (hoje o site não mostra); se quer preços "a partir de" nos serviços (`preco` no `SERVICOS`).
- [ ] Ideias para depois: página/arquivo de manifest para o painel virar app no celular; Google Meu Negócio; depoimentos reais (só com textos enviados pelo dono).
