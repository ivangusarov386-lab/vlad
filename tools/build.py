#!/usr/bin/env python3
"""Build the static site with Python's standard library; no runtime dependencies."""
import argparse
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '_source'
CONFIG = json.loads((SOURCE / 'site.json').read_text())
PAGES = [
    ('vpn/iphone/', 'VPN для iPhone — настройка Happ и подписки Flowpass',
     'Как подключить Flowpass на iPhone: установка Happ из App Store, добавление подписки, разрешение VPN и проверка подключения. Инструкция и ответы на вопросы.', 'VPN для iPhone'),
    ('vpn/android/', 'VPN для Android — подключение через Happ | Flowpass',
     'Настройка Flowpass на Android: официальная загрузка Happ, импорт подписки, разрешение VPN и диагностика соединения. Пошаговая инструкция.', 'VPN для Android'),
    ('smart-routing/', 'Умная маршрутизация VPN — как работает Flowpass',
     'Как Flowpass распределяет соединения: российские сервисы напрямую, зарубежный трафик через VPN. Интерактивная схема, примеры и ограничения маршрутизации.', 'Умная маршрутизация'),
]


def build(target, destination, base_override=None):
    destination = Path(destination).resolve()
    base = base_override or (CONFIG['demo_base'] if target == 'demo' else '/')
    if not base.startswith('/') or not base.endswith('/') or '..' in base or '?' in base or '#' in base:
        raise ValueError('BASE_URL must be an absolute path ending in /')
    origin = CONFIG['demo_origin'] if target == 'demo' else CONFIG['production_origin']
    if urlparse(origin).scheme != 'https' or urlparse(origin).path:
        raise ValueError('Site origins must be HTTPS without a path or trailing slash')
    # A canonical is a preferred URL, not a substitute for a noindex directive.
    # Keep the original homepage commercial canonical in demo; new documents have
    # their own future commercial canonical, avoiding promotion of the test copy.
    canonical_origin = CONFIG['production_origin']
    noindex = target == 'demo' and CONFIG['demo_noindex']
    robots = 'noindex, follow' if noindex else 'index, follow'

    def read(name):
        return (SOURCE / name).read_text()

    def common(fragment, internal=False):
        if internal:
            fragment = re.sub(r'href="#([^"]+)"', r'href="{{BASE}}#\1"', fragment)
        return fragment.replace('{{BASE}}', base)

    header_home = common(read('header.html.in'))
    footer_home = common(read('footer.html.in'))
    header_inner = common(read('header.html.in'), True)
    footer_inner = common(read('footer.html.in'), True)
    social_url = origin + base + 'assets/flowpass-social.png'

    def schema(path, title=None):
        url = canonical_origin + '/' + path
        data = [{
            '@context': 'https://schema.org', '@type': 'Service',
            '@id': canonical_origin + '/#service', 'name': 'Flowpass VPN',
            'serviceType': 'VPN-подписка', 'url': canonical_origin + '/',
            'description': 'VPN-сервис с автоматической маршрутизацией трафика. Подключение через сторонний клиент Happ.',
            'offers': {'@type': 'Offer', 'price': '149', 'priceCurrency': 'RUB',
                       'url': 'https://lk.flowpass.online/buy/get',
                       'description': 'Доступ на 30 дней. Финальные условия — в личном кабинете.'},
        }]
        if path:
            data.append({'@context': 'https://schema.org', '@type': 'BreadcrumbList',
                         'itemListElement': [
                             {'@type': 'ListItem', 'position': 1, 'name': 'Главная', 'item': canonical_origin + '/'},
                             {'@type': 'ListItem', 'position': 2, 'name': title, 'item': url},
                         ]})
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'

    def write(path, content):
        out = destination / path
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content)

    def social_tags():
        return (f'<meta property="og:image" content="{social_url}">'
                '<meta property="og:image:width" content="1200">'
                '<meta property="og:image:height" content="630">'
                '<meta property="og:image:alt" content="Flowpass — интернет идёт своим маршрутом">'
                '<meta property="og:locale" content="ru_RU">'
                '<meta name="twitter:card" content="summary_large_image">')

    home = read('home.html.in').replace('{{HEADER}}', header_home).replace('{{FOOTER}}', footer_home)
    home = common(home).replace('{{SCHEMA}}', schema(''))
    home = home.replace('</head>', f'<meta name="robots" content="{robots}">' + social_tags() + '</head>')
    write('index.html', home)
    for path, title, description, label in PAGES:
        body = read('pages/' + path.strip('/').replace('/', '-') + '.html.in')
        body = body.replace('{{DIAGRAM}}', read('diagram.html.in'))
        body = common(body)
        canonical = canonical_origin + '/' + path
        text = f'''<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#090f1a"><title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description, quote=True)}"><meta name="robots" content="{robots}">
<link rel="canonical" href="{canonical}"><meta property="og:url" content="{canonical}">
<meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:description" content="{html.escape(description, quote=True)}"><meta property="og:type" content="website">{social_tags()}
<link rel="icon" href="{base}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{base}assets/site.css"><link rel="stylesheet" href="{base}assets/seo.css">{schema(path, label)}</head>
<body><div class="scroll-progress" id="scroll-progress" aria-hidden="true"></div>{header_inner}
<main id="top" class="seo-page"><div class="container"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="{base}">Главная</a><span aria-hidden="true">/</span><span aria-current="page">{label}</span></nav></div>
{body}</main>{footer_inner}<script src="{base}assets/site.js" defer></script></body></html>'''
        write(path + 'index.html', text)

    # Do not publish an empty/invalid sitemap or list commercial URLs in a
    # different host's sitemap. Generate the sitemap only for production.
    if target == 'production':
        entries = [''] + [page[0] for page in PAGES]
        sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        sitemap += ''.join(f'  <url><loc>{canonical_origin}/{path}</loc></url>\n' for path in entries)
        write('sitemap.xml', sitemap + '</urlset>\n')
    else:
        (destination / 'sitemap.xml').unlink(missing_ok=True)
    # Crawlers must fetch HTML to see noindex. Never Disallow the demo pages.
    robot_text = 'User-agent: *\nAllow: /\n'
    if target == 'production':
        robot_text += f'Sitemap: {canonical_origin}/sitemap.xml\n'
    else:
        robot_text += '# Demo: indexing policy is in each HTML robots meta tag.\n'
        robot_text += '# GitHub Pages project robots.txt cannot control the host root.\n'
    write('robots.txt', robot_text)
    write('404.html', f'<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>Страница не найдена — Flowpass</title><link rel="stylesheet" href="{base}assets/site.css"><link rel="stylesheet" href="{base}assets/seo.css"></head><body><main class="container seo-section"><h1>Страница не найдена</h1><p>Проверьте адрес или вернитесь к подключению Flowpass.</p><a class="btn btn-light" href="{base}">На главную</a></main></body></html>')
    if destination != ROOT:
        for name in ['assets', 'favicon.svg']:
            src, dst = ROOT / name, destination / name
            if src.is_dir():
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
    print(f'Built {target}: {destination}; BASE_URL={base}; robots={robots}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=['demo', 'production'], default='demo')
    parser.add_argument('--out', type=Path, default=ROOT)
    parser.add_argument('--base-url', help='Override path prefix, e.g. /vlad/ or /')
    args = parser.parse_args()
    build(args.target, args.out, args.base_url)
