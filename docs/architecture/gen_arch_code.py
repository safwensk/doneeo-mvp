"""
Emit the canonical architecture into the codebase as TypeScript.

The point is not documentation. It is that after this runs, the architecture is
something `tsc` and `node --test` can check. An event with no producer, an
artifact owned twice, or a layer claiming a module that does not exist becomes a
failing test rather than a paragraph nobody re-reads.

Regenerate after any ruling change so document, boards and code move together.
"""
import re, os, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rulings import NUMBERING, NAMES, EMIT, EXTERNAL, RENAME, OPEN

OUT = "/home/claude/s12/repo/lib/architecture"
ORDER = ["L1","L2","L3","L4","L5","L6","L7","L8","L09A","L09B","L10","L11","L12","L13",
         "P1","P2","P3","P4","P5","P6","P7","P8","P9"]

# Which real modules implement which layer. Anything not listed is PLANNED.
# The conformance test asserts every path here exists, so this cannot rot quietly.
IMPL = {
 "L1": ["lib/work-case.ts","lib/application/work-case-service.ts",
        "lib/application/work-case-store.ts","lib/application/d1-work-case-store.ts"],
 "L2": ["lib/planner.ts","lib/job-intelligence.ts","lib/work-ontology.ts",
        "lib/household-catalog.ts","lib/intelligence-task-identity.ts",
        "lib/requirement-contract.ts","lib/application/requirement-contract-service.ts",
        "lib/application/requirement-contract-store.ts",
        "lib/application/d1-requirement-contract-store.ts",
        "lib/application/requirement-contract-projection.ts",
        "lib/application/requirement-contract-hashing.ts"],
 "L3": ["lib/rules-gate.ts"],
 "L4": ["lib/work-orders.ts"],
 "L7": ["lib/layers/l7/commitment.ts","lib/layers/l7/cancellation.ts"],
 "L09A": ["lib/layers/l09a/reality.ts","lib/layers/l09a/recovery.ts"],
 "P1": ["lib/application/intelligence-control-service.ts"],
}
# Status is derived: modules present -> PARTIAL, unless listed complete here.
COMPLETE = set()

def sect(md,h):
    m=re.search(r'^##\s*'+re.escape(h)+r'[^\n]*$\n(.*?)(?=^##\s|\Z)', md, re.S|re.M)
    return m.group(1).strip() if m else ""
def bullets(md,h):
    return [re.sub(r'\s*\*\(.*?\)\*\s*$','',l.strip().lstrip('-').strip())
            for l in sect(md,h).splitlines() if l.strip().startswith('- ')]
def clean(t):
    t=re.sub(r'\*\*(.+?)\*\*',r'\1',t); t=re.sub(r'`(.+?)`',r'\1',t)
    return re.sub(r'\*(.+?)\*',r'\1',t).strip()
def apply_rulings(md, lay):
    if lay=="L2": md=re.sub(r'^- (E\d{1,2}) P\d{1,2} ', r'- \1 ', md, flags=re.M)
    for p,c,_ in NUMBERING: md=re.sub(p,c,md)
    for o,n in NAMES.items(): md=re.sub(r'(?<![A-Za-z])'+re.escape(o)+r'(?![a-z])', n, md)
    return md

specs={}; titles={}
for f in glob.glob("specs/*.md"):
    lay=re.sub(r'^Doneeo_|_Architecture_CANONICAL\.md$','',os.path.basename(f)).split('_')[0]
    md=apply_rulings(open(f,encoding="utf-8").read(), lay)
    m=re.search(r'^#\s+(.+)$', md, re.M)
    titles[lay]=(m.group(1).strip().split("—",1)[-1].strip() if m else lay)
    specs[lay]=md

# ---- event graph, with the v3.0 rulings applied ---------------------------
# The spec files are the pre-ruling source; the rulings live in rulings.py and
# must be applied here too, or the catalog silently omits all 26 granted
# emissions. The conformance suite catches that, which is how it was found.
emit={}; cons={}
for lay in ORDER:
    for e in bullets(specs[lay],"Events emitted"):
        n=clean(e).split()[0]
        if '.' in n: emit.setdefault(n, set()).add(lay)
    for e in bullets(specs[lay],"Events consumed"):
        n=clean(e).split()[0]
        if not '.' in n: continue
        if n in RENAME: n = RENAME[n][0]          # consumer named it wrongly
        cons.setdefault(n, set()).add(lay)
for ev,(owner,why) in EMIT.items():
    emit.setdefault(ev, set()).add(owner)          # producer granted by ruling
RULED = set(EMIT)

def ts(s): return s.replace("\\","\\\\").replace('"','\\"')
os.makedirs(OUT, exist_ok=True)

# ---- layers.ts -------------------------------------------------------------
L=[]
L.append('''/**
 * The 23 canonical layers, generated from the corrected architecture.
 *
 * DO NOT EDIT BY HAND. Regenerate with arch/gen_arch_code.py so that the
 * document, the boards and this file cannot disagree.
 *
 * `modules` is the claim that a layer is implemented by real files.
 * tests/architecture-conformance.test.ts asserts every path exists, so a
 * deleted or renamed module fails the suite instead of rotting silently.
 */

export type LayerId =''')
L.append("  " + " | ".join(f'"{l}"' for l in ORDER) + ";\n")
L.append('''export type LayerStatus = "IMPLEMENTED" | "PARTIAL" | "PLANNED";

export type Layer = {
  id: LayerId;
  title: string;
  kind: "domain" | "platform";
  status: LayerStatus;
  /** Repo-relative paths implementing this layer. Empty when PLANNED. */
  modules: readonly string[];
  /** Authoritative artifacts this layer owns. Exactly one owner each. */
  owns: readonly string[];
  /** Explicit disclaimers. Each points at another layer that does own it. */
  doesNotOwn: readonly string[];
  /** Invariants that hold for this layer and may not be traded away. */
  invariants: readonly string[];
};

export const LAYERS: Record<LayerId, Layer> = {''')
for lay in ORDER:
    md=specs[lay]
    mods=IMPL.get(lay,[])
    status = "IMPLEMENTED" if lay in COMPLETE else ("PARTIAL" if mods else "PLANNED")
    NL = chr(10)
    def arr(xs, n=None):
        xs=[clean(x) for x in xs][:n] if n else [clean(x) for x in xs]
        if not xs: return "[]"
        inner = "".join('      "' + ts(x) + '",' + NL for x in xs)
        return "[" + NL + inner + "    ]"
    mods_s = "[]" if not mods else "[" + NL + "".join('      "'+m+'",'+NL for m in mods) + "    ]"
    L.append(f'''  {lay}: {{
    id: "{lay}",
    title: "{ts(titles[lay])}",
    kind: "{'platform' if lay.startswith('P') else 'domain'}",
    status: "{status}",
    modules: {mods_s},
    owns: {arr(bullets(md,"Owns"))},
    doesNotOwn: {arr(bullets(md,"Explicitly does not own"))},
    invariants: {arr(bullets(md,"Non-negotiable invariants"))},
  }},''')
L.append("};\n")
L.append('''export const LAYER_IDS = Object.keys(LAYERS) as LayerId[];

export function layersImplementing(path: string): Layer[] {
  return LAYER_IDS.map(id => LAYERS[id]).filter(l => l.modules.includes(path));
}
''')
open(f"{OUT}/layers.ts","w",encoding="utf-8").write("\n".join(L))

# ---- events.ts -------------------------------------------------------------
E=[]
E.append('''/**
 * The event catalog. Generated — do not edit by hand.
 *
 * This is the coherence test the architecture never had. Before the rulings,
 * 52 of 73 consumed events had no producer anywhere in the set. Every entry
 * here now names exactly one producer, or is declared as arriving from outside
 * Doneeo. tests/architecture-conformance.test.ts enforces both.
 */

import type { LayerId } from "./layers";

export type DomainEvent = {
  name: string;
  /** The single layer authorised to emit this. */
  producer: LayerId;
  consumers: readonly LayerId[];
  /** True when the event was granted to its owner by a v3.0 ruling. */
  addedByRuling?: true;
};

export type ExternalEvent = {
  name: string;
  /** Where it enters the system from. Never produced by a Doneeo layer. */
  origin: string;
  consumers: readonly LayerId[];
};

export const EVENTS: readonly DomainEvent[] = [''')
for name in sorted(emit):
    prod = sorted(emit[name])
    c = sorted(cons.get(name,[]))
    ruled = ', addedByRuling: true' if name in RULED else ''
    cl = ", ".join('"'+x+'"' for x in c)
    E.append(f'  {{ name: "{name}", producer: "{prod[0]}", consumers: [{cl}]{ruled} }},')
E.append('];\n')
E.append('export const EXTERNAL_EVENTS: readonly ExternalEvent[] = [')
for name, origin in sorted(EXTERNAL.items()):
    c = sorted(cons.get(name,[]))
    E.append(f'  {{ name: "{name}", origin: "{ts(origin)}", consumers: [{", ".join(chr(34)+x+chr(34) for x in c)}] }},')
E.append('];\n')
E.append('''export const EVENT_NAMES = new Set(EVENTS.map(e => e.name));
export const EXTERNAL_NAMES = new Set(EXTERNAL_EVENTS.map(e => e.name));

/** Producer of an event, or null when it enters from outside Doneeo. */
export function producerOf(name: string): LayerId | null {
  return EVENTS.find(e => e.name === name)?.producer ?? null;
}
''')
open(f"{OUT}/events.ts","w",encoding="utf-8").write("\n".join(E))

# ---- open-rulings.ts -------------------------------------------------------
R=['''/**
 * Questions no source answers. Generated — do not edit by hand.
 *
 * These are carried in code deliberately. Each one is a decision that would
 * otherwise get made by accident, in an implementation, by whoever touches the
 * area first. A test asserts none has been silently dropped.
 */

export type OpenRuling = { id: string; question: string; why: string };

export const OPEN_RULINGS: readonly OpenRuling[] = [''']
for oid, q, body in OPEN:
    R.append(f'  {{ id: "{oid}", question: "{ts(q)}",\n    why: "{ts(re.sub(chr(10)," ",body))}" }},')
R.append('];\n')
open(f"{OUT}/open-rulings.ts","w",encoding="utf-8").write("\n".join(R))

print(f"layers.ts   {len(ORDER)} layers, {sum(1 for l in ORDER if IMPL.get(l))} with modules")
print(f"events.ts   {len(emit)} domain events, {len(EXTERNAL)} external")
print(f"open-rulings.ts  {len(OPEN)} carried")
