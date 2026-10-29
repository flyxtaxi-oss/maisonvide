#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" ==========================================================================
    MaisonVide — Déduplication des règles CSS
    Usage : python3 tools/dedupe-css.py [--dry-run]

    Les pages historiques portaient des copies de règles déjà présentes dans
    les feuilles partagées (blocks.css, motion.css…). Comme le <style> inline
    arrive APRÈS le <link>, c'est la copie qui gagne : la feuille partagée
    devient une source de vérité qui ment, et la moindre retouche de design
    ne se voit plus.

    Cet outil retire de chaque page les règles dont le sélecteur ET le corps
    de déclarations sont identiques à une règle d'une feuille partagée chargée
    AVANT le <style> inline. Les variantes (même sélecteur, déclarations
    différentes) sont laissées intactes : ce sont des surcharges légitimes.
    ========================================================================== """
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SHARED_CSS = ['assets/css/main.css', 'assets/css/motion.css', 'assets/css/blocks.css',
              'assets/css/trust.css', 'assets/css/oryzo.css', 'assets/css/scroll.css',
              'assets/css/legal.css', 'assets/css/pro.css', 'assets/css/admin.css']


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def strip_media(text):
    """Retire les blocs conditionnels : on ne traite que le niveau racine.
    Les commentaires sont retirés D'ABORD (un commentaire peut contenir des
    accolades et fausser le comptage des niveaux)."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    return re.sub(r'@(media|supports)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', text, flags=re.S)


def rules_with_body(text):
    """Liste ordonnée de (sélecteur, corps, texte complet du bloc)."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', text):
        sel = m.group(1).strip()
        body = ' '.join(m.group(2).split())
        if not sel or sel.startswith('@') or sel.startswith(('from', 'to')):
            continue
        if body:
            out.append((sel, body, m.group(0)))
    return out


def shared_index():
    """{sélecteur: [(fichier, corps)]} sur les feuilles partagées."""
    idx = {}
    for css in SHARED_CSS:
        path = os.path.join(ROOT, css)
        if not os.path.exists(path):
            continue
        for sel, body, _ in rules_with_body(strip_media(read(path))):
            idx.setdefault(sel, []).append((css, body))
    return idx


def link_positions(src):
    """Position de chaque <link rel=stylesheet> dans la page."""
    pos = {}
    for m in re.finditer(r'<link[^>]+rel="stylesheet"[^>]*>', src, re.I):
        href = re.search(r'href="([^"]+)"', m.group(0))
        if href:
            pos[href.group(1)] = m.start()
    return pos


def process(path, index, dry):
    src = read(path)
    links = link_positions(src)
    removed = []
    new_src = src

    def repl(match):
        block = match.group(0)
        style_start = match.start()
        inner = match.group(1)
        links_before = {h: p for h, p in links.items() if p < style_start}

        out = inner
        for sel, body, _full in rules_with_body(strip_media(inner)):
            providers = index.get(sel, [])
            # Une feuille partagée doit fournir EXACTEMENT le même corps,
            # et être chargée avant le <style> inline.
            ok = False
            for css, cbody in providers:
                if cbody != body:
                    continue
                rel = os.path.relpath(os.path.join(ROOT, css),
                                       os.path.dirname(os.path.join(ROOT, path)))
                rel = rel.replace(os.sep, '/')
                if rel in links_before:
                    ok = True
                    break
            if not ok:
                continue

            # On retire la règle du texte d'origine : le motif est reconstruit
            # à partir du sélecteur, car le texte capturé dans la version
            # nettoyée diffère (commentaires retirés, espaces différents).
            pat = re.compile(r'(?<![\w\-.#])' + re.escape(sel) + r'\s*\{[^{}]*\}')
            for mm in pat.finditer(out):
                hit = mm.group(0)
                body_txt = ' '.join(hit[hit.index('{') + 1:-1].split())
                if body_txt != body:
                    continue
                out = out[:mm.start()] + out[mm.end():]
                removed.append(sel)
                break

        out = re.sub(r'\n{3,}', '\n\n', out)
        return block.replace(inner, out)

    new_src = re.sub(r'<style[^>]*>(.*?)</style>', repl, new_src, flags=re.S | re.I)

    if removed and not dry:
        with io.open(os.path.join(ROOT, path), 'w', encoding='utf-8') as f:
            f.write(new_src)
    return removed


def main():
    dry = '--dry-run' in sys.argv
    index = shared_index()

    pages = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', '.vercel', 'tools')]
        for f in filenames:
            if f.endswith('.html'):
                pages.append(os.path.relpath(os.path.join(dirpath, f), ROOT))
    pages.sort()

    total = 0
    for page in pages:
        removed = process(page, index, dry)
        if removed:
            total += len(removed)
            print('  %-24s %d règle(s) : %s' % (page, len(removed), ', '.join(sorted(set(removed))[:6])))
    print('\n%s %d règle(s) dupliquée(s) retirée(s).' % ('[simulation] ' if dry else '', total))


if __name__ == '__main__':
    main()
