# Re-embed exercises.txt, exercise-videos.json and exercise-aliases.json into index.html (the NAMES / VIDEOS / ALIASES constants).
import json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = f"{ROOT}/index.html"; h = open(p, encoding="utf-8").read()
names = [l.strip() for l in open(f"{ROOT}/exercises.txt", encoding="utf-8") if l.strip()]
videos = json.load(open(f"{ROOT}/exercise-videos.json", encoding="utf-8"))
alias = json.load(open(f"{ROOT}/exercise-aliases.json", encoding="utf-8"))
def put(const, value):
  global h
  pat = re.compile(r"^(  const " + const + r" = ).*?;$", re.M)
  assert len(pat.findall(h)) == 1, const
  h = pat.sub(lambda m: m.group(1) + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + ";", h, count=1)
put("NAMES", names); put("VIDEOS", videos); put("ALIASES", alias)
open(p, "w", encoding="utf-8").write(h)
print(f"embedded {len(names)} names, {len(videos)} videos, {len(alias)} aliases")
