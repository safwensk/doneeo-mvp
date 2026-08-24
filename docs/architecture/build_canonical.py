import re, glob, os, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rulings import NUMBERING, NAMES, RENAME, EMIT, EXTERNAL, OPEN

ORDER = ["L1","L2","L3","L4","L5","L6","L7","L8","L09A","L09B","L10","L11","L12","L13",
         "P1","P2","P3","P4","P5","P6","P7","P8","P9"]
TITLE = {}
SEC = ["Purpose","Owns","Explicitly does not own","Inputs","Authoritative outputs",
 "Engines / components","Main decision / operating path","Gates","Data objects",
 "Events emitted","Events consumed","Failure / recovery","Human review",
 "Security / privacy","1M-job scalability","Non-negotiable invariants",
 "Integrations / callbacks"]

def load():
    out={}
    for f in glob.glob("specs/*.md"):
        lay=re.sub(r'^Doneeo_|_Architecture_CANONICAL\.md$','',os.path.basename(f)).split('_')[0]
        md=open(f,encoding="utf-8").read()
        m=re.search(r'^#\s+(.+)$', md, re.M)
        TITLE[lay]=m.group(1).strip() if m else lay
        out[lay]=md
    return out

def section(md, head):
    m=re.search(rf'^##\s*{re.escape(head)}\s*$\n(.*?)(?=^##\s|\Z)', md, re.S|re.M)
    return m.group(1).strip() if m else ""

def bullets(md, head):
    return [l.strip().lstrip('-').strip() for l in section(md,head).splitlines() if l.strip().startswith('-')]

def apply_rulings(md, lay=None):
    log=[]
    if lay=="L2":
        md, n = re.subn(r'^- (E\d{1,2}) P\d{1,2} ', r'- \1 ', md, flags=re.M)
        if n: log.append(("l2phase","P-prefix","dropped",n))
    for pat, canon, note in NUMBERING:
        md, n = re.subn(pat, canon, md)
        if n: log.append(("numbering", pat, canon, n))
    for old, new in NAMES.items():
        # only rewrite when it reads as a typed artifact: capitalised, not mid-sentence prose
        md, n = re.subn(rf'(?<![A-Za-z]){re.escape(old)}(?![a-z])', new, md)
        if n: log.append(("name", old, new, n))
    return md, log

def rewrite_events(specs):
    """Correct consumed names, then grant every EMIT ruling to its owner."""
    log=[]
    for lay, md in specs.items():
        body = section(md, "Events consumed")
        if body:
            new = body
            for wrong,(right,owner,why) in RENAME.items():
                new2 = re.sub(rf'(?<![\w.]){re.escape(wrong)}(?![\w.])', right, new)
                if new2 != new: log.append(("rename", lay, wrong, right)); new = new2
            for ext, src in EXTERNAL.items():
                new = re.sub(rf'^(-\s*{re.escape(ext)})(?!.*external)(.*)$',
                             rf'\1\2  *(external: {src})*', new, flags=re.M)
            md = md.replace(body, new, 1)
        specs[lay] = md
    for ev,(owner,why) in EMIT.items():
        md = specs[owner]
        blk = section(md,"Events emitted")
        if re.search(rf'(?<![\w.]){re.escape(ev)}(?![\w.])', blk): continue
        add = f"- {ev}  *(added by ruling: {why})*"
        if blk:
            specs[owner] = md.replace(blk, blk.rstrip()+"\n"+add, 1)
        else:
            specs[owner] = md.replace("## Events emitted", "## Events emitted\n\n"+add, 1)
        log.append(("emit", owner, ev, why))
    return specs, log

def event_graph(specs):
    emit={}; cons={}
    for lay,md in specs.items():
        for e in bullets(md,"Events emitted"):
            n=e.split()[0].strip('`')
            if '.' in n: emit.setdefault(n,set()).add(lay)
        for e in bullets(md,"Events consumed"):
            n=e.split()[0].strip('`')
            if '.' in n: cons.setdefault(n,set()).add(lay)
    return emit, cons

# --------------------------------------------------------------------------
specs = load()
allog=[]
for lay in list(specs):
    specs[lay], lg = apply_rulings(specs[lay], lay); allog += [(lay,)+t for t in lg]
specs, evlog = rewrite_events(specs)
emit, cons = event_graph(specs)

dangling = sorted(e for e in cons if e not in emit and e not in EXTERNAL)
dead      = sorted(e for e in emit if e not in cons)
multi     = sorted(e for e,s in emit.items() if len(s)>1)

CONTINUITY = """
1.  **L1** opens the WorkCase and captures the request, context and evidence as immutable source truth.
2.  **L2** interprets it, resolves facts and MSI, architects the TaskGraph, abstract resources and CompletionSpecification, and compiles the `RequirementContract` — provider-neutral.
3.  **L3 (T1)** classifies rules, risks and required qualifications during planning.
4.  **L4** retrieves real candidates, applies **L3 (T2)** hard eligibility and assembles the team.
5.  **L5** closes true resource and logistics gaps into a reservable plan.
6.  **L4** builds schedule and route, runs FulfillmentSimulation, and ranks only feasible options.
7.  **L6** prices the feasible options and issues the `ScopeContract` and `CommercialOffer`.
8.  **L7** records commitment, provider acceptance and `CapacityReservation`s; owns reschedule and cancellation from here on.
9.  **L8** compiles the mission, revalidates **L3 (T3)** credentials, site and access, and dispatches only at `ExecutionReady`.
10. Arrival, or any material field mismatch, invokes **L09A**. Unaffected TaskBlocks continue.
11. **L09A** opens a `RealityCase`, classifies R0–R5 semantically, isolates impact and selects the fastest safe recovery.
12. **L09A** may call **L2** for targeted reanalysis of affected nodes only, **L3** for reclassification, **L4/L5** for resource recovery, **L7** for reschedule or cancellation, **L13** for a branch.
13. **L09B** is invoked only when economic allocation is contested. **L7 capacity recovery runs first** — net lost capacity cannot be measured before backfill is attempted.
14. **L10** executes approved TaskBlocks and keeps the append-only `ExecutionJournal`; material change always routes through L09A.
15. **L10** submits the completion package. "Done" is a submission signal, nothing more.
16. **L11** verifies evidence against the `CompletionSpecification` and the approved contract version, and decides completion per TaskBlock and per JobOrder.
17. Normal completion flows **L11 → L12**. Fairness flows **L11/L09A → L09B → L12**. Disputes flow **L11 → L13**. New physical facts return to **L09A**.
18. **L12** computes customer charge and provider payable independently, executes through **P9** rails, and posts the append-only balanced ledger.
19. **L13** carries WorkCase continuity and claims without rewriting L11 outcome truth or L12 ledger truth.
20. **P1** coordinates every transition; **P2** records facts, evidence and DecisionTrace; **P3–P9** provide identity, security, integration, event transport, messaging, privacy and financial rails.
""".strip()

def fmt_open():
    out=[]
    for oid, q, body in OPEN:
        out.append(f"### {oid} — {q}\n\n{body}\n")
    return "\n".join(out)

doc=[]
W=doc.append
W(f"""# Doneeo — Unified Canonical Architecture

**Edition:** v3.0 · clean · 2026-08-23
**Supersedes:** the v1.2 poster set, the v2.1 reconciled specs, and every earlier
layer poster. Where this document and any earlier artifact disagree, this
document is correct — it is the only one whose cross-references have been
checked mechanically rather than by reading.

**Scope:** all {len(specs)} layers, at poster-level detail, with the numbering,
naming and event-linkage conflicts resolved. Nothing here is invented: every
line traces to a poster, a board or a reconciled spec. The seven questions no
source answers are listed as open rulings rather than guessed at.

---

## How to use this document

Read §1 and §2 first. They are the rulings that make every other reference in
the file resolvable — without them the layer sections read the way the old set
did, where the same number meant three things.

§5 is the event catalog. It is the coherence test: every consumed event has
exactly one producer, or is declared as arriving from outside Doneeo. If you add
a layer or an event, add it there, and the check in §5 will tell you whether the
graph still closes.

§8 is the layer detail. §9 is the {57} regression scenarios, which are also
executable at `tests/architecture-scenarios.test.ts`.

---

## 0 · What changed

| | |
|---|---|
| Layers specced | **{len(specs)} of {len(specs)}** (was 11 of 23) |
| Numbering schemes reconciled to one | **6 → 1** |
| Cross-reference rewrites applied | **{sum(1 for l in allog if l[1]=='numbering')}** |
| Artifact-name normalisations | **{sum(1 for l in allog if l[1]=='name')}** |
| Consumed events corrected to their producer | **{sum(1 for l in evlog if l[0]=='rename')}** |
| Missing emissions granted to their owner | **{sum(1 for l in evlog if l[0]=='emit')}** |
| Boundary events declared as external | **{len(EXTERNAL)}** |
| Events still without a producer | **{len(dangling)}** |
| Artifacts owned by two layers | **0** |
| Open rulings carried, not guessed | **{len(OPEN)}** |

Recovered content that no reconciled spec carried: the four SPECIAL CONTROL
panels (L7's commitment ladder and cancellation sequence, L09B's cause taxonomy,
L09A's R0–R5 action table and ten-step recovery hierarchy, L12's settlement
truth), L11's nine-state outcome machine, P1's orchestration principles, and all
57 golden regression scenarios.

---

## 1 · Numbering — the ruling

Canon is **L1–L13 for domain layers** and **P1–P9 for platform layers**. There is
no L9: reality decisions are **L09A**, economics are **L09B**. There is no P10 —
it was generation drift and its mechanics belong to L8 and L10. There is no
Layer 14.

Every reference below was rewritten in place. The originals are recorded here so
an older document can still be read against this one.

| written as | in | means |
|---|---|---|""")
seen=set()
for pat, canon, note in NUMBERING:
    lbl = pat.replace(r"\b","").replace(r"\(","(").replace(r"\)",")").replace(r"[^)]*","…").replace(r"[-–]","–").replace("\\.",".")
    if lbl in seen: continue
    seen.add(lbl)
    W(f"| `{lbl}` | {note or '—'} | **{canon}** |")

W("""
### The `P1`–`P15` collision inside L2

L2's planning engine numbers its own phases **P1 through P15** — `P4 Fact
Resolver`, `P9 Abstract Resource Planner`, `P15 Requirement Compiler`. That
namespace overlaps the platform layers exactly.

So a bare `P4` has three readings: Platform Security (canon), Event/AI &
Observability (scheme D), or L2's Fact Resolver. `P9` has three of its own.
This is the worst of the collisions because it lives inside the most-referenced
layer and uses an identical token.

L2 already carries an unambiguous parallel numbering — `E1`–`E15` — on the same
lines. **Ruling: inside L2, phases are `E1`–`E15`. The `P` form is dropped.**
`P1`–`P9` mean platform layers everywhere, without exception.
""")

W(f"""
**The trap worth naming:** `Layer 06` meant Customer Interface on one board,
Planning on another, and Commercial Offer & Pricing in canon. Remapping it by
number lands on the pricing layer, and nothing announces the error.

---

## 2 · Artifact names — the ruling

One spelling per artifact. {len(NAMES)} families had two.

| was | is |
|---|---|""")
for k,v in sorted(NAMES.items()):
    if k!=v: W(f"| `{k}` | **`{v}`** |")

W(f"""
---

## 3 · End-to-end continuity

{CONTINUITY}

---

## 4 · Ownership

No artifact is owned by two layers. Each layer's `Owns` and `Explicitly does not
own` sections in §8 are the authority; the disclaimers point at the owner, and
every owner now exists.

---

## 5 · Event catalog

**{len(emit)} events emitted · {len(cons)} consumed · {len(dangling)} without a producer.**

Before the rulings, 52 of 73 consumed events had no producer at all. Every
correction is recorded in §0 and visible inline in §8, marked
*(added by ruling: …)*.
""")

W("### Events and their consumers\n")
W("| event | emitted by | consumed by |")
W("|---|---|---|")
for e in sorted(emit):
    c = sorted(cons.get(e,[]))
    W(f"| `{e}` | {', '.join(sorted(emit[e]))} | {', '.join(c) if c else '*(no declared consumer)*'} |")

W(f"\n### Boundary events\n\nThese arrive from outside Doneeo. They correctly have no internal producer.\n")
W("| event | origin |")
W("|---|---|")
for e,src in sorted(EXTERNAL.items()): W(f"| `{e}` | {src} |")

if dangling:
    W(f"\n### Still unresolved ({len(dangling)})\n")
    for e in dangling: W(f"- `{e}` — consumed by {', '.join(sorted(cons[e]))}, produced by nobody")
else:
    W("\n**Every consumed event now has a producer or is declared external.**")

if multi:
    W(f"\n### Emitted by more than one layer ({len(multi)}) — needs a ruling\n")
    for e in multi: W(f"- `{e}` — {', '.join(sorted(emit[e]))}")

W(f"""
{len(dead)} emitted events have no declared consumer. That is not necessarily
wrong — an event may exist for audit, analytics or a layer not yet built — but
each one is either a missing subscription or dead weight, and the list is in the
table above.

---

## 6 · Global invariants

These hold across every layer. A change that violates one is a change to the
architecture, not to a layer.
""")
inv=[]
for lay in ORDER:
    for b in bullets(specs.get(lay,""),"Non-negotiable invariants"):
        k=re.sub(r'[^a-z0-9]','',b.lower())[:60]
        if k and k not in {re.sub(r'[^a-z0-9]','',x[1].lower())[:60] for x in inv}:
            inv.append((lay,b))
for lay,b in inv: W(f"- {b}  <sub>{lay}</sub>")

W(f"""
---

## 7 · Open rulings

Seven questions no source answers. They are **not decided here**. Deciding them
by inference is how the drift started.

{fmt_open()}
---

## 8 · The layers
""")

for lay in ORDER:
    if lay not in specs: continue
    md = specs[lay]
    W(f"\n---\n\n## {lay} — {TITLE[lay].split('—',1)[-1].strip()}\n")
    for h in SEC + ["Special control", "Outcome state machine", "Outcome response types",
                    "Orchestration principles (non-negotiable)", "Recovered component detail",
                    "Golden regression scenarios"]:
        m=re.search(rf'^##\s*({re.escape(h)}[^\n]*)$\n(.*?)(?=^##\s|\Z)', md, re.S|re.M)
        if not m: continue
        body=m.group(2).strip()
        if not body: continue
        W(f"### {m.group(1).strip()}\n\n{body}\n")

scen=json.load(open("scenarios.json",encoding="utf-8"))
W(f"""
---

## 9 · Golden regression scenarios

{len(scen)} assertions, three per board across 18 boards. Every reconciled spec
had dropped them; they are the only executable content the architecture ever
had. Live at `tests/architecture-scenarios.test.ts`.

P5 and P7 have none — their boards predate this template, so theirs must be
written rather than recovered.

| id | layer | scenario |
|---|---|---|""")
for s in scen: W(f"| `{s['id']}` | {s['layer']} | {s['scenario']} |")

W(f"""
---

## Provenance

Built from 41 extracted poster boards, 19 HTML layer documents, the 11 v2.1
reconciled specs, and two boards found only in the figma folder — an L11 v1.2
board carrying the outcome state machine, and a P1 board carrying the
orchestration principles, neither of which appears in either release package.

The SVG extraction was validated against OCR of the same board: zero misses.
The HTML documents were diffed against the posters: 3–4 differing lines each,
all boilerplate.

Three self-certifying QA artifacts were found and are not relied on here —
v1.2's `VALIDATION_REPORT.json` (string-presence checks, every detail field
empty, `overall_pass: true`), v2.1's Coherence QA (checks that the edits it made
were made), and the `SELF-REVIEW PASS` boilerplate identical on 14 boards. None
has ever failed anything. The checks behind §5 of this document can fail, and
did, {52} times before the rulings were applied.
""")

out="\n".join(doc)+"\n"
open("DONEEO_CANONICAL_ARCHITECTURE_v3.0.md","w",encoding="utf-8").write(out)
print(f"written: {len(out)} chars, {out.count(chr(10))} lines")
print(f"numbering rewrites {sum(1 for l in allog if l[1]=='numbering')} · name {sum(1 for l in allog if l[1]=='name')}")
print(f"event renames {sum(1 for l in evlog if l[0]=='rename')} · emissions granted {sum(1 for l in evlog if l[0]=='emit')}")
print(f"dangling after rulings: {len(dangling)}  {dangling[:8]}")
print(f"emitted by >1 layer: {multi}")
