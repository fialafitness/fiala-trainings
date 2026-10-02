# Build webapp/templates.json from the "1 | Performance Training Odboj" PDF folder (Fat Burn / Hypertrophy / Strength).
# Names: Czech -> English via Exercise_Database.xlsx (Master: original -> English) -> current app spelling (aliases / squash match).
import glob, json, os, re, sys, uuid, unicodedata
from pypdf import PdfReader
import openpyxl
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "Exercise database F5", "1 | Performance Training Odboj")
MASTER = os.path.join(os.path.dirname(ROOT), "Exercise database F5", "Exercise_Database.xlsx")
NS = uuid.UUID("6f6b9900-0000-4000-8000-000000000000")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from singularize import singularize
names = [l.strip() for l in open(f"{ROOT}/exercises.txt", encoding="utf-8") if l.strip()]
ABBR = [(r"\bDB\b", "dumbbell"), (r"\bBB\b", "barbell"), (r"\bKB\b", "kettlebell"), (r"\bCG\b", "close-grip"), (r"\bSB\b", "stability ball"), (r"\bMB\b", "medicine ball"),
        (r"\bBW\b", "bodyweight"), (r"\bBTN\b", "behind-the-neck"), (r"\bBSS\b", "Bulgarian split squat"), (r"\bflyes\b", "fly"), (r"\bflys\b", "fly"), (r"\bchinups?\b", "chin-up"),
        (r"\bpullups?\b", "pull-up"), (r"\bpushups?\b", "push-up"), (r"\bsitups?\b", "sit-up"), (r"\bLaying\b", "Lying"), (r"\blaying\b", "lying"), (r"\bbent over\b", "bent-over"), (r"\bone arm\b", "single-arm"),
        (r"\bnadhmatem\b|\bnadhmat\b", "overhand grip"), (r"\bpodhmatem\b|\bpodhmat\b", "underhand grip"), (r"\bShyb\b|\bshyb\b", "pull-up"), (r"\bKliky\b|\bkliky\b", "push-up"),
        (r"\bstroj\b", "machine"), (r"\bv sedě\b", "seated"), (r"\bve stoje\b", "standing"), (r"\bv předklonu\b", "bent-over"), (r"\bs jednoručkami\b", "dumbbell"), (r"\bna spodní kladce\b", "low cable")]
def expand(s):
  for pat, to in ABBR: s = re.sub(pat, to, s, flags=re.I if pat.startswith("\\b") and to.islower() else 0)
  return s
alias = json.load(open(f"{ROOT}/exercise-aliases.json", encoding="utf-8"))
def squash(s): return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())
by_key = {squash(n): n for n in names}
def canon(en):
  """raw English (or lightly Czech) name -> current database spelling (or None)"""
  s = str(en or "").strip()
  if not s: return None
  cands = [s, alias.get(s), expand(s), singularize(s), singularize(expand(s)), alias.get(singularize(expand(s)))]
  for cand in cands:
    if not cand: continue
    if cand in names: return cand
    k = squash(cand)
    if k in by_key: return by_key[k]
  return None
# singular/plural tolerant lookup as a last resort
def canon_loose(en):
  c = canon(en)
  if c: return c
  k = squash(en)
  for cand in (k[:-1] if k.endswith("s") else k + "s", k[:-2] if k.endswith("es") else None):
    if cand and cand in by_key: return by_key[cand]
  return None

# Master sheet: original (Czech or English) -> English
ws = openpyxl.load_workbook(MASTER, read_only=True, data_only=True)["Master"]
orig2en = {}
for row in ws.iter_rows(min_row=2, values_only=True):
  en, orig = row[3], row[4]
  if en and orig: orig2en[squash(orig)] = str(en).strip()
  if en: orig2en.setdefault(squash(en), str(en).strip())

def fold(s): return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
def squash_cz(s): return re.sub(r"[^a-z0-9]+", "", fold(str(s or "")).lower())
orig2en_f = {squash_cz(k): v for k, v in orig2en.items()}  # accent-insensitive copy

MANUAL = {  # the few names neither the master sheet nor the word rules could place
  "Shyb nadhmatem": "Pull-up", "Bicepsové zdvihy s rovným adaptérem na spodní kladce": "Low cable biceps curl (straight bar attachment)",
  "DB shrugs v sedě v předklonu": "Seated bent-over dumbbell shrug", "CG Bench-press": "Close-grip bench press", "Wide pullup BW)": "Wide-grip pull-up",
  "Chest-press stroj": "Chest press machine", "Chest-press stroj / kliky": "Chest press machine / Push-up", "Kliky": "Push-up", "Kacířské výpady": "Heretic lunge", "Výpady kacířů": "Heretic lunge",
  "Shyby neutrální úchopem": "Neutral-grip pull-up", "stahování vrchní kladky neutrálním úchopem": "Neutral-grip lat pulldown",
  "Decline CG Bench-press s řetězy": "Decline close-grip bench press with chains", "bandem": "Decline close-grip bench press with band",
  "DB Romaninan deadlift (začíná se shora)": "Dumbbell Romanian deadlift (starting from the top)", "Externí rotace s jednoručkou o koleno": "Dumbbell external rotation over knee",
}
SCHEME_WORDS = [(r"shazovací série", "drop set"), (r"stejná váha", "same weight"), (r"stejná", "same weight"), (r"přidávat", "add weight"), (r"ubírat", "reduce weight"),
  (r"lehký", "easy"), (r"střední", "medium"), (r"těžký", "heavy"), (r"vysoká", "high"), (r"odpor", "resistance"), (r"\bjako\b", "same as"), (r"\bnebo\b", "or"),
  (r"\bdo\b", "to"), (r"\bod\b", "from"), (r"\(jinak.*$", ""), (r"\bRamping\s*(\d)\s*RM\b", r"Ramping \1 RM"), (r"\bramping\s*(\d)RM\b", r"ramping \1 RM"), (r"\bDle potřeby\b", "as needed")]
def xscheme(s):
  s = str(s or "").strip()
  for pat, to in SCHEME_WORDS: s = re.sub(pat, to, s, flags=re.I)
  s = re.sub(r"(same weight)(?=[A-Z0-9])", r"\1 ", s); s = re.sub(r"\bsame weight same as\b", "same as", s)
  s = re.sub(r"(\d)\s*RM\b", r"\1 RM", s); s = re.sub(r"\s*/\s*bw\b", " or BW", s, flags=re.I)
  return re.sub(r"\s+", " ", s).strip()
TEMPO = {"normalni": "normal"}
def unit(v):
  v = str(v or "").strip()
  v = re.sub(r"^(\d+)\s*s$", r"\1 sec", v); v = re.sub(r"^(\d+)\s*min$", r"\1 min", v); v = re.sub(r"^(\d+)s$", r"\1 sec", v)
  return v
xlate_scheme = xscheme

def label_of(lab):
  m = re.match(r"^([A-Z])(\d?)$", lab); n = ord(m.group(1)) - 64
  return str(n) + (chr(96 + int(m.group(2))) if m.group(2) else "")

def parse(pdf):
  text = PdfReader(pdf).pages[0].extract_text(extraction_mode="layout")
  lines = [l.rstrip() for l in text.splitlines()]
  title = next((l.strip() for l in lines if l.strip()), "")
  rows, cur = [], None
  for l in lines[1:]:
    if not l.strip() or re.match(r"^\s*CVIK\s", l): continue
    cols = re.split(r"\s{2,}", l.strip())
    m = re.match(r"^([A-Z]\d?)\s+(.*)$", cols[0])
    if m and len(cols) >= 5:
      cur = {"label": label_of(m.group(1)), "cz": m.group(2).strip(), "sets": cols[1], "reps": cols[2], "tempo": cols[3], "scheme": cols[4] if len(cols) > 5 else "", "rest": cols[-1] if len(cols) > 5 else cols[4]}
      if len(cols) == 5: cur["scheme"], cur["rest"] = "", cols[4]
      rows.append(cur)
    elif m and len(cols) < 5:
      cur = {"label": label_of(m.group(1)), "cz": m.group(2).strip(), "sets": "", "reps": "", "tempo": "", "scheme": "", "rest": "", "partial": cols[1:]}
      rows.append(cur)
    elif cur is not None and len(cols) == 1:
      cur["cz"] = (cur["cz"] + " " + cols[0]).strip()
    elif cur is not None and cur.get("partial") is not None:
      # the numbers arrived on the continuation line
      cur["cz"] = (cur["cz"] + " " + cols[0]).strip(); rest = cols[1:]
      cur["sets"], cur["reps"], cur["tempo"] = rest[0], rest[1], rest[2]
      cur["scheme"], cur["rest"] = (rest[3], rest[4]) if len(rest) >= 5 else ("", rest[3]); cur.pop("partial", None)
    else:
      cur = None
  return title, rows

PROG = {"1 | Fat Burn": "Fat Burn", "2 | Hypertrophy": "Hypertrophy", "3 | Strength": "Strength"}
SUB = [("Zadní strana těla a břicho", "Posterior chain and abs"), ("Záda a komplex lýtka", "Back and calf complex"), ("Záda, bicepsy a tricepsy", "Back, biceps and triceps"),
       ("Komplexy: Nohy + ramena a celé tělo", "Complexes: legs, shoulders and full body"), ("Komplexy: Nohy a břicho", "Complexes: legs and abs"), ("Komplexy: Prsa a biceps", "Complexes: chest and biceps"),
       ("Komplexy: Ramena a trapézy", "Complexes: shoulders and traps"), ("Tlak (vertikální + horizontální)", "Press (vertical + horizontal)"), ("Tah 2 (volitelný)", "Pull 2 (optional)"),
       ("Intervaly - běh", "Intervals – run"), ("Intervaly - kolo", "Intervals – bike"), ("Intervaly", "Intervals"), ("Mrtvý tah", "Deadlift"), ("Military-press / Spodní trapézy", "Military press / lower traps"),
       ("Military-press / Rotátory", "Military press / rotator cuff"), ("Military-press / Dip", "Military press / dip"), ("Military-press", "Military press"), ("Bench-press / Flexory / Shyb", "Bench press / hamstrings / pull-up"),
       ("Bench-press / Flexory", "Bench press / hamstrings"), ("Bench-press + pullup", "Bench press + pull-up"), ("Bench-press a záda", "Bench press and back"), ("Bench-press", "Bench press"),
       ("Hrudník + záda", "Chest + back"), ("Prsa + záda", "Chest + back"), ("Prsa a záda", "Chest and back"), ("Ramena + bicepsy", "Shoulders + biceps"), ("Ramena + záda", "Shoulders + back"),
       ("Ramena a trapézy", "Shoulders and traps"), ("Overhead press a záda", "Overhead press and back"), ("Nohy + lýtka", "Legs + calves"), ("Stehna a lýtka", "Thighs and calves"), ("Stehna", "Thighs"),
       ("Nohy", "Legs"), ("Paže", "Arms"), ("Doplňky", "Accessories"), ("Shyb", "Pull-up"), ("Tlak + tah 2", "Press + pull 2"), ("Tlak + tah", "Press + pull"), ("Tlak", "Press"), ("Tah", "Pull"), ("Fullbody", "Full body")]
def xsub(s):
  for cz, en in SUB:
    if s == cz: return en
  return "" if re.match(r"^Tr[ée]nink\s*\d+$", s) else s
NOTE_WORDS = [(r"\bdo\s*(\d+)\s*RM\b", r"to \1 RM"), (r"\bod\s+([A-Z]\d?)\b", r"from \1"), (r"\bJako\s+([A-Z]\d?)", r"Same as \1"), (r"\bodpor\b", "resistance"), (r"\(jinak\b.*$", ""), (r"\bRamping\s*(\d)\s*RM\b", r"Ramping \1 RM"), (r"\bRamping\s*(\d)RM\b", r"Ramping \1 RM")]
def xnote(s):
  for pat, to in NOTE_WORDS: s = re.sub(pat, to, s)
  return s.strip()
def xrest(v):
  v = str(v or "").strip(); v = re.sub(r"\s*-\s*", "-", v)
  v = re.sub(r"^(\d+)\.(\d\d)\s*min$", lambda m: f"{int(m.group(1))*60+int(m.group(2))} sec", v)
  v = re.sub(r"^(\d+(?:-\d+)?)\s*[sS]$", r"\1 sec", v); v = re.sub(r"^(\d+)$", r"\1 sec", v)
  return v
out, unmapped, anomalies = [], {}, []
for pdf in sorted(glob.glob(os.path.join(SRC, "*", "*", "*", "*.pdf"))):
  rel = os.path.relpath(pdf, SRC).split(os.sep)
  prog = PROG.get(rel[0]); ph = re.search(r"(\d+)", rel[1]); wk = re.search(r"(\d+)", rel[2]); tr = re.search(r"trenink-(\d+)(?:-(\d+))?", rel[3])
  if not (prog and ph and wk and tr): anomalies.append(("path", pdf)); continue
  title, rows = parse(pdf)
  mt = re.match(r"^Tr[ée]nink\s*(\d+)\s*:\s*(.*)$", title)
  sub = mt.group(2).strip() if mt else title
  trows = []
  for r in rows:
    if r.get("partial") is not None: anomalies.append(("unfinished row", pdf, r["cz"]))
    def lookup(cz):
      cz = cz.strip()
      if cz in MANUAL: return MANUAL[cz]
      en = orig2en.get(squash(cz)) or orig2en_f.get(squash_cz(cz))
      return (canon_loose(en) if en else canon_loose(cz)) or (en if en and not re.search(r"[áéíóúýčďěňřšťžů]", en) else None)
    whole = lookup(r["cz"]); alts = []
    if whole and " / " in whole: name, alts = whole.split(" / ")[0], whole.split(" / ")[1:3]   # a manual "A / B" = exercise with an alternative
    elif whole: name = whole
    else:
      parts = [x for x in re.split(r"\s*/\s*", r["cz"]) if x.strip()]
      found = [lookup(x) for x in parts]
      if len(parts) > 1 and all(found): name, alts = found[0], found[1:3]      # "A / B" in the PDF = exercise with an alternative
      else:
        unmapped.setdefault(r["cz"], {"en_master": orig2en.get(squash(r["cz"])), "count": 0, "example": os.path.basename(pdf)})["count"] += 1
        name = r["cz"]
    sets_m = re.findall(r"\d+", r["sets"]); sets = int(sets_m[-1]) if sets_m else 3
    note = []
    if len(sets_m) > 1: note.append(f"{r['sets']} sets")
    sch = xlate_scheme(r["scheme"])
    if sch: note.append(sch)
    tempo = TEMPO.get(squash_cz(r["tempo"]), r["tempo"])
    row = {"label": r["label"], "name": name, "sets": sets, "reps": unit(r["reps"]), "tempo": tempo, "rest": xscheme(xrest(unit(r["rest"]))), "note": xnote(" · ".join(note))}
    if alts: row["alts"] = alts
    trows.append(row)
  key = f"{prog}/{ph.group(1)}/{wk.group(1)}/{tr.group(1)}"
  out.append({"id": str(uuid.uuid5(NS, key)), "program": prog, "phase": int(ph.group(1)), "stage": int(wk.group(1)), "n": int(tr.group(1)), "sub": xsub(sub), "src": os.path.basename(pdf), "rows": trows})

out.sort(key=lambda t: (list(PROG.values()).index(t["program"]), t["phase"], t["stage"], t["n"]))
json.dump(out, open(f"{ROOT}/tools/odboj-raw.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)   # tools/merge_templates.py builds templates.json
print(f"templates: {len(out)}, rows: {sum(len(t['rows']) for t in out)}, anomalies: {len(anomalies)}, unmapped names: {len(unmapped)} (rows {sum(u['count'] for u in unmapped.values())})")
json.dump(unmapped, open(f"{ROOT}/tools/odboj-unmapped.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for a in anomalies[:15]: print("  anomaly:", a)
subs = sorted(set(t["sub"] for t in out)); print("subtitles:", subs)
print("tempos:", sorted(set(r["tempo"] for t in out for r in t["rows"]))[:40])
print("schemes/notes sample:", sorted(set(r["note"] for t in out for r in t["rows"]))[:40])
print("rests:", sorted(set(r["rest"] for t in out for r in t["rows"]))[:30])
