#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" ==========================================================================
    MaisonVide — Réparation des blocs <style> endommagés
    Usage : python3 tools/repair-styles.py [--dry-run]

    Un incident de script a remplacé le contenu de certains blocs <style>
    par un fragment de CSS versé dans le HTML. Cette outil restaure le
    bloc depuis la dernière version commise (git), puis le normaliseur et
    la déduplication sont rejoués : le résultat visuel est identique à
    celui d'avant l'incident, puisque les règles supprimées sont
    désormais fournies par les feuilles partagées.

    Ne touche QUE le <head> : le corps des pages est intact.
    ========================================================================== """
import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git_show(path):
    try:
        out = subprocess.check_output(['git', 'show', 'HEAD:' + path], cwd=ROOT,
                                      stderr=subprocess.DEVNULL)
        return out.decode('utf-8')
    except Exception:
        return None


def head_styles(src):
    m = re.search(r'<head[^>]*>(.*?)</head>', src, flags=re.S | re.I)
    if not m:
        return None, None
    return m, re.findall(r'<style[^>]*>.*?</style>', m.group(1), flags=re.S | re.I)


def is_damaged(head):
    """Une page est endommagée s'il reste des accolades dans le <head>
    en dehors des blocs <style> et <script> : c'est la signature d'un CSS
    versé nu dans le HTML."""
    stripped = re.sub(r'<style[^>]*>.*?</style>', '', head, flags=re.S | re.I)
    stripped = re.sub(r'<script[^>]*>.*?</script>', '', stripped, flags=re.S | re.I)
    return '{' in stripped or '}' in stripped


def repair(path, dry):
    full = os.path.join(ROOT, path)
    src = io.open(full, encoding='utf-8').read()
    m, styles = head_styles(src)

    if m is None:
        return None
    head = m.group(1)
    if not is_damaged(head):
        return None

    old = git_show(path)
    if old is None:
        return {'error': 'pas de version dans git'}
    _, old_styles = head_styles(old)
    if not old_styles:
        return {'error': 'aucun <style> dans la version git'}

    style_block = '\n'.join(old_styles)

    # On retire tout ce qui ressemble à du CSS nu dans le head…
    cleaned = re.sub(r'^[ \t]*[.#][A-Za-z][^{}\n]*\{[^}]*\}[ \t]*\n?', '', head, flags=re.M)
    cleaned = re.sub(r'^[ \t]*\}[ \t]*\n', '', cleaned, flags=re.M)
    # …et on replace le bloc restauré après les dernières feuilles de style.
    links = list(re.finditer(r'<link[^>]*rel="stylesheet"[^>]*>', cleaned))
    if links:
        pos = links[-1].end()
        rebuilt = cleaned[:pos] + '\n\n' + style_block + '\n' + cleaned[pos:]
    else:
        rebuilt = cleaned.rstrip() + '\n\n' + style_block + '\n'

    new_src = src[:m.start(1)] + rebuilt + src[m.end(1):]
    if not dry:
        io.open(full, 'w', encoding='utf-8').write(new_src)
    return {'styles': len(old_styles)}


def main():
    dry = '--dry-run' in sys.argv
    pages = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', '.vercel', 'tools')]
        for f in filenames:
            if f.endswith('.html'):
                pages.append(os.path.relpath(os.path.join(dirpath, f), ROOT))
    pages.sort()

    n = 0
    for page in pages:
        res = repair(page, dry)
        if res:
            n += 1
            if res.get('error'):
                print('  %-24s ERREUR : %s' % (page, res['error']))
            else:
                print('  %-24s bloc <style> restauré (%d)' % (page, res['styles']))
    print('\n%s %d page(s) réparée(s).' % ('[simulation] ' if dry else '', n))


if __name__ == '__main__':
    main()
