#!/usr/bin/env python3
# Builds the two privacy pages from their texts (v316, the owner's decisions of 18 Nov 2026):
#   policies/privacy.md         -> privacy.html          (the Privacy Policy: California's CalOPPA, Delaware, Nevada, Connecticut, the FTC)
#   policies/health-privacy.md  -> health-privacy.html   (the Consumer Health Data Privacy Policy: Washington's My Health My Data Act, Nevada)
# usage: python3 tools/build_policies.py --date 2026-11-18
# The pages stand alone (they open without signing in, from the sign-in screen and Settings), in the app's look: Inter, the page's grey or black,
# Apple's back button (it goes back to the app, or to it when opened directly). sw.js keeps a copy of each (EXTRAS, POLICIES) so they open with
# no signal too; a path ending in "/" would be taken for the app (sw.js isShellPage), so they are files, not folders.
# The texts use a small part of Markdown: "# " the title, "## " a heading, "- " a list item (two spaces in for a nested one), "**bold**",
# blank lines between paragraphs. "[Effective date]" is written as the date given; the contact address becomes a mail link.
import argparse, datetime, html, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = [("policies/privacy.md", "privacy.html"), ("policies/health-privacy.md", "health-privacy.html")]
EMAIL = "michal@fialafitness.com"   # the owner's pick (18 Nov 2026), knowing it is public on the site and on GitHub

def inline(text):
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = t.replace(EMAIL, '<a href="mailto:' + EMAIL + '">' + EMAIL + "</a>")
    return t

def convert(md):
    out, para, stack = [], [], []   # stack: the open lists' indents
    def flush_para():
        if para: out.append("<p>" + inline(" ".join(para)) + "</p>"); para.clear()
    def close_lists(to=-1):
        while stack and stack[-1] > to: out.append("</li></ul>"); stack.pop()
    title = ""
    for raw in md.split("\n"):
        line = raw.rstrip()
        if line.startswith("<!--"):
            continue
        m = re.match(r"^( *)- (.*)$", line)
        if m:
            flush_para(); ind = len(m.group(1))
            if stack and ind > stack[-1]: out.append("<ul><li>" + inline(m.group(2))); stack.append(ind); continue
            close_lists(ind)
            if stack and stack[-1] == ind: out.append("</li><li>" + inline(m.group(2)))
            else: out.append("<ul><li>" + inline(m.group(2))); stack.append(ind)
            continue
        if stack and line.startswith("  ") and line.strip():   # a list item's next line
            out[-1] += " " + inline(line.strip()); continue
        if not line.strip():
            flush_para(); close_lists(); continue
        close_lists()
        if line.startswith("# "): flush_para(); title = line[2:].strip(); out.append("<h1>" + inline(title) + "</h1>")
        elif line.startswith("## "): flush_para(); out.append("<h2>" + inline(line[3:].strip()) + "</h2>")
        elif line.startswith("### "): flush_para(); out.append("<h3>" + inline(line[4:].strip()) + "</h3>")
        else: para.append(line.strip())
    flush_para(); close_lists()
    return title, "\n".join(out)

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f5f5f5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">
<link rel="icon" href="favicon.ico">
<title>__TITLE__ · Fiala Fitness</title>
<script>try{var t=JSON.parse(localStorage.getItem("fiala.theme"));if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
  /* the app's own tokens (index.html), the few this page uses: light, the phone's dark, and the app's own Light / Dark choice */
  :root {
    --surface: #f5f5f5; --text-primary: #1d1d1f; --text-secondary: #6e6e73; --text-tertiary: #6b6b70; --brand-text: #66628f;
    --disc-fill: #f8f8f8; --disc-ink: #1d1d1f;
    --disc-edge: inset 0 1.67px 0 -0.67px rgba(255,255,255,0.5), inset 0 -1.67px 0 -0.67px rgba(255,255,255,0.5), inset 0 5px 0 -4.33px rgba(255,255,255,0.8), inset 0 -5px 0 -4.33px rgba(255,255,255,0.8), inset 0 20px 5px -17px rgba(255,255,255,0.6), inset 0 -10px 3px -8.67px rgba(255,255,255,0.2), inset 0 10px 5px 6px rgba(0,0,0,0.016), 0 0 0 0.33px rgba(0,0,0,0.052), 0 0 0 0.67px rgba(0,0,0,0.052), 1px 0 0 -0.33px rgba(0,0,0,0.2), -1px 0 0 -0.33px rgba(0,0,0,0.2), 0 7.67px 5.33px rgba(0,0,0,0.013);
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --surface: #000000; --text-primary: rgba(255,255,255,1); --text-secondary: rgba(255,255,255,0.75); --text-tertiary: rgba(255,255,255,0.55); --brand-text: #a9a5d6;
      --disc-fill: #1f1f1f; --disc-ink: #ffffff;
      --disc-edge: inset 0 19px 0 -18.67px rgba(255,255,255,0.094), inset 0 -19px 0 -18.67px rgba(255,255,255,0.094), inset 0 1.67px 0 -1px rgba(255,255,255,0.02), inset 0 -1.67px 0 -1px rgba(255,255,255,0.02), inset 0 8.33px 0 -7.33px rgba(255,255,255,0.034), inset 0 -8.33px 0 -7.33px rgba(255,255,255,0.034), inset 0 1.33px 0 -0.33px rgba(255,255,255,0.063), inset 0 -1.33px 0 -0.33px rgba(255,255,255,0.063), inset 0 24.67px 8px -24.33px rgba(255,255,255,0.112), inset 0 -24.67px 8px -24.33px rgba(255,255,255,0.112), inset 0 17.33px 0 -16.67px rgba(255,255,255,0.048), inset 0 -17.33px 0 -16.67px rgba(255,255,255,0.048);
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --surface: #000000; --text-primary: rgba(255,255,255,1); --text-secondary: rgba(255,255,255,0.75); --text-tertiary: rgba(255,255,255,0.55); --brand-text: #a9a5d6;
    --disc-fill: #1f1f1f; --disc-ink: #ffffff;
    --disc-edge: inset 0 19px 0 -18.67px rgba(255,255,255,0.094), inset 0 -19px 0 -18.67px rgba(255,255,255,0.094), inset 0 1.67px 0 -1px rgba(255,255,255,0.02), inset 0 -1.67px 0 -1px rgba(255,255,255,0.02), inset 0 8.33px 0 -7.33px rgba(255,255,255,0.034), inset 0 -8.33px 0 -7.33px rgba(255,255,255,0.034), inset 0 1.33px 0 -0.33px rgba(255,255,255,0.063), inset 0 -1.33px 0 -0.33px rgba(255,255,255,0.063), inset 0 24.67px 8px -24.33px rgba(255,255,255,0.112), inset 0 -24.67px 8px -24.33px rgba(255,255,255,0.112), inset 0 17.33px 0 -16.67px rgba(255,255,255,0.048), inset 0 -17.33px 0 -16.67px rgba(255,255,255,0.048);
    color-scheme: dark;
  }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  body { margin: 0; background: var(--surface); color: var(--text-primary); font-family: "Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; font-size: 1.0625rem; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  .bar { position: sticky; top: 0; padding: calc(env(safe-area-inset-top, 0px) + 8px) 16px 8px; background: var(--surface); z-index: 1; }
  .back { appearance: none; border: 0; padding: 0; border-radius: 50%; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; background: var(--disc-fill); color: var(--disc-ink); box-shadow: var(--disc-edge); cursor: pointer; text-decoration: none; }   /* Apple's back button, as the app's: a 44-point circle with the chevron alone */
  .back svg { width: 10.9px; height: 18.2px; transform: translateX(-1.5px); }
  main { max-width: 680px; margin: 0 auto; padding: 8px 20px calc(env(safe-area-inset-bottom, 0px) + 48px); }
  h1 { font-size: 2.125rem; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; margin: 12px 0 6px; }
  h2 { font-size: 1.25rem; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; margin: 32px 0 8px; }
  h3 { font-size: 1.0625rem; font-weight: 600; margin: 24px 0 6px; }
  p, li { color: var(--text-primary); }
  p { margin: 0 0 12px; }
  ul { margin: 0 0 12px; padding-left: 1.25em; }
  li { margin: 0 0 8px; }
  li > ul { margin-top: 8px; }
  .eff { color: var(--text-tertiary); font-size: 0.9375rem; margin-bottom: 20px; }
  a { color: var(--brand-text); text-decoration: none; }
  strong { font-weight: 600; }
</style>
</head>
<body>
<div class="bar"><a class="back" id="back" href="./" aria-label="Back"><svg viewBox="0 0 10.7 17.9" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.2 1.2 8.95 9.5 16.7"/></svg></a></div>
<main>
"""
FOOT = """
</main>
<script>document.getElementById("back").addEventListener("click", function (e) { if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) { e.preventDefault(); history.back(); } });   // back to the app where it was; opened on its own, to the app</script>
</body>
</html>
"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--date", required=True, help="the effective date, YYYY-MM-DD"); a = ap.parse_args()
    d = datetime.date.fromisoformat(a.date); when = d.strftime("%B ") + str(d.day) + d.strftime(", %Y")
    for src, dst in PAGES:
        md = open(os.path.join(ROOT, src), encoding="utf-8").read()
        if "[Contact email]" in md: sys.exit(src + ": [Contact email] is not filled")
        md = md.replace("[Effective date]", when)
        left = re.findall(r"\[[A-Z][^\]]*\]", md)
        if left: sys.exit(src + ": blanks left: " + ", ".join(sorted(set(left))))
        title, body = convert(md)
        body = re.sub(r"<p><strong>(Effective [^<]*)</strong></p>", r'<p class="eff">\1</p>', body, count=1)
        open(os.path.join(ROOT, dst), "w", encoding="utf-8").write(HEAD.replace("__TITLE__", html.escape(title)) + body + FOOT)
        print(dst, "written:", title, "·", when)

if __name__ == "__main__":
    main()
