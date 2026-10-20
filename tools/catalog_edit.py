#!/usr/bin/env python3
"""Edit the exercise catalog: word renames (e.g. triceps=tricep) and a duplicate sweep.
Writes the SOURCES (exercises.txt, exercise-videos.json, exercise-aliases.json), re-embeds app/catalog.js through tools/embed.py,
and applies the same word renames to templates.json (exercise names and alternatives), so nothing drifts.
Usage: python3 tools/catalog_edit.py [old=new ...] [--dry]
Rules: a renamed name becomes an alias of its new spelling, so old workouts and saved videos keep matching.
Duplicates (two names with the same squashed key) are merged: the one with a video stays, the other becomes an alias."""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def squash(s): return re.sub(r"[^a-z0-9]+", "", s.lower())
def load():
    names = [l.strip() for l in open(f"{ROOT}/exercises.txt", encoding="utf-8") if l.strip()]
    videos = json.load(open(f"{ROOT}/exercise-videos.json", encoding="utf-8"))
    aliases = json.load(open(f"{ROOT}/exercise-aliases.json", encoding="utf-8"))
    return names, videos, aliases
def dump(names, videos, aliases):
    open(f"{ROOT}/exercises.txt", "w", encoding="utf-8").write("\n".join(names) + "\n")
    for fn, obj in (("exercise-videos.json", videos), ("exercise-aliases.json", aliases)):
        open(f"{ROOT}/{fn}", "w", encoding="utf-8").write(json.dumps(obj, ensure_ascii=False, indent=0) + "\n")
    subprocess.run([sys.executable, f"{ROOT}/tools/embed.py"], check=True)
def word_rename(s, old, new):
    def rep(m):
        w = m.group(0)
        if w.isupper() and len(w) > 1: return new.upper()
        return (new[0].upper() + new[1:]) if w[0].isupper() else new
    return re.sub(r"\b" + re.escape(old) + r"\b", rep, s, flags=re.I)
def rename_templates(renames, dry):
    p = f"{ROOT}/templates.json"; t = json.load(open(p, encoding="utf-8")); n = 0
    def fix(s):
        nonlocal n
        o = s
        for old, new in renames: s = word_rename(s, old, new)
        if s != o: n += 1
        return s
    for tpl in t:
        for r in tpl.get("rows", []):
            if isinstance(r.get("name"), str): r["name"] = fix(r["name"])
            if isinstance(r.get("alts"), list): r["alts"] = [fix(a) if isinstance(a, str) else a for a in r["alts"]]
    if not dry and n: open(p, "w", encoding="utf-8").write(json.dumps(t, ensure_ascii=False, indent=0) + "\n")   # the file's own style: one field per line, no indent
    return n
def main():
    args = sys.argv[1:]; dry = "--dry" in args
    renames = [a.split("=", 1) for a in args if "=" in a]
    names, videos, aliases = load(); log = []
    for old, new in renames:                                   # 1) word renames
        mapping = {}
        for n in names:
            m = word_rename(n, old, new)
            if m != n: mapping[n] = m
        names = [mapping.get(n, n) for n in names]
        nv = {}
        for k, v in videos.items(): nv.setdefault(mapping.get(k, k), v)          # two old names landing on one new one: the first video stays
        videos = nv
        aliases = {k: mapping.get(v, v) for k, v in aliases.items()}
        for o, n in mapping.items():
            if o not in aliases and o != n: aliases[o] = n                       # the old spelling still finds the exercise
        log.append(f"renamed {len(mapping)} names: {old} -> {new}")
    seen = {}; keep = []; merged = 0                            # 2) duplicates by squashed key: keep the one with a video
    for n in names:
        k = squash(n)
        if k in seen:
            a = seen[k]; b = n
            if a == b: continue
            if videos.get(b) and not videos.get(a): keep[keep.index(a)] = b; seen[k] = b; a, b = b, a
            if b in videos and a not in videos: videos[a] = videos[b]
            videos.pop(b, None); aliases[b] = a; merged += 1; log.append(f"merged duplicate: {b} -> {a}")
        else: seen[k] = n; keep.append(n)
    names = keep
    nameset = set(names)                                        # 3) tidy aliases: never a real name, never a missing target, never self
    aliases = {k: v for k, v in aliases.items() if k != v and k not in nameset and v in nameset}
    names.sort(key=lambda s: s.lower())
    tn = rename_templates(renames, dry) if renames else 0
    log.append(f"result: {len(names)} names, {len(videos)} videos, {len(aliases)} aliases, {merged} duplicates merged, {tn} template names renamed")
    print("\n".join(log))
    if not dry: dump(names, videos, aliases)
main()
