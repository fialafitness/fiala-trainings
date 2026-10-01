# Matches the YouTube links in WP-2.2.xlsx (sheet DATA) to the cleaned exercise names in exercises.txt.
# Output: webapp/exercise-videos.json  { "Exercise name": "youtubeVideoId", ... }
import json, re, sys, openpyxl
ROOT = "/Users/michalfiala/Projects/Workout_Tracker"
ABBREV = {"db":"dumbbell","dbs":"dumbbell","bb":"barbell","kb":"kettlebell","cg":"close grip","sl":"single leg",
          "sa":"single arm","oh":"overhead","rdl":"romanian deadlift","dumbbells":"dumbbell","barbells":"barbell",
          "kettlebells":"kettlebell","alt":"alternating","banded":"band","bw":"bodyweight","mb":"medicine ball","sb":"stability ball","dl":"deadlift","laying":"lying"}
DROP = {"the","a","an","of","on","onto","with","to","position","and"}
FIX = [(r"dumbell", "dumbbell"), (r"pectorial", "pectoral"), (r"\bbicep\b", "biceps"), (r"\btricep\b", "triceps"),
       (r"\bflyes\b|\bflys\b|\bfly\b", "flies"), (r"\bpush ?ups?\b", "push up"), (r"\bpull ?ups?\b", "pull up"),
       (r"\bchin ?ups?\b", "chin up"), (r"\bsit ?ups?\b", "sit up"), (r"\bstep ?ups?\b", "step up"), (r"\bget ?ups?\b", "get up"),
       (r"\bpush ?downs?\b", "pushdown"), (r"\bpull ?downs?\b", "pulldown"), (r"\bpull ?overs?\b", "pullover"),
       (r"\bbenchpress\b", "bench press"), (r"\bbody weight\b", "bodyweight"), (r"\bone arm\b", "single arm"), (r"\bone leg\b", "single leg"),
       (r"\bdead lift", "deadlift"), (r"\bcurtsey\b", "curtsy"), (r"stiff[- ]legged", "stiff leg"), (r"jack ?kni(fe|ves)", "jackknife"),
       (r"\bpress ?downs?\b", "pressdown"), (r"\bbench press\b", "benchpress"), (r"\bface ?pull", "facepull"), (r"\bfrench press\b", "frenchpress")]
def key(name):
    s = name.lower().replace("-", " ")
    s = re.sub(r"\bw/\s*", "with ", s)
    for pat, rep in FIX: s = re.sub(pat, rep, s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    out = []
    for t in s.split():
        t = ABBREV.get(t, t)
        for p in t.split():
            p = ABBREV.get(p, p)
            if p in DROP: continue
            if re.search(r"(ch|sh|x)es$", p): p = p[:-2]
            elif len(p) >= 3 and not p.endswith(("ss", "is", "us")): p = re.sub(r"(?<=[a-z])s$", "", p)
            out.append(p)
    return out
k = lambda n: " ".join(sorted(key(n)))
final = [l.strip() for l in open(f"{ROOT}/webapp/exercises.txt", encoding="utf-8") if l.strip()]
by_key = {}
for n in final: by_key.setdefault(k(n), n)
wb = openpyxl.load_workbook(f"{ROOT}/WP-2.2.xlsx", data_only=True)
videos, miss = {}, []
for r in wb["DATA"].iter_rows(min_row=3, values_only=True):
    name, url = r[4], r[7]
    if not name or not url or "http" not in str(url): continue
    m = re.search(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})", str(url))
    if not m: continue
    toks = key(str(name)); target = by_key.get(" ".join(sorted(toks)))
    if not target:
        for variant in [sorted(set(toks) - {"barbell"}), sorted(toks + ["barbell"])]:
            target = by_key.get(" ".join(variant))
            if target: break
    if target: videos.setdefault(target, m.group(1))
    else: miss.append(str(name))
json.dump(videos, open(f"{ROOT}/webapp/exercise-videos.json", "w"), ensure_ascii=False, indent=0)
print(f"exercises with a video: {len(videos)} of {len(final)} | sheet videos unmatched: {len(miss)}")
print("unmatched sample:", miss[:8])
