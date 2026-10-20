# O Rei do PPF

Site do **O Rei do PPF** (aplicação de PPF e películas automotivas), com área do studio para publicar as fotos dos carros dos clientes.

- Site: https://wesleyredhat.github.io/o-rei-do-ppf/ (até o domínio próprio ficar pronto)
- Instagram: [@oreidoppf](https://instagram.com/oreidoppf) · Studio: [@oreidoppf.estudio](https://instagram.com/oreidoppf.estudio)
- WhatsApp: (11) 98455-1361

## O que tem

| Arquivo | Para quê |
| --- | --- |
| `index.html` | Site: topo com o carro no studio, simulador 3D (monte sua proteção e película), serviços, teste de bancada, processo, galeria, dúvidas e orçamento pelo WhatsApp |
| `admin.html` | Área do studio: entrar, subir fotos, escolher a capa, ocultar, editar e apagar |
| `assets/js/config.js` | WhatsApp, Instagram, chaves do Supabase e a lista de serviços (nome, texto, itens e preço opcional) |
| `supabase/schema.sql` | Tabelas, permissões e o bucket de fotos |
| `assets/js/estudio3d.js` + `assets/3d/carro.glb` | Studio 3D (three.js): piso, luzes hexagonais, logo projetado no chão e a película entrando peça por peça |
| `tests/e2e.py` | Testes no navegador (site, simulador 3D, bancada, painel e galeria) |
| `ferramentas/studio.html` | O studio em tela cheia; com parâmetros na URL gera as imagens do topo (`hero.jpg` e `hero-mobile.jpg`) |
| `ferramentas/prepara-modelo.mjs` | Prepara o carro 3D (tira logos, troca a pintura, comprime) |
| `ferramentas/og.html` | Arte da imagem de compartilhamento (`assets/img/og.jpg`) |

## Rodar no computador

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Ligar a galeria e a área do studio (Supabase)

1. Em [supabase.com](https://supabase.com), criar um projeto (ex.: `o-rei-do-ppf`, região South America (São Paulo)).
2. **SQL Editor**: colar o conteúdo de `supabase/schema.sql` e clicar em **Run**.
3. **Authentication > Users > Add user > Create new user**: e-mail e senha do dono, marcando **Auto Confirm User**.
4. **SQL Editor**, trocando o e-mail:
   ```sql
   insert into public.admins (user_id, nome) select id, 'Rei do PPF' from auth.users where email = 'email-do-dono@exemplo.com';
   ```
5. **Authentication > Sign In / Providers**: desligar **Allow new users to sign up**.
6. **Project Settings > API Keys**: copiar a **Project URL** e a **Publishable key** para `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `assets/js/config.js`. A publishable key é pública por natureza; quem protege os dados são as regras do `schema.sql`.

## Como o dono sobe as fotos

No rodapé do site, **Área do studio** (ou `/admin.html`) > entrar > **Escolher fotos** > preencher carro e serviço > **Publicar**.
As fotos são reduzidas no próprio celular antes de subir (2000 px e uma miniatura de 640 px).
A foto mais recente marcada com a coroa vira a capa do topo do site.
Dica: no celular, "Adicionar à tela de início" deixa o painel com cara de app.

## Publicar (GitHub Pages)

**Settings > Pages > Build and deployment > Deploy from a branch > `main` / `(root)`**.
Cada push na `main` atualiza o site em cerca de 1 minuto.

## Domínio próprio

1. Registrar no [registro.br](https://registro.br) (ex.: `oreidoppf.com.br`).
2. No DNS do registro.br: quatro registros **A** para `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`, e um **CNAME** `www` para `wesleyredhat.github.io`.
3. Criar o arquivo `CNAME` na raiz com o domínio e, em **Settings > Pages**, marcar **Enforce HTTPS**.
4. Trocar `og:url` e `og:image` no `index.html` para o domínio novo.

## Testes

```bash
pip install playwright pillow && playwright install chromium
python3 tests/e2e.py
```

O Supabase é trocado por um falso em memória (`tests/fake-supabase.js`), então os testes não mexem em dados reais.

## Carro 3D

Modelo [Car Concept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), de Eric Chadwick (Darmstadt Graphics Group), licença **CC BY 4.0**: pode usar comercialmente, desde que o crédito continue no rodapé do site.
Para refazer o `assets/3d/carro.glb` a partir do original:

```bash
npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
node ferramentas/prepara-modelo.mjs CarConcept.glb assets/3d/carro.glb
```

As imagens do topo saem do próprio studio, por exemplo:
`ferramentas/studio.html?foto=1&az=0.85&polar=1.33&dist=8.8&alvo=-0.8,0.5,2.25&logo=1.55,2.75,0.85` (computador, 1920x1080) e
`ferramentas/studio.html?foto=1&az=0.85&polar=1.37&dist=13&alvo=0,1.15,0.2&logo=2.05,2.05,0.85&teto=0` (celular, 1080x1920).

