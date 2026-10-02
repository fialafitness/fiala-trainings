# templates.json = Odboj workouts (already there) + Body Type workouts (tools/bodytype-raw.json) with translated cues (tools/bodytype-cues-en.json).
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(f"{ROOT}/templates.json", encoding="utf-8"))
body = json.load(open(f"{ROOT}/tools/bodytype-raw.json", encoding="utf-8"))
en = json.load(open(f"{ROOT}/tools/bodytype-cues-en.json", encoding="utf-8")) if os.path.exists(f"{ROOT}/tools/bodytype-cues-en.json") else {}
keep = json.load(open(f"{ROOT}/tools/odboj-raw.json", encoding="utf-8")) if os.path.exists(f"{ROOT}/tools/odboj-raw.json") else [t for t in T if t["program"] not in ("Lean Type", "Muscle Type")]
missing = 0
for t in body:
  for r in t["rows"]:
    cz = r.pop("cue_cz", "")
    key = re.sub(r"\s+", " ", cz).strip()
    cue = en.get(key, "") or en.get(cz, "")
    if cz and not cue: missing += 1
    r["note"] = " · ".join(x for x in (r.get("note", ""), cue) if x)
# PDF labels inside notes (A1, B2, "from A") become the app's numbering (1a, 2b, "from 1")
def relabel(s):
  s = re.sub(r"\b([A-H])(\d)\b", lambda m: str(ord(m.group(1)) - 64) + chr(96 + int(m.group(2))), s)
  return re.sub(r"\b(from|as|after|before|than)\s+([A-H])\b", lambda m: m.group(1) + " " + str(ord(m.group(2)) - 64), s)
for t in keep + body:
  for r in t["rows"]: r["note"] = relabel(r.get("note", ""))
order = {"Fat Burn": 0, "Hypertrophy": 1, "Strength": 2, "Lean Type": 3, "Muscle Type": 4}
out = sorted(keep + body, key=lambda t: (order.get(t["program"], 9), t["phase"], t["stage"], t["n"]))
json.dump(out, open(f"{ROOT}/templates.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"templates.json: {len(out)} workouts ({len(keep)} Odboj + {len(body)} Body Type), cues without translation: {missing}")
