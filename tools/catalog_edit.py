#!/usr/bin/env python3
"""Edit app/catalog.js in place: word renames (e.g. triceps -> tricep) and a duplicate sweep.
Usage: python3 tools/catalog_edit.py [--rename triceps=tricep ...] [--dry]
Rules: a renamed name becomes an alias of its new spelling, so old workouts and saved videos keep matching.
Duplicates (two names with the same squashed key) are merged: the one with a video stays, the other becomes an alias."""
import json, re, sys
PATH = "app/catalog.js"
def squash(s): return re.sub(r"[^a-z0-9]+", "", s.lower())
def load():
    lines = open(PATH, encoding="utf-8").read().split("\n")
    def grab(prefix):
        for l in lines:
            if l.startswith("export const " + prefix + " = "): return json.loads(l[len("export const " + prefix + " = "):].rstrip(";"))
        raise SystemExit("missing " + prefix)
    return lines[0], grab("NAMES"), grab("VIDEOS"), grab("ALIASES")
def dump(head, names, videos, aliases):
    j = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    open(PATH, "w", encoding="utf-8").write("\n".join([head, "export const NAMES = " + j(names) + ";", "export const VIDEOS = " + j(videos) + ";", "export const ALIASES = " + j(aliases) + ";", ""]))
def word_rename(s, old, new):
    def rep(m):
        w = m.group(0); return new.capitalize() if w[0].isupper() else new
    return re.sub(r"\b" + re.escape(old) + r"\b", rep, s, flags=re.I)
def main():
    args = sys.argv[1:]; dry = "--dry" in args
    renames = [a.split("=", 1) for a in args if "=" in a]
    head, names, videos, aliases = load()
    log = []
    # 1) word renames
    for old, new in renames:
        mapping = {}
        for n in names:
            m = word_rename(n, old, new)
            if m != n: mapping[n] = m
        names = [mapping.get(n, n) for n in names]
        videos = {mapping.get(k, k): v for k, v in videos.items()}
        aliases = {k: mapping.get(v, v) for k, v in aliases.items()}
        for o, n in mapping.items():
            if o not in aliases and o != n: aliases[o] = n          # the old spelling still finds the exercise
        log.append(f"renamed {len(mapping)} names: {old} -> {new}")
    # 2) duplicates by squashed key: keep the one with a video (else the first), the other becomes an alias
    seen = {}; keep = []; merged = 0
    for n in names:
        k = squash(n)
        if k in seen:
            a = seen[k]; b = n
            if videos.get(b) and not videos.get(a): keep[keep.index(a)] = b; seen[k] = b; a, b = b, a
            if b in videos and a not in videos: videos[a] = videos[b]
            videos.pop(b, None); aliases[b] = a; merged += 1; log.append(f"merged duplicate: {b} -> {a}")
        else: seen[k] = n; keep.append(n)
    names = keep
    # 3) tidy aliases: never alias a real name, never point at a missing name, never self
    nameset = set(names)
    aliases = {k: v for k, v in aliases.items() if k != v and k not in nameset and v in nameset}
    names.sort(key=lambda s: s.lower())
    log.append(f"result: {len(names)} names, {len(videos)} videos, {len(aliases)} aliases, {merged} duplicates merged")
    print("\n".join(log))
    if not dry: dump(head, names, videos, aliases)
main()
