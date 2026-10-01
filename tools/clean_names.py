# Second pass over exercises.txt: drop unnecessary hyphens, remove duplicates (Michal's 746 names win).
import re, json, sys, openpyxl
from difflib import SequenceMatcher
sys.path.insert(0, "/Users/michalfiala/Projects/Workout_Tracker/webapp/tools")
from match_videos import key  # same matching rules as the video matcher
ROOT = "/Users/michalfiala/Projects/Workout_Tracker"
k = lambda n: " ".join(sorted(key(n)))

# hyphens worth keeping: "-up" words, letter shapes, compound adjectives before a noun
KEEP = re.compile(r"\b(push|pull|chin|sit|step|get|v|wake|warm|tuck|pike|roll|hang|clean)-up", re.I)
KEEP_WORDS = {"close-grip","wide-grip","neutral-grip","reverse-grip","mixed-grip","single-arm","single-leg","bent-over",
              "behind-the-neck","half-kneeling","tall-kneeling","band-assisted","band-resisted","rear-foot-elevated",
              "front-foot-elevated","straight-arm","straight-leg","stiff-leg","stiff-legged","one-and-a-half","1-5","1.5-rep",
              "t-bar","l-sit","v-up","x-band","y-raise","w-raise","i-raise","t-raise","pec-deck","ez-bar","heel-elevated",
              "feet-elevated","hands-elevated","deficit-reverse","anti-rotation","cross-body","self-assisted","iso-hold",
              "touch-and-go","touch-n-go","pause-rep","dead-stop","bottom-up","top-down","side-to-side","in-and-out",
              "stir-the-pot","around-the-world","tap-ups","pop-up","pop-ups","walk-out","walk-outs"}
SPELL = [(r"face-?pull ?overhead", "face pull overhead"), (r"\bdead lift", "deadlift"), (r"\bcurtsey\b", "curtsy"),
         (r"stiff[- ]legged", "stiff leg"), (r"\bjack knife\b", "jackknife"), (r"\bjackknives\b", "jackknives"),
         (r"\bone[- ]arm\b", "single-arm"), (r"\bone[- ]leg\b", "single-leg"), (r"\bpull[- ]downs?\b", lambda m: "pulldowns" if m.group(0).endswith("s") else "pulldown"),
         (r"\bpress[- ]downs?\b", lambda m: "pressdowns" if m.group(0).endswith("s") else "pressdown"), (r"\bpush[- ]downs?\b", lambda m: "pushdowns" if m.group(0).endswith("s") else "pushdown"),
         (r"\bfrench\b", "French")]
KEEP_SUFFIX = re.compile(r"-(supported|elevated|assisted|resisted|kneeling|grip|arm|leg|legged|body|over|ups?|rotation|stop|reps?|focused|dynamic|lateral|stance)$", re.I)
def dehyphen(name):
    for pat, rep in SPELL: name = re.sub(pat, rep, name, flags=re.I)
    def fix(m):
        w = m.group(0)
        if w.lower() in KEEP_WORDS or KEEP.search(w) or KEEP_SUFFIX.search(w) or re.search(r"^\d|\d-\d|^[a-z]-|^non-|^anti-|^semi-|^pre-|^post-", w, re.I): return w
        return w.replace("-", " ")
    s = re.sub(r"[A-Za-z0-9.]+(?:-[A-Za-z0-9.]+)+", fix, name)
    s = s[:1].upper() + s[1:]
    return re.sub(r"\s+", " ", s).strip()

names = [l.strip() for l in open(f"{ROOT}/webapp/exercises.txt", encoding="utf-8") if l.strip()]
wb = openpyxl.load_workbook(f"{ROOT}/Exercise database F5/Exercise_Database.xlsx", data_only=True)
sig = lambda n: re.sub(r"\s+", " ", n.lower()).strip()
mine = {sig(dehyphen(str(r[3]))) for r in wb["Master"].iter_rows(min_row=2, values_only=True) if r[3]}

renamed = {}
cleaned = []
for n in names:
    c = dehyphen(n)
    if c != n: renamed[n] = c
    cleaned.append(c)

groups = {}
for old, c in zip(names, cleaned): groups.setdefault(k(c), []).append((c, old))
final, merged, alias = [], [], {}
for kk, items in groups.items():
    items.sort(key=lambda it: (0 if sig(it[0]) in mine else 1, len(it[0])))   # Michal's wording wins, then the shorter name
    keep = items[0][0]
    # within a group, a name that is his (same key as a 746 name) wins; otherwise the shortest
    final.append(keep)
    for c, old in items:
        if c != keep: alias[old] = keep; merged.append((keep, old))
    for c, old in items:
        if old != keep and old not in alias: alias[old] = keep
final = sorted(set(final), key=str.lower)

# fuzzy near-duplicates for review (not auto-merged)
fuzz = []
js = [(n, " ".join(key(n))) for n in final]
for i in range(len(js)):
    for j in range(i + 1, len(js)):
        a, b = js[i][1], js[j][1]
        if abs(len(a) - len(b)) > 6: continue
        r = SequenceMatcher(None, a, b).ratio()
        if r >= 0.92: fuzz.append((round(r, 2), js[i][0], js[j][0]))
fuzz.sort(reverse=True)

if "--write" in sys.argv:
    open(f"{ROOT}/webapp/exercises.txt", "w", encoding="utf-8").write("\n".join(final) + "\n")
    json.dump(alias, open(f"{ROOT}/webapp/exercise-aliases.json", "w"), ensure_ascii=False, indent=0)
print(f"names: {len(names)} -> {len(final)} | hyphens removed in {len(renamed)} | duplicate groups merged: {len(merged)}")
print("\n--- hyphen changes (sample) ---")
for o, c in list(renamed.items())[:25]: print(f"  {o}  ->  {c}")
print("\n--- merged (all) ---")
for keep, old in merged: print(f"  KEEP {keep!r:50} <- {old}")
print("\n--- fuzzy pairs to review ---")
for r, a, b in fuzz[:40]: print(f"  {r}  {a!r}  ~  {b!r}")
