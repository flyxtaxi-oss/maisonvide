#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" ==========================================================================
    MaisonVide — Normalisation des <head>
    Usage : python3 tools/normalize-head.py [--dry-run]

    Objectif : une seule règle de cascade pour toutes les pages.

      1. les feuilles partagées sont chargées TOUJOURS dans le même ordre ;
      2. le <style> inline passe TOUJOURS APRÈS les <link> — sinon il est
         neutralisé par les feuilles partagées, et les deux sources de
         vérité se contredisent sans qu'on le voie ;
      3. aucune feuille partagée ne disparaît au passage (blocks.css et
         trust.css s'étaient évaporés de services.html).

    Ce script ne réécrit que le <head>. Le corps des pages n'est pas touché.
    ========================================================================== """
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ordre canonique des feuilles partagées.
BASE_ORDER = ['main.css', 'motion.css', 'blocks.css', 'trust.css', 'oryzo.css', 'scroll.css']

# Feuilles propres à certaines pages, toujours en dernier.
PAGE_EXTRA = {
    'pro.html': ['pro.css'],
    'mentions-legales.html': ['legal.css'],
    'confidentialite.html': ['legal.css'],
    'cgu.html': ['legal.css'],
    'cookies.html': ['legal.css'],
}


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def wanted(page):
    """Liste ordonnée des feuilles attendues pour une page."""
    out = []
    for name in BASE_ORDER:
        out.append(name)
    for name in PAGE_EXTRA.get(page, []):
        out.append(name)
    return out


def process(page, dry):
    path = os.path.join(ROOT, page)
    src = read(path)
    m = re.search(r'<head[^>]*>(.*?)</head>', src, flags=re.S | re.I)
    if not m:
        return None
    head = m.group(1)

    # Feuille de style locale déjà présente
    local = re.findall(r'<link[^>]*rel="stylesheet"[^>]*href="(?:\.\./)?assets/css/([^"]+)"[^>]*>', head, flags=re.I)
    # Blocs <style> inline
    styles = re.findall(r'<style[^>]*>.*?</style>', head, flags=re.S | re.I)

    want = wanted(page)
    # On ne rajoute que ce qui manque ; on retire ce qui n'est pas attendu
    # (et qui n'a pas été posé volontairement).
    final = [c for c in want if c in local or c in want]
    missing = [c for c in want if c not in local]

    if not missing and local == [c for c in want if c in local] and \
            (not styles or head.rindex('</style>') < head.rindex('assets/css/')):
        return None

    prefix = '' if page.startswith('admin/') else ''
    links = '\n'.join('  <link rel="stylesheet" href="assets/css/%s">' % c for c in want)
    style_block = '\n'.join(styles)

    # On retire les anciennes lignes, puis on réinsère au même endroit.
    body = re.sub(r'[ \t]*<link[^>]*rel="stylesheet"[^>]*href="(?:\.\./)?assets/css/[^"]+"[^>]*>\n?', '', head)
    body = re.sub(r'[ \t]*<style[^>]*>.*?</style>\n?', '', body, flags=re.S | re.I)
    body = re.sub(r'\n{3,}', '\n\n', body)

    rebuilt = body.rstrip() + '\n\n' + links + '\n'
    if style_block:
        rebuilt += style_block + '\n'

    new_src = src[:m.start(1)] + rebuilt + src[m.end(1):]
    if not dry:
        with io.open(path, 'w', encoding='utf-8') as f:
            f.write(new_src)
    return {'missing': missing, 'styles': len(styles), 'order': [c for c in want if c in local]}


def main():
    dry = '--dry-run' in sys.argv
    pages = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', '.vercel', 'tools')]
        for f in filenames:
            if f.endswith('.html'):
                pages.append(os.path.relpath(os.path.join(dirpath, f), ROOT))
    pages.sort()

    changed = 0
    for page in pages:
        if page.startswith('admin/'):
            continue  # l'admin a son propre langage ; 3d.html est autonome
        res = process(page, dry)
        if res:
            changed += 1
            extra = ('manquantes : ' + ', '.join(res['missing'])) if res['missing'] else 'ordre des feuilles'
            print('  %-24s %s' % (page, extra))
    print('\n%s %d page(s) normalisée(s).' % ('[simulation] ' if dry else '', changed))


if __name__ == '__main__':
    main()
