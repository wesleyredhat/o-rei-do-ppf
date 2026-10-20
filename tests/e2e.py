"""Testes no navegador (Playwright): site, simulador 3D, teste de bancada, painel e galeria.

O Supabase é trocado por um falso em memória (tests/fake-supabase.js), então roda sem internet de banco.
Uso: python3 tests/e2e.py   (precisa de: pip install playwright pillow && playwright install chromium)
"""
import asyncio
import json
import re
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.async_api import async_playwright

RAIZ = Path(__file__).resolve().parent.parent
FAKE = 'https://fake.supabase.co'
falhas = []


def ok(cond, msg):
    print(('OK    ' if cond else 'FALHA ') + msg)
    if not cond:
        falhas.append(msg)


def porta_livre():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def fotos_de_teste(pasta):
    caminhos = []
    for i, (w, h) in enumerate([(4032, 3024), (3024, 4032), (1200, 900)]):
        im = Image.new('RGB', (w, h), (40, 38, 36))
        d = ImageDraw.Draw(im)
        d.ellipse([w * .15, h * .45, w * .85, h * .75], fill=(200 - i * 40, 160, 60))
        caminho = Path(pasta) / f'carro{i + 1}.jpg'
        im.save(caminho, quality=85)
        caminhos.append(str(caminho))
    return caminhos


async def liga_fake(ctx):
    cfg = (RAIZ / 'assets/js/config.js').read_text()
    cfg_fake = re.sub(r"SUPABASE_URL: '[^']*'", f"SUPABASE_URL: '{FAKE}'", cfg)
    cfg_fake = re.sub(r"SUPABASE_ANON_KEY: '[^']*'", "SUPABASE_ANON_KEY: 'sb_publishable_teste'", cfg_fake)
    fake_js = (RAIZ / 'tests/fake-supabase.js').read_text()
    foto = Image.new('RGB', (800, 1000), (90, 90, 90))
    arq = Path(tempfile.mkdtemp()) / 'f.jpg'
    foto.save(arq)
    await ctx.route('**/assets/js/config.js', lambda r: r.fulfill(body=cfg_fake, content_type='text/javascript'))
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', lambda r: r.fulfill(body=fake_js, content_type='text/javascript', headers={'Access-Control-Allow-Origin': '*'}))
    await ctx.route(f'{FAKE}/storage/**', lambda r: r.fulfill(body=arq.read_bytes(), content_type='image/jpeg'))


TELAS = [('desk', {'width': 1440, 'height': 900}, False), ('mob', {'width': 390, 'height': 844}, True)]


async def site(b, base):
    for nome, vp, mob in TELAS:
        ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
        pg = await ctx.new_page()
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        await pg.goto(base, wait_until='networkidle')
        largura = await pg.evaluate('document.documentElement.scrollWidth')
        ok(largura == vp['width'], f'{nome}: sem rolagem lateral ({largura}px)')
        ok(await pg.locator('#lista-servicos > li').count() == 6, f'{nome}: 6 serviços no grid')
        ok(await pg.locator('#galeria-lista .vaga').count() == 6, f'{nome}: sem banco a galeria mostra as vagas')

        # monte sua proteção + orçamento
        await pg.click('[data-pacote=frontal]')
        ok(await pg.text_content('#monte-total') == '5', f'{nome}: pacote frontal marca 5 partes')
        await pg.click('#monte-enviar')
        ok(await pg.input_value('#f-servico') == 'ppf-frontal', f'{nome}: orçamento já vem com PPF Frontal')
        await pg.fill('#f-nome', 'Teste')
        await pg.fill('#f-carro', 'Civic 2020')
        await pg.evaluate("window.__abriu = null; window.open = (u) => { window.__abriu = u; return {}; }")
        await pg.click('#form-orcamento button[type=submit]')
        url = await pg.evaluate('window.__abriu')
        ok(url and url.startswith('https://wa.me/5511984551361?text=') and 'Para-choque' in __import__('urllib.parse').parse.unquote(url), f'{nome}: orçamento abre o WhatsApp com as partes')

        # película
        await pg.evaluate("const f = document.querySelector('#sim-faixa'); f.value = 0; f.dispatchEvent(new Event('input'))")
        ok(await pg.text_content('#sim-g') == 'G5', f'{nome}: película vai para G5')
        ok(await pg.get_attribute('[data-peca=vidros]', 'aria-pressed') == 'true', f'{nome}: mexer na película marca os vidros')
        ok(not erros, f'{nome}: sem erros na página {erros}')
        await ctx.close()


async def studio3d(b, base):
    for nome, vp, mob in TELAS:
        ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
        pg = await ctx.new_page()
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        await pg.goto(base + '#simulador')
        await pg.wait_for_selector('#studio-palco.pronto', timeout=120000)
        ok(True, f'{nome}: carro 3D carregou')
        await pg.click('[data-pacote=full]')
        ok(await pg.text_content('#monte-total') == '12', f'{nome}: full body marca 12 peças')
        await pg.click('[data-pacote=limpar]')
        await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#studio-palco').scrollIntoView({block: 'center'})")
        await pg.wait_for_timeout(400)
        caixa = await pg.locator('#studio-palco canvas').bounding_box()
        marcou = False
        for fy in (.5, .58, .44):
            for fx in (.35, .45, .55, .3):
                x, y = caixa['x'] + caixa['width'] * fx, caixa['y'] + caixa['height'] * fy
                await (pg.touchscreen.tap(x, y) if mob else pg.mouse.click(x, y))
                await pg.wait_for_timeout(250)
                if await pg.text_content('#monte-total') != '0':
                    marcou = True
                    break
            if marcou:
                break
        ok(marcou, f'{nome}: tocar no carro marca a peça')
        ok(not erros, f'{nome}: 3D sem erros {erros}')
        await ctx.close()


async def bancada(b, base):
    for nome, vp, mob in TELAS:
        ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
        pg = await ctx.new_page()
        await pg.goto(base, wait_until='networkidle')
        await pg.evaluate("document.querySelector('#bancada-tela').scrollIntoView({block: 'center'})")
        await pg.wait_for_function("document.querySelector('#placar-sem').textContent === '2'", timeout=6000)
        ok(True, f'{nome}: demonstração deixa marcas sem PPF')
        await pg.wait_for_function("document.querySelector('#placar-com').textContent === '0'", timeout=4000)
        ok(True, f'{nome}: demonstração: filme se regenera')
        await pg.click('#bancada-limpar')
        caixa = await pg.locator('#bancada-tela').bounding_box()
        x0, y0, w, h = caixa['x'], caixa['y'], caixa['width'], caixa['height']
        await pg.mouse.move(x0 + w * .15, y0 + h * .4)
        await pg.mouse.down()
        for i in range(1, 31):
            await pg.mouse.move(x0 + w * (.15 + .7 * i / 30), y0 + h * (.4 + .25 * (i % 2)))
        ok(await pg.text_content('#placar-com') == '1', f'{nome}: risco marca o filme na hora')
        await pg.mouse.up()
        ok(await pg.text_content('#placar-sem') == '1', f'{nome}: risco fica na pintura sem PPF')
        await pg.wait_for_timeout(2400)
        ok(await pg.text_content('#placar-com') == '0', f'{nome}: risco no filme some com o calor')
        await pg.mouse.click(x0 + w * .3, y0 + h * .7)
        await pg.mouse.click(x0 + w * .7, y0 + h * .7)
        ok(await pg.text_content('#placar-sem') == '2', f'{nome}: pedrisco lasca a pintura sem PPF')
        ok(await pg.text_content('#placar-com') == '0', f'{nome}: pedrisco não marca o PPF')
        await ctx.close()


async def painel(b, base, fotos):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = await ctx.new_page()
    await pg.goto(base + 'admin.html', wait_until='networkidle')
    ok(await pg.is_visible('#tela-sem-banco'), 'painel sem config avisa que falta o banco')
    await ctx.close()

    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    await liga_fake(ctx)
    pg = await ctx.new_page()
    erros = []
    pg.on('pageerror', lambda e: erros.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(base + 'admin.html', wait_until='networkidle')
    ok(await pg.is_visible('#tela-entrar'), 'painel abre na tela de entrar')
    await pg.fill('#e-email', 'dono@teste.com')
    await pg.fill('#e-senha', 'errada')
    await pg.click('#form-entrar button[type=submit]')
    await pg.wait_for_function("document.querySelector('#entrar-erro').textContent.length > 0")
    ok('incorretos' in await pg.text_content('#entrar-erro'), 'senha errada avisa')
    await pg.fill('#e-email', 'outro@teste.com')
    await pg.fill('#e-senha', 'certa')
    await pg.click('#form-entrar button[type=submit]')
    await pg.wait_for_function("document.querySelector('#entrar-erro').textContent.includes('acesso')")
    ok(True, 'quem não é admin fica de fora')
    await pg.fill('#e-email', 'dono@teste.com')
    await pg.fill('#e-senha', 'certa')
    await pg.click('#form-entrar button[type=submit]')
    await pg.wait_for_selector('#tela-painel:not([hidden])')
    ok(True, 'dono entra no painel')

    await pg.set_input_files('#arquivos', fotos[:2])
    ok((await pg.text_content('#s-enviar')).strip() == 'Publicar 2 fotos', 'duas fotos escolhidas')
    await pg.fill('#s-carro', 'Porsche 911 Carrera')
    await pg.select_option('#s-servico', 'ppf-full')
    await pg.check('#s-destaque')
    await pg.click('#s-enviar')
    await pg.wait_for_function("document.querySelectorAll('#adm-fotos .adm-foto').length === 2", timeout=20000)
    ups = await pg.evaluate('window.__uploads')
    ok(len(ups) == 4, '4 arquivos no storage (2 grandes e 2 miniaturas)')
    ok(all(max(u['w'], u['h']) == 2000 for u in ups if not u['caminho'].endswith('-p.jpg')), 'foto grande reduzida para 2000 px')
    ok(all(max(u['w'], u['h']) == 640 for u in ups if u['caminho'].endswith('-p.jpg')), 'miniatura com 640 px')
    ok(all(re.match(r'^\d{4}/\d{2}/[0-9a-f-]{36}(-p)?\.jpg$', u['caminho']) for u in ups), 'caminhos ano/mês/uuid.jpg')
    print('      tamanhos:', json.dumps([(u['w'], u['h'], u['bytes']) for u in ups]))
    ok(await pg.locator('.adm-foto__selo:not(.adm-foto__selo--oculta)').count() == 1, 'só a primeira vira capa')

    await pg.locator('#adm-fotos .adm-foto').nth(1).locator('[data-acao=publicado]').click()
    await pg.wait_for_function("document.querySelectorAll('.adm-foto.oculta').length === 1")
    ok('1 oculta' in await pg.text_content('#contador'), 'ocultar foto')
    await pg.locator('#adm-fotos .adm-foto').nth(0).locator('[data-acao=editar]').click()
    await pg.fill('#ed-carro', 'Porsche 911 GT3')
    await pg.click('#form-editar button[value=salvar]')
    await pg.wait_for_function("document.querySelector('#adm-fotos').textContent.includes('GT3')")
    ok(True, 'editar foto')
    await pg.locator('#adm-fotos .adm-foto').nth(0).locator('[data-acao=apagar]').click()
    await pg.wait_for_function("document.querySelectorAll('#adm-fotos .adm-foto').length === 1")
    ok(len(await pg.evaluate('window.__removidos')) == 2, 'apagar tira a foto e a miniatura do storage')
    ok(not erros, f'painel sem erros {erros}')
    await ctx.close()


async def galeria(b, base):
    linhas = [
        {'id': f'id{i}', 'path': f'2026/10/a{i}.jpg', 'thumb': f'2026/10/a{i}-p.jpg', 'carro': c, 'servico': s, 'legenda': None, 'destaque': i == 0}
        for i, (c, s) in enumerate([('Porsche 911 GT3', 'ppf-full'), ('BMW M3', 'ppf-frontal'), ('Audi RS6', 'nano-ceramica'), ('Civic Type R', 'ppf-full')])
    ]
    for nome, vp, mob in TELAS:
        ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
        await liga_fake(ctx)
        pedidos = []

        async def rest(r):
            pedidos.append(r.request)
            await r.fulfill(json=linhas)
        await ctx.route(f'{FAKE}/rest/v1/**', rest)
        pg = await ctx.new_page()
        await pg.goto(base, wait_until='networkidle')
        await pg.wait_for_selector('#galeria-lista button')
        ok('publicado=eq.true' in pedidos[0].url and 'apikey' in pedidos[0].headers, f'{nome}: galeria pede só as publicadas')
        ok(await pg.locator('#galeria-lista li').count() == 4, f'{nome}: galeria com 4 fotos')
        await pg.wait_for_function("document.querySelector('.hero').classList.contains('tem-foto')")
        ok(True, f'{nome}: foto de capa no topo')
        await pg.click('#galeria-filtros [data-filtro="ppf-full"]')
        ok(await pg.locator('#galeria-lista li').count() == 2, f'{nome}: filtro por serviço')
        await pg.click('#galeria-lista li:nth-child(2) button')
        ok('Civic' in await pg.text_content('#lightbox-legenda'), f'{nome}: foto ampliada com legenda')
        await pg.keyboard.press('Escape')
        ok(await pg.is_hidden('#lightbox'), f'{nome}: Esc fecha a foto')
        await ctx.close()


async def main():
    porta = porta_livre()
    servidor = subprocess.Popen([sys.executable, '-m', 'http.server', str(porta), '--bind', '127.0.0.1'], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{porta}/'
    try:
        await asyncio.sleep(.6)
        fotos = fotos_de_teste(tempfile.mkdtemp())
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await site(b, base)
            await studio3d(b, base)
            await bancada(b, base)
            await painel(b, base, fotos)
            await galeria(b, base)
            await b.close()
    finally:
        servidor.terminate()
    print(f'\n{len(falhas)} falha(s)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)


asyncio.run(main())
