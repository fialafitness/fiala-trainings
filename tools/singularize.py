# Third pass over exercises.txt: exercise nouns in the singular ("Push-up", "Squat", "Curl"), descriptors untouched.
# Usage: python3 tools/singularize.py            -> prints the proposed renames
#        python3 tools/singularize.py --write    -> rewrites exercises.txt, exercise-aliases.json, exercise-videos.json
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
names = [l.strip() for l in open(f"{ROOT}/exercises.txt", encoding="utf-8") if l.strip()]

# plural exercise nouns -> singular (lowercase; applied case-preserving to whole words, also as the tail of a hyphenated word)
SING = {
  "curls": "curl", "raises": "raise", "rows": "row", "flies": "fly", "flys": "fly", "squats": "squat", "dips": "dip", "extensions": "extension",
  "lunges": "lunge", "shrugs": "shrug", "taps": "tap", "crunches": "crunch", "rotations": "rotation", "presses": "press", "jacks": "jack",
  "crushers": "crusher", "jumps": "jump", "kicks": "kick", "pulls": "pull", "circles": "circle", "kickbacks": "kickback", "deadlifts": "deadlift",
  "hops": "hop", "lifts": "lift", "slides": "slide", "pushdowns": "pushdown", "pressdowns": "pressdown", "touches": "touch", "transitions": "transition",
  "thrusts": "thrust", "walks": "walk", "chops": "chop", "climbers": "climber", "switches": "switch", "rockers": "rocker", "punches": "punch",
  "slams": "slam", "downs": "down", "overs": "over", "outs": "out", "burpees": "burpee", "bugs": "bug", "throws": "throw", "pulldowns": "pulldown",
  "windmills": "windmill", "hydrants": "hydrant", "drops": "drop", "palloffs": "palloff", "reaches": "reach", "bounds": "bound", "planks": "plank",
  "worlds": "world", "swings": "swing", "pullovers": "pullover", "bends": "bend", "frankensteins": "frankenstein", "froggers": "frogger",
  "scoops": "scoop", "shifts": "shift", "hugs": "hug", "lowers": "lower", "twists": "twist", "throughs": "through", "tucks": "tuck", "drives": "drive",
  "boats": "boat", "mornings": "morning", "abductions": "abduction", "adductions": "adduction", "cows": "cow", "steps": "step", "stretchers": "stretcher",
  "holds": "hold", "hangs": "hang", "carries": "carry", "marches": "march", "drags": "drag", "pushes": "push", "tosses": "toss", "catches": "catch",
  "rolls": "roll", "rollouts": "rollout", "hinges": "hinge", "runs": "run", "sprints": "sprint", "leaps": "leap", "skips": "skip", "cleans": "clean",
  "snatches": "snatch", "jerks": "jerk", "bridges": "bridge", "thrusters": "thruster", "flexions": "flexion", "crossovers": "crossover",
  "walkouts": "walkout", "balls": "ball", "strikes": "strike", "dislocates": "dislocate", "pumps": "pump", "leans": "lean", "makers": "maker", "inchworms": "inchworm", "supermans": "superman", "skaters": "skater", "ups": "up", "downs": "down", "get-ups": "get-up",
  "sit-ups": "sit-up", "pull-ups": "pull-up", "push-ups": "push-up", "chin-ups": "chin-up", "v-ups": "v-up", "step-ups": "step-up", "v-crunches": "v-crunch",
  "plank-ups": "plank-up", "pull-downs": "pull-down", "push-downs": "push-down", "kick-outs": "kick-out", "walk-outs": "walk-out", "wall-walks": "wall-walk",
}
# whole-name fixes that are not plain plurals
FIX = {  # whole-name fixes (reviewed 1 Oct 2026): typos, leftover Czech, proper names, hyphenation, sentence case after a leading number
  "Elevated Romanian deadlift's": "Elevated Romanian deadlift",
  "1,5 Pull-ups": "1.5 pull-up",
  "1.5-Rep close-grip underhand pull-ups": "1.5-rep close-grip underhand pull-up",
  "45° Incline dumbbell curls (arms away from body)": "45° incline dumbbell curl (arms away from body)",
  "45° Incline dumbbell curls, arms in front of body (straddling bench)": "45° incline dumbbell curl, arms in front of body (straddling bench)",
  "Frankensteins": "Frankenstein walk",
  "Front foot eleveated split squats": "Front foot elevated split squat",
  "Half kneeling palloffs": "Half-kneeling Pallof press",
  "Standing palloffs": "Standing Pallof press",
  "Palloff press horizontal circles": "Pallof press horizontal circle",
  "Dumbbell farmer walk": "Dumbbell farmer's walk",
  "High incline comerford curls (wrists tilted down)": "High incline Comerford curl (wrists tilted down)",
  "Jump lunges with punches": "Jump lunge with punches",
  "Leaning y's": "Leaning Y raise",
  "Javelin press (EZ osa)": "Javelin press (EZ bar)",
  "Modified 21's": "Modified 21s",
  "Rings pull-ups (overhand grip)": "Ring pull-up (overhand grip)",
  "Running in place with toe taps on tire": "Running in place with toe taps on tire",
  "Seated dumbbell curls bez opory": "Seated dumbbell curl without support",
  "Single-arm seated rows – stroj": "Single-arm seated machine row",
  "Quadruped shoulder taps'": "Quadruped shoulder tap",
  "Plank knees to elbow": "Plank knee to elbow",
  "Single-arm walking dumbbell farmer\u2019s carry": "Single-arm walking dumbbell farmer's carry",
  "Sit-up + throw punches": "Sit-up with punches",
  "Sit-up punches": "Sit-up with punches",
  "Up downs": "Up-down",
  "Single-leg wall push offs": "Single-leg wall push-off",
  "Skullcrushers": "Skull crusher",
  "Scullcrusher": "Skull crusher",
  "Sledgehammer strikes on tire": "Sledgehammer strike on tire",
  "Sprinters crunch": "Sprinter crunch",
  "Stick dislocates": "Stick dislocate",
  "Straight-arm band pull aparts + hold": "Straight-arm band pull apart + hold",
  "Straight-arm forward leans on parallettes": "Straight-arm forward lean on parallettes",
  "Tucked front lever ice cream makers": "Tucked front lever ice cream maker",
  "Weighted deadbugs": "Weighted dead bug",
  "Weighted frog pumps": "Weighted frog pump",
  "Weighted jacknives": "Weighted jackknife",
  "Kick back to knees to elbows both ways": "Kickback to knees to elbows both ways",
}
FIX_WORDS = {"farmers": "farmer's"}

def fix_word(w):
  lw = w.lower()
  if lw in FIX_WORDS: new = FIX_WORDS[lw]
  elif lw in SING: new = SING[lw]
  elif "-" in lw and lw.rsplit("-", 1)[1] in SING and lw.rsplit("-", 1)[1] not in ("ups", "downs", "outs", "overs"):
    head, tail = w.rsplit("-", 1); new = head.lower() + "-" + SING[tail.lower()]
  else: return w
  # keep the original casing shape (Capitalised / UPPER / lower)
  if w.isupper(): return new.upper()
  if w[0].isupper(): return new[0].upper() + new[1:]
  return new

def singularize(name):
  if name in FIX: return FIX[name]
  return re.sub(r"[A-Za-z][A-Za-z'\-]*", lambda m: fix_word(m.group(0)), name)

alias = json.load(open(f"{ROOT}/exercise-aliases.json", encoding="utf-8"))
videos = json.load(open(f"{ROOT}/exercise-videos.json", encoding="utf-8"))
seen = {}          # lowercase new name -> canonical new name
final, renames, merged = [], {}, []
for n in names:
  s = singularize(n)
  key = s.lower()
  if key in seen:
    if s != n: merged.append((n, seen[key]))
    renames[n] = seen[key]; continue
  seen[key] = s; final.append(s)
  if s != n: renames[n] = s

if "--write" in sys.argv:
  for old, new in renames.items(): alias[old] = new
  for old, tgt in list(alias.items()):              # older aliases must point at the new spelling
    if tgt in renames: alias[old] = renames[tgt]
  alias = {o: t for o, t in alias.items() if o != t}
  newv = {}
  for k, v in videos.items():
    nk = renames.get(k, k)
    if nk not in newv: newv[nk] = v
  open(f"{ROOT}/exercises.txt", "w", encoding="utf-8").write("\n".join(final) + "\n")
  json.dump(alias, open(f"{ROOT}/exercise-aliases.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
  json.dump(dict(sorted(newv.items())), open(f"{ROOT}/exercise-videos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
  print(f"wrote {len(final)} names, {len(alias)} aliases, {len(newv)} videos")
else:
  for old, new in renames.items(): print(f"{old}  ->  {new}")
  print(f"\n{len(renames)} renames ({len(merged)} merge into an existing name), {len(final)} names after")
  for old, into in merged: print("   merge:", old, "->", into)
