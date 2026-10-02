# Add the "3 | Body Type Protocols" e-books (Lean Type, Muscle Type) to webapp/templates.json.
# Text comes from PDFKit (tools/pdfstr.swift, compiled on demand) because the pages are nested templates pypdf cannot read.
import glob, json, os, re, subprocess, sys, tempfile, unicodedata, uuid
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from singularize import singularize
import openpyxl
SRC = os.path.join(os.path.dirname(ROOT), "Exercise database F5", "3 | Body Type Protocols")
MASTER = os.path.join(os.path.dirname(ROOT), "Exercise database F5", "Exercise_Database.xlsx")
NS = uuid.UUID("6f6b9900-0000-4000-8000-000000000000")
BOOKS = [("Lean Type", "1 | Lean Type/Lean_Type_Unlocked.pdf"), ("Muscle Type", "2 | Muscle Type/Muscle_Type_Unlocked.pdf")]

# ---------- text ----------
def pdf_text(path):
  tmp = tempfile.gettempdir(); exe = os.path.join(tmp, "fiala-pdfstr")
  if not os.path.exists(exe): subprocess.run(["swiftc", "-O", "-o", exe, os.path.join(ROOT, "tools", "pdfstr.swift")], check=True, capture_output=True)
  out = os.path.join(tmp, "fiala-pdf-" + str(abs(hash(path))) + ".txt")
  subprocess.run([exe, path, out], check=True, capture_output=True)
  return open(out, encoding="utf-8").read()

# ---------- names (same pipeline as the Odboj import) ----------
names = [l.strip() for l in open(f"{ROOT}/exercises.txt", encoding="utf-8") if l.strip()]
alias = json.load(open(f"{ROOT}/exercise-aliases.json", encoding="utf-8"))
def squash(s): return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())
def fold(s): return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
def squash_cz(s): return re.sub(r"[^a-z0-9]+", "", fold(str(s or "")).lower())
by_key = {squash(n): n for n in names}
ABBR = [(r"\bDB\b", "dumbbell"), (r"\bBB\b", "barbell"), (r"\bKB\b", "kettlebell"), (r"\bCG\b", "close-grip"), (r"\bSB\b", "stability ball"), (r"\bMB\b", "medicine ball"),
        (r"\bBW\b", "bodyweight"), (r"\bBTN\b", "behind-the-neck"), (r"\bBSS\b", "Bulgarian split squat"), (r"\bflyes\b", "fly"), (r"\bflys\b", "fly"), (r"\bchinups?\b", "chin-up"),
        (r"\bpullups?\b", "pull-up"), (r"\bpushups?\b", "push-up"), (r"\bsitups?\b", "sit-up"), (r"\bLaying\b", "Lying"), (r"\blaying\b", "lying"), (r"\bbent over\b", "bent-over"), (r"\bone arm\b", "single-arm"),
        (r"\bnadhmatem\b|\bnadhmat\b", "overhand grip"), (r"\bpodhmatem\b|\bpodhmat\b", "underhand grip"), (r"\bShyb\b|\bshyb\b", "pull-up"), (r"\bKliky\b|\bkliky\b", "push-up"),
        (r"\bstroj\b", "machine"), (r"\bv sedě\b", "seated"), (r"\bve stoje\b", "standing"), (r"\bv předklonu\b", "bent-over"), (r"\bs jednoručkami\b", "dumbbell"), (r"\bna spodní kladce\b", "low cable")]
def expand(s):
  for pat, to in ABBR: s = re.sub(pat, to, s, flags=re.I if to.islower() else 0)
  return s
def canon(en):
  s = str(en or "").strip()
  if not s: return None
  for cand in (s, alias.get(s), expand(s), singularize(s), singularize(expand(s)), alias.get(singularize(expand(s)))):
    if not cand: continue
    if cand in names: return cand
    k = squash(cand)
    if k in by_key: return by_key[k]
  k = squash(expand(s))
  for cand in (k[:-1] if k.endswith("s") else k + "s", k[:-2] if k.endswith("es") else None):
    if cand and cand in by_key: return by_key[cand]
  return None
ws = openpyxl.load_workbook(MASTER, read_only=True, data_only=True)["Master"]
orig2en = {}
for row in ws.iter_rows(min_row=2, values_only=True):
  en, orig = row[3], row[4]
  if en and orig: orig2en[squash_cz(orig)] = str(en).strip()
  if en: orig2en.setdefault(squash_cz(en), str(en).strip())
MANUAL = json.load(open(os.path.join(ROOT, "tools", "bodytype-manual.json"), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, "tools", "bodytype-manual.json")) else {}
unmapped = {}
def resolve(cz, where):
  cz = re.sub(r"\s+", " ", cz).strip(" -–")
  if cz in MANUAL: return MANUAL[cz]
  en = orig2en.get(squash_cz(cz))
  name = (canon(en) if en else None) or canon(cz)
  if not name:
    unmapped.setdefault(cz, {"en_master": en, "count": 0, "where": where})["count"] += 1
    name = en if en and not re.search(r"[áéíóúýčďěňřšťžů]", en) else cz
  return name

# ---------- words ----------
SUB = [("TLAK – EXPLOSIVE EXECUTION", "Press – explosive execution"), ("TLAK – STRENGTH EXECUTION", "Press – strength execution"), ("TLAK – STRUCTURAL EXECUTION", "Press – structural execution"),
       ("NOHY – EXPLOSIVE EXECUTION", "Legs – explosive execution"), ("NOHY – STRENGTH EXECUTION", "Legs – strength execution"), ("NOHY – STRUCTURAL EXECUTION", "Legs – structural execution"),
       ("NOHY – NEURAL + STRUCTURE", "Legs – neural + structure"), ("BENCH PRESS A MILITARY PRESS", "Bench press and military press"), ("SQUAT + DEADLIFT", "Squat + deadlift"),
       ("PRSA A BICEPS", "Chest and biceps"), ("BICEPS A TRICEPS", "Biceps and triceps"), ("BICEPS + TRICEPS", "Biceps + triceps"), ("NOHY 1", "Legs 1"), ("NOHY 2", "Legs 2"),
       ("RAMENA", "Shoulders"), ("NOHY", "Legs"), ("ZÁDA", "Back"), ("TLAK", "Press"), ("TAH", "Pull"), ("PAŽE", "Arms")]
def xsub(s):
  s = s.strip()
  for cz, en in SUB:
    if s == cz: return en
  return s.capitalize()
PHASE_NAMES = {"Lean Type": {1: "Pattern specialization", 2: "Functional strength", 3: "Absolute strength"}, "Muscle Type": {}}
SCHEME = [(r"stejná váha", "same weight"), (r"stejná", "same weight"), (r"přidávat", "add weight"), (r"ubírat", "reduce weight"), (r"\bdo\s*(\d+)\s*RM\b", r"to \1 RM"),
          (r"střední", "medium"), (r"lehký", "easy"), (r"těžký", "heavy"), (r"\bod\s+([A-H]\d?)\b", r"from \1"), (r"\bjako\s+([A-H]\d?)\b", r"same as \1"), (r"\bWave\b", "wave loading")]
def xscheme(s):
  s = s.strip()
  for pat, to in SCHEME: s = re.sub(pat, to, s, flags=re.I)
  return s
def xreps(v):
  v = re.sub(r"\s*([-–])\s*", r"\1", v.strip()); v = re.sub(r"^(\d+(?:[-–]\d+)?)\s*s$", r"\1 sec", v)
  return v
def xrest(v):
  v = v.strip(); v = re.sub(r"\s*-\s*", "-", v)
  v = re.sub(r"^(\d+(?:-\d+)?)\s*s$", r"\1 sec", v); v = re.sub(r"^(\d+)\s*min$", r"\1 min", v); v = re.sub(r"^(\d+(?:-\d+)?)$", r"\1 sec", v)
  return v
WM = re.compile(r"0LFKDO[\s\u0003]*\)LDOD")                       # the purchaser watermark, encoded, sometimes lands inside a line
SETS = r"\d+(?:-\d+)?"
REPS = r"(?:(?:\d+(?:\s*[-–]\s*\d+)?|MAX|max|AMRAP)(?:\s*[+/,]\s*(?:\d+(?:\s*[-–]\s*\d+)?|MAX|max))*(?:(?<=,\s\d)\s\d+|(?<=,\s\d\d)\s\d+)?)(?:\s*(?:s|sec|min|m|km))?"
TEMPO = r"(?:[0-9X]{3,5}|normální|Max|max|\d+(?:\s*-\s*\d+)?\s*%|\d+(?:\s*-\s*\d+)?\s*s(?:\s*\+\s*X)?)"
VAHA = r"(?:(?:Přidávat|přidávat|Stejná(?:\s+váha)?|stejná|BW(?:\s*/\s*(?:stejná|DB)?|\s*\+\s*band)?|Ramping|Wave|Střední|střední|Lehký|lehký|Těžký|těžký|Max|max|Ubírat|ubírat|\d+(?:\s*-\s*\d+)?\s*kg|Od\s+\d+\s*%)(?:\s+(?:od\s+|jako\s+)?[A-H]\d?(?![\w%]))?)"
PAUZA = r"\d+(?:\s*-\s*\d+)?(?:\s*(?:s|sec|min))?"
TAIL = re.compile(r"(?<![\w-])(?P<sets>" + SETS + r")\s+(?P<reps>" + REPS + r")\s+(?:(?P<tempo>" + TEMPO + r")\s+(?P<vaha>" + VAHA + r")|(?P<vaha2>" + VAHA + r")\s+(?P<tempo2>" + TEMPO + r"))\s+(?P<pauza>" + PAUZA + r")(?=\s|$)(?P<suffix>\s+(?:od|jako)\s+[A-H]\d?|\s+přidávat)?")
LABEL = re.compile(r"^([A-H])(\d?)\s+(.*)$")
def label_of(letter, digit): return str(ord(letter) - 64) + (chr(96 + int(digit)) if digit else "")
def is_label(line, have_rows):
  lm = LABEL.match(line)
  if not lm: return None
  rest = lm.group(3)
  if lm.group(2): return lm                                   # A1, B2: always a row
  if re.match(r"^[A-Z0-9(]", rest) and len(rest.split()) <= 12: return lm   # "B DB Walking lunges 3 ..." but not "A při přítahu ..."
  return None

def split_row(label, lines):
  lines = [re.sub(r"\s+", " ", WM.sub("", l)).strip() for l in lines]; lines = [l for l in lines if l]
  text = " ".join(lines)
  m = TAIL.search(text)
  if not m: return {"label": label, "cz": text, "sets": "", "reps": "", "tempo": "", "vaha": "", "rest": "", "note": ""}
  name = text[:m.start()].strip(" -–")
  pos = 0; tail_line = 0
  for i, l in enumerate(lines):                      # which line holds the numbers
    if pos + len(l) >= m.end() - 1: tail_line = i; break
    pos += len(l) + 1
  rest_lines = lines[tail_line + 1:]
  same = text[m.end():].strip()
  if rest_lines: same = same[:max(0, len(same) - len(" ".join(rest_lines)))].strip()
  skip = ("od", "jako", "přidávat")
  lowerish = lambda s: re.match(r"^[a-záéíóúýčďěňřšťžů(\-–]", s) is not None
  cont = []
  if same and lowerish(same.split(" ")[0]) and same.split(" ")[0] not in skip:
    toks = same.split(" ")
    while toks and lowerish(toks[0]) and toks[0] not in skip: cont.append(toks.pop(0))
    same = " ".join(toks)
  k = 0
  PREP = ("na", "s", "se", "v", "ve", "k", "ke", "do", "z", "od", "o", "a", "with", "on", "from", "to", "in", "for", "at", "of", "and", "+")
  TAILWORDS = {"DL", "Frenchpress", "French-press", "press", "squats", "squat", "deadlift", "rows", "row", "curls", "curl", "raises", "raise", "pulldown", "pulldowns"}
  while k < len(rest_lines):                           # the wrapped rest of a long name sits right after the numbers
    l = rest_lines[k]; cur = (name + " " + " ".join(cont)).strip()
    dangling = cur.endswith("-") or cur.split(" ")[-1].lower() in PREP
    if (lowerish(l) or dangling or l in TAILWORDS) and not re.match(r"^(od|jako)\s", l) and not l.endswith("."): cont.append(l); k += 1
    else: break
  if cont: name = (name + ("" if name.endswith("-") else " ") + " ".join(cont)).strip()
  note = " ".join(([same] if same else []) + rest_lines[k:]).strip()
  vaha = (m.group("vaha") or m.group("vaha2")) + (m.group("suffix") or "")
  return {"label": label, "cz": name, "sets": m.group("sets"), "reps": m.group("reps"), "tempo": m.group("tempo") or m.group("tempo2"), "vaha": vaha, "rest": m.group("pauza"), "note": note}

# ---------- parse ----------
out, notes_cz = [], {}
for book, rel in BOOKS:
  text = pdf_text(os.path.join(SRC, rel))
  phase = week = 0; cur = None; buf = None   # buf = [label, lines]
  def close():
    global buf
    if buf is not None and cur is not None: cur["rows"].append(split_row(buf[0], buf[1]))
    buf = None
  for raw in text.splitlines():
    line = WM.sub("", raw).strip()
    if not line or line.startswith("=== PAGE") or line.startswith("PERFORMANCE TRAINING |") or line == "Michal Fiala" or re.match(r"^\d+ \d+$", line): continue
    m = re.match(r"^F[áÁ]ze\s*(\d+)\s*:\s*T[ÝY]DEN\s*(\d+)$", line, re.I)
    if m and not line.isupper(): close(); phase, week = int(m.group(1)), int(m.group(2)); continue
    m = re.match(r"^TRÉNINK\s*(\d+)\s*[–-]\s*(.+)$", line)
    if m and phase:
      close(); n = int(m.group(1)); key = f"{book}/{phase}/{week}/{n}"
      cur = {"id": str(uuid.uuid5(NS, key)), "program": book, "phase": phase, "phaseName": PHASE_NAMES[book].get(phase, ""), "stage": week, "n": n, "sub": xsub(m.group(2)), "src": rel.split("/")[-1], "rows": []}
      out.append(cur); continue
    if cur is None: continue
    if re.match(r"^CVIK\s+SÉRIE", line): continue
    if re.match(r"^(LEAN|MUSCLE) TYPE: FÁZE", line) or re.match(r"^FÁZE \d", line): close(); cur = None; continue
    lm = is_label(line, bool(cur["rows"]))
    if lm: close(); buf = [label_of(lm.group(1), lm.group(2)), [lm.group(3)]]; continue
    if buf is not None: buf[1].append(line)
  close()

# ---------- rows -> app shape ----------
for T in out:
  rows = []
  for r in T["rows"]:
    name = resolve(r["cz"], f'{T["program"]} P{T["phase"]} S{T["stage"]} W{T["n"]}')
    sets_m = re.findall(r"\d+", r["sets"]); sets = int(sets_m[-1]) if sets_m else 3
    bits = []
    if len(sets_m) > 1: bits.append(f"{r['sets']} sets")
    if r["vaha"]: bits.append(xscheme(r["vaha"]))
    note = " · ".join(bits)
    if r["note"]: notes_cz[r["note"]] = notes_cz.get(r["note"], 0) + 1
    if r["reps"] == "3010" and r["tempo"] == "10110": r["reps"], r["tempo"] = "6-8", "3010"   # typo in the Muscle Type book (P3 S4 W4 D); the other stages read 6-8 / 3010
    rows.append({"label": r["label"], "name": name, "sets": sets, "reps": xreps(r["reps"]), "tempo": "normal" if r["tempo"].lower() == "normální" else r["tempo"], "rest": xrest(r["rest"]), "note": note, "cue_cz": r["note"]})
  T["rows"] = rows

json.dump(out, open(os.path.join(ROOT, "tools", "bodytype-raw.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
json.dump(unmapped, open(os.path.join(ROOT, "tools", "bodytype-unmapped.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(sorted(notes_cz), open(os.path.join(ROOT, "tools", "bodytype-cues-cz.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"workouts: {len(out)} ({sum(1 for t in out if t['program']=='Lean Type')} lean, {sum(1 for t in out if t['program']=='Muscle Type')} muscle), rows: {sum(len(t['rows']) for t in out)}, unmapped: {len(unmapped)} ({sum(u['count'] for u in unmapped.values())} rows), czech cues: {len(notes_cz)}")
bad = [(t["program"], t["phase"], t["stage"], t["n"], r["label"], r["cz"] if "cz" in r else r["name"]) for t in out for r in t["rows"] if not r["sets"] or not r["rest"]]
print("rows missing numbers:", len(bad), bad[:8])
print("sizes:", sorted(set(len(t["rows"]) for t in out)))
