#!/usr/bin/env python3
"""Check crawlable static HTML, canonical URLs, links and production sitemap."""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import xml.etree.ElementTree as ET


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.meta, self.titles, self.h1s, self.schemas = [], [], {}, [], [], []
        self.current = None
        self.buffer = ''
        self.canonical = None
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag in ['a', 'link', 'script', 'img']:
            url = a.get('href') or a.get('src')
            if url:
                self.links.append(url)
        if tag == 'meta':
            self.meta[a.get('name') or a.get('property')] = a.get('content')
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a['href']
        if tag in ['title', 'h1'] or tag == 'script' and a.get('type') == 'application/ld+json':
            self.current, self.buffer = tag, ''

    def handle_data(self, data):
        if self.current:
            self.buffer += data

    def handle_endtag(self, tag):
        if tag == self.current:
            if tag == 'title':
                self.titles.append(self.buffer.strip())
            elif tag == 'h1':
                self.h1s.append(self.buffer.strip())
            else:
                data = json.loads(self.buffer)
                self.schemas.extend(data if isinstance(data, list) else [data])
            self.current, self.buffer = None, ''


def check(root, base, target, noindex=False):
    paths = ['', 'vpn/iphone/', 'vpn/android/', 'smart-routing/']
    docs = {}
    for path in paths:
        text = (root / path / 'index.html').read_text()
        assert '{{' not in text, f'Unexpanded template: {path}'
        d = docs[path] = Document(text)
        assert len(d.titles) == len(d.h1s) == 1, f'Title/H1 count: {path}'
        assert len(d.ids) == len(set(d.ids)), f'Duplicate IDs: {path}'
        assert d.canonical == 'https://flowpass.online/' + path
        assert d.meta['og:url'] == d.canonical
        assert d.meta['description'] and d.meta['og:image']
        assert d.meta['robots'] == ('noindex, follow' if noindex else 'index, follow')
        assert any(s['@type'] == 'Service' for s in d.schemas)
        if path:
            crumb = next(s for s in d.schemas if s['@type'] == 'BreadcrumbList')
            assert crumb['itemListElement'][-1]['item'] == d.canonical
            assert 'https://lk.flowpass.online/login' in d.links
            assert 'faqitem' in text and len(text) > 8000
        assert 'https://lk.flowpass.online/login' in d.links
        assert 'https://t.me/Flowpass_helper_bot' in d.links
        image = urlparse(d.meta['og:image']).path
        assert image.startswith(base)
        assert (root / image[len(base):]).is_file(), 'Missing social image'
    assert len({d.titles[0] for d in docs.values()}) == 4
    assert len({d.meta['description'] for d in docs.values()}) == 4
    for path, d in docs.items():
        for url in d.links:
            u = urlparse(url)
            if u.scheme or u.netloc:
                continue
            if u.path.startswith('/'):
                assert u.path.startswith(base), f'Wrong prefix: {url}'
                rel = unquote(u.path[len(base):])
            else:
                rel = str(Path(path) / unquote(u.path)) if u.path else path
            dest = root / rel
            if dest.is_dir():
                dest /= 'index.html'
            assert dest.is_file(), f'Broken link: {path}: {url}'
            if u.fragment and dest.suffix == '.html':
                assert unquote(u.fragment) in Document(dest.read_text()).ids, f'Broken anchor: {url}'
    if target == 'production':
        sitemap = ET.parse(root / 'sitemap.xml')
        urls = {e.text for e in sitemap.findall('.//{*}loc')}
        assert urls == {'https://flowpass.online/' + p for p in paths}
    else:
        assert not (root / 'sitemap.xml').exists()
    assert 'Disallow: /\n' not in (root / 'robots.txt').read_text()
    assert 'noindex' in (root / '404.html').read_text()
    print(f'PASS {target}: 4 documents; unique metadata, H1, schema, breadcrumbs; local links/assets/anchors; sitemap; robots; 404.')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    p.add_argument('--base', default='/vlad/')
    p.add_argument('--target', choices=['demo', 'production'], default='demo')
    p.add_argument('--noindex', action='store_true')
    a = p.parse_args()
    check(a.root, a.base, a.target, a.noindex)
