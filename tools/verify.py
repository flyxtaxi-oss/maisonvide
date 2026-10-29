#!/usr/bin/env python3
""" ==========================================================================
    MaisonVide — Vérification complète du projet
    Usage : python3 tools/verify.py

    Contrôle, page par page :
      · structure (doctype, title, description, canonical, charset)
      · SEO (longueur titre/description, unicité)
      · interdits du design system (eyebrow, glass, gradient texte, border-left,
        emoji, Inter/Fraunces/Playfair en display)
      · cohérence des scripts (core.js, site.js, lenis) et des chemins d'assets
      · liens internes résolus
      · syntaxe JS (node --check)
    ========================================================================== """
import io
import os
import re
import subprocess
import sys
import html.parser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames
                   if d not in ('node_modules', '.git', 'assets', 'db', 'api',
                                'docs', 'tools', 'videos', '.vercel')]
    for f in filenames:
        if f.endswith('.html'):
            PAGES.append(os.path.relpath(os.path.join(dirpath, f), ROOT))
PAGES.sort()

# Emoji : on exclut les flèches typographiques (← → ↑ ↓) et les puces,
# qui sont de la typographie, pas des pictogrammes.
EMOJI = re.compile('[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u25A0-\u25FF]')
BANNED_FONTS = re.compile(r'fonts\.googleapis\.com[^\'\"]*(Fraunces|Playfair|Inter)', re.I)
BANNED_CLASSES = ('eyebrow', 'kicker', 'btn--glass', 'card--glass')
BANNED_CSS = [
    (re.compile(r'background\s*:\s*[^;]*linear-gradient[^;]*;\s*[^}]*-webkit-background-clip\s*:\s*text', re.I),
     'texte en gradient'),
    (re.compile(r'border-left\s*:\s*[2-9](\.\d+)?px', re.I),
     'border-left coloré > 1px'),
    (re.compile(r'backdrop-filter', re.I),
     'backdrop-filter (glass décoratif)'),
    (re.compile(r'@import\s+url\([\'"]?https?://', re.I),
     '@import distant'),
]


class Parser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.scripts = []
        self.styles = []
        self.uses = []
        self.ids = set()
        self.title = None
        self.meta = {}
        self._in_title = False
        self._stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        if tag == 'a' and 'href' in a:
            self.links.append(a['href'])
        elif tag == 'script' and 'src' in a:
            self.scripts.append(a['src'])
        elif tag == 'link' and a.get('rel') == 'stylesheet' and 'href' in a:
            self.styles.append(a['href'])
        elif tag == 'meta':
            if a.get('name'):
                self.meta[a['name']] = a.get('content', '')
            if a.get('property'):
                self.meta[a['property']] = a.get('content', '')
        elif tag == 'title':
            self._in_title = True
        elif tag == 'use' and 'href' in a:
            self.uses.append(a['href'])

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or '') + data


def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


# --------------------------------------------------------------------------
# Doublons CSS : une règle présente à la fois dans le <style> inline d'une
# page ET dans une feuille partagée. L'inline arrive après le <link>, donc
# il gagne — et la feuille partagée devient une source de vérité qui ment.
# C'est le bug qui a fait recouvrir le pied de la fiche « Le relevé ».
# --------------------------------------------------------------------------
SHARED_CSS = ['assets/css/main.css', 'assets/css/motion.css', 'assets/css/blocks.css',
              'assets/css/trust.css', 'assets/css/oryzo.css', 'assets/css/scroll.css',
              'assets/css/legal.css', 'assets/css/pro.css', 'assets/css/admin.css']


def css_rules(text):
    """Règles {sélecteur: déclarations normalisées} d'un texte CSS.

    Seuls les blocs de premier niveau sont retenus : les @media sont
    ignorés (une règle peut légitimement différer selon le contexte).
    """
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    # On retire les blocs conditionnels pour n'examiner que le niveau racine.
    text = re.sub(r'@(media|supports)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', text, flags=re.S)
    out = {}
    for block in re.finditer(r'([^{}]+)\{([^{}]*)\}', text):
        sel = block.group(1).strip()
        body = ' '.join(block.group(2).split())
        if not sel or sel.startswith('@') or sel.startswith(('from', 'to')):
            continue
        for part in sel.split(','):
            part = part.strip()
            if part and body:
                out.setdefault(part, body)
    return out


def inline_styles(src):
    """Les blocs <style> inline d'une page."""
    return re.findall(r'<style[^>]*>(.*?)</style>', src, flags=re.S | re.I)


def check_css_duplication(page, src):
    """Sélecteurs dont le corps de déclarations est identique dans la page
    ET dans une feuille partagée — une copie, donc une règle qui peut
    diverger."""
    shared = {}
    for css in SHARED_CSS:
        path = os.path.join(ROOT, css)
        if os.path.exists(path):
            for sel, body in css_rules(read(css)).items():
                shared.setdefault(sel, body)
    dup = set()
    for block in inline_styles(src):
        for sel, body in css_rules(block).items():
            if shared.get(sel) == body:
                dup.add(sel)
    return dup


# --------------------------------------------------------------------------
# Équilibre des balises : une balise laissée ouverte décale tout le
# reste de la page. Le contenu de <style>, <script> et les commentaires
# sont neutralisés (un <summary> écrit dans un commentaire CSS n'est pas
# une balise).
# --------------------------------------------------------------------------
VOID_TAGS = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area',
             'base', 'col', 'embed', 'param', 'track', 'wbr'}


def check_html_balance(src):
    clean = re.sub(r'<!--.*?-->', '', src, flags=re.S)
    clean = re.sub(r'<style\b[^>]*>.*?</style>', '', clean, flags=re.S | re.I)
    clean = re.sub(r'<script\b[^>]*>.*?</script>', '', clean, flags=re.S | re.I)

    problems = []
    stack = []
    for m in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(/?)>', clean):
        closing, tag, selfclose = m.group(1), m.group(2).lower(), m.group(4)
        ln = src[:m.start()].count('\n') + 1
        if tag in VOID_TAGS or selfclose:
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
    errors = []
    warnings = []
    titles, descs = {}, {}

    print('=' * 66)
    print('  MAISONVIDE — VÉRIFICATION')
    print('=' * 66)

    for page in PAGES:
        src = read(page)
        p = Parser()
        p.feed(src)
        page_errors, page_warnings = [], []

        # --- structure ---
        if not src.lstrip().lower().startswith('<!doctype html>'):
            page_errors.append('doctype manquant')
        if '<html lang="fr">' not in src:
            page_errors.append('lang="fr" manquant')
        if 'charset="UTF-8"' not in src:
            page_errors.append('charset manquant')
        if not p.title or not p.title.strip():
            page_errors.append('title manquant')
        else:
            t = p.title.strip()
            if t in titles:
                page_errors.append('title dupliqué: %s' % titles[t])
            titles[t] = page
            if len(t) > 60:
                page_warnings.append('title %d car. (>60)' % len(t))
            if 'MaisonVide' not in t:
                page_warnings.append('"MaisonVide" absent du title')
        d = p.meta.get('description', '')
        if not d:
            page_errors.append('meta description manquante')
        else:
            if d in descs:
                page_errors.append('description dupliquée: %s' % descs[d])
            descs[d] = page
            if not (120 <= len(d) <= 165):
                page_warnings.append('description %d car.' % len(d))
        if 'canonical' not in src:
            if page.startswith('admin'):
                # L'admin ne doit pas être indexé : on exige noindex
                if 'noindex' not in src:
                    page_warnings.append('admin sans meta robots noindex')
            else:
                page_warnings.append('canonical manquant')
        if 'viewport' not in src:
            page_errors.append('viewport manquant')

        # --- scripts ---
        for s in p.scripts:
            if s.startswith('http'):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(page), s))
            if not os.path.exists(os.path.join(ROOT, target)):
                page_errors.append('script introuvable: %s' % s)
        if 'assets/js/core.js' not in ' '.join(p.scripts):
            page_errors.append('core.js non chargé')
        # site.js porte la motion publique : inutile dans l'admin
        if not page.startswith('admin') and 'assets/js/site.js' not in ' '.join(p.scripts):
            page_errors.append('site.js non chargé')
        # Lenis : utile sur les pages publiques, inutile dans l'admin
        if not page.startswith('admin') and 'lenis.min.js' not in ' '.join(p.scripts):
            page_warnings.append('lenis.min.js non chargé')

        # --- styles ---
        for s in p.styles:
            if s.startswith('http'):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(page), s))
            if not os.path.exists(os.path.join(ROOT, target)):
                page_errors.append('feuille de style introuvable: %s' % s)

        # --- règles CSS dupliquées entre la page et les feuilles partagées ---
        for sel in sorted(check_css_duplication(page, src)):
            page_warnings.append('règle dupliquée (inline + feuille partagée): %s' % sel)

        # --- CSS versé nu dans le <head> (hors <style> et <script>) ---
        m_head = re.search(r'<head[^>]*>(.*?)</head>', src, flags=re.S | re.I)
        if m_head:
            naked = re.sub(r'<style[^>]*>.*?</style>', '', m_head.group(1), flags=re.S | re.I)
            naked = re.sub(r'<script[^>]*>.*?</script>', '', naked, flags=re.S | re.I)
            if '{' in naked or '}' in naked:
                page_errors.append('CSS versé nu dans le <head> (bloc <style> cassé)')

        # --- équilibre des balises ---
        for problem in check_html_balance(src):
            page_errors.append(problem)

        # --- liens internes ---
        for href in p.links:
            if href.startswith(('http', 'mailto:', 'tel:', '#', 'data:')):
                continue
            clean = href.split('#')[0].split('?')[0]
            if not clean:
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(page), clean))
            if clean.endswith('/'):
                target = os.path.join(target, 'index.html')
            if not os.path.exists(os.path.join(ROOT, target)):
                page_errors.append('lien cassé: %s' % href)

        # --- design system ---
        for word in BANNED_CLASSES:
            if re.search(r'class="[^"]*\b%s\b' % word, src):
                page_errors.append('classe interdite: %s' % word)
        if BANNED_FONTS.search(src):
            page_errors.append('police interdite (Inter/Fraunces/Playfair)')
        for pat, label in BANNED_CSS:
            for m in pat.finditer(src):
                line = src[:m.start()].count('\n') + 1
                page_warnings.append('%s (l.%d)' % (label, line))
        for m in EMOJI.finditer(src):
            page_errors.append('emoji %r' % m.group())
        if re.search(r'opacity\s*:\s*0\s*;', src) and 'data-rise' not in src:
            page_warnings.append('opacity:0 sur contenu')

        # --- icônes du sprite ---
        for u in p.uses:
            if u.startswith('#i-'):
                symbol = u[1:]
                sprite = os.path.join(ROOT, 'assets/icons/sprite.svg')
                if symbol not in read('assets/icons/sprite.svg'):
                    page_errors.append('icône absente du sprite: %s' % symbol)

        for e in page_errors:
            errors.append('%s → %s' % (page, e))
        for w in page_warnings:
            warnings.append('%s → %s' % (page, w))

        flag = 'OK ' if not page_errors else 'ERR'
        print('  %s  %-34s %s' % (flag, page,
                                  '' if not page_errors else '(%d erreur(s))' % len(page_errors)))

    # --- JS ---
    print('\n  Syntaxe JavaScript')
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, 'assets/js')):
        for f in sorted(filenames):
            if not f.endswith('.js'):
                continue
            full = os.path.join(dirpath, f)
            r = subprocess.run(['node', '-c', full], capture_output=True, text=True)
            ok = r.returncode == 0
            print('  %s  %s' % ('OK ' if ok else 'ERR', f))
            if not ok:
                errors.append('assets/js/%s → %s' % (f, r.stderr.strip()[:120]))
    for f in ('api/listings.js', 'api/stats.js', 'db/apply.js', 'db/seed.js'):
        full = os.path.join(ROOT, f)
        if os.path.exists(full):
            r = subprocess.run(['node', '-c', full], capture_output=True, text=True)
            print('  %s  %s' % ('OK ' if r.returncode == 0 else 'ERR', f))
            if r.returncode != 0:
                errors.append('%s → %s' % (f, r.stderr.strip()[:120]))

    # --- bilan ---
    print('\n' + '=' * 66)
    print('  %d pages · %d erreur(s) · %d avertissement(s)'
          % (len(PAGES), len(errors), len(warnings)))
    print('=' * 66)
    if errors:
        print('\n  ERREURS')
        for e in errors:
            print('   ✗ %s' % e)
    if warnings:
        print('\n  AVERTISSEMENTS')
        for w in warnings:
            print('   ! %s' % w)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
