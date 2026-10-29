#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" ==========================================================================
    MaisonVide — Équilibre des balises HTML
    Usage : python3 tools/check-html.py [fichier…]

    Contrôle qu'aucune balise n'est laissée ouverte et qu'aucune balise n'est
    fermée deux fois. Le contenu de <style>, <script> et les commentaires
    HTML sont ignorés : sans cela, un `<summary>` écrit dans un commentaire
    CSS serait pris pour une balise ouverte.
    ========================================================================== """
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOID = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area',
        'base', 'col', 'embed', 'param', 'track', 'wbr'}
RAW = {'style', 'script'}


def strip_raw(src):
    """Neutralise le contenu des <style>, <script> et des commentaires."""
    src = re.sub(r'<!--.*?-->', '', src, flags=re.S)
    for tag in RAW:
        src = re.sub(r'<%s\b[^>]*>.*?</%s>' % (tag, tag), '', src, flags=re.S | re.I)
    return src


def check(path):
    full = path if os.path.isabs(path) else os.path.join(ROOT, path)
    src = io.open(full, encoding='utf-8').read()
    clean = strip_raw(src)
    problems = []
    stack = []

    for m in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(/?)>', clean):
        closing, tag, selfclose = m.group(1), m.group(2).lower(), m.group(4)
        ln = src[:m.start()].count('\n') + 1
        if tag in VOID or selfclose:
            continue
        if closing:
            if stack and stack[-1][0] == tag:
                stack.pop()
            else:
                expected = stack[-1][0] if stack else '?'
                problems.append('ligne %d : </%s> fermée alors que <%s> attend sa fermeture'
                                % (ln, tag, expected))
                for i in range(len(stack) - 1, -1, -1):
                    if stack[i][0] == tag:
                        del stack[i:]
                        break
                else:
                    stack = []
        else:
            stack.append((tag, ln))

    for tag, ln in stack:
        if tag in ('html', 'body'):
            continue
        problems.append('ligne %d : <%s> jamais fermée' % (ln, tag))
    return problems


def main():
    if len(sys.argv) > 1:
        pages = sys.argv[1:]
    else:
        pages = []
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames
                           if d not in ('.git', 'node_modules', '.vercel', 'tools')]
            for f in filenames:
                if f.endswith('.html'):
                    pages.append(os.path.relpath(os.path.join(dirpath, f), ROOT))
        pages.sort()

    total = 0
    for page in pages:
        problems = check(page)
        if problems:
            total += len(problems)
            print('  %s' % page)
            for p in problems:
                print('      %s' % p)
    if total == 0:
        print('  %d page(s) — toutes les balises sont équilibrées.' % len(pages))
    else:
        print('\n  %d problème(s).' % total)
        sys.exit(1)


if __name__ == '__main__':
    main()
