# The numbering problem — root cause of the broken linkage

**Date:** 2026-08-23
**Status:** FINDING. No renumbering has been applied. This document records what
each poster actually says so a decision can be made once.

---

## The finding

The poster set was generated across at least **six different numbering
schemes**, and cross-references inside each poster were never normalised. A
reference like "P9" resolves to Messaging, Finance, or Payment Rails depending
on which poster you are holding, and nothing in any document says which.

This is the mechanism behind every symptom: references that do not resolve,
layers that look duplicated, seams that do not meet. The reconciliation
normalised each layer's *content* — but it dropped the `Integrations /
callbacks` section, which is the only place cross-references live. The conflict
became invisible rather than resolved.

| scheme | seen in | how it numbers |
|---|---|---|
| **A** | P4 poster | one flat `P1–P14` space: P6=Providers, P8=Task Safety, P9=Messaging, P10=Execution, P12=Settlement, P13=Claims, P14=Intelligence |
| **B** | P5 poster | `P1–P4` platform + `Layer 06–14` domain: Layer 06=Planning, Layer 10=Execution, Layer 13=Disputes, **Layer 14=Intelligence** |
| **C** | P7, P8, P9 posters | `P1–P10`: P4=Security, P6=Event/AI/Obs, P7=Messaging, P9=Finance, P10=Execution |
| **D** | v1.2 FULL_DETAIL set (18 boards) | `L1–L13` + `P1–P4`, where **P4=Event/AI/Observability** |
| **E** | v2.1 reconciled specs | `L1–L13` + `P1–P9`, where **P4=Platform Security**, **P6=Event Backbone** |
| **F** | P1 figma variant | `Layer 01–14`: 06=Customer Interface, 07=Executor Interface, 08=Execution & Monitoring, 14=Data & Intelligence |

Scheme **E** is current canon; **F** was found last and is the closest to the
original twenty-document stack. Everything else is historical.

---

## The collisions that matter

**`P4`** — Event/AI/Observability in scheme D; Platform Security in schemes C
and E. Both live in the current document set. P1's own v1.2 board consumes from
"P4 Event backbone", which under canon now points at the security layer.

**`P9`** — Messaging in scheme A; Finance in scheme C; Payment Rails in canon.

**`P6`** — Providers in scheme A; Event/AI/Observability in schemes C and E.

**`Layer 14 / P14 (Intelligence)`** — exists in schemes A and B, does not exist
in canon at all. In both old schemes Intelligence and Planning were **separate
layers**; canon merges them into L2. Anyone remapping "Layer 06 (Planning)" to
L6 lands on Commercial Offer & Pricing, which is wrong in a way that will not
announce itself.

**`P10`** — Execution in schemes A, B and C; **discarded as drift** in canon,
its mechanics moved to L8 and L10.

---

## Suggested mapping to canon (scheme E)

Not applied. Proposed for one ruling.

| old reference | scheme | canon |
|---|---|---|
| Layer 06 (Planning) | B | **L2** — not L6 |
| Layer 14 / P14 (Intelligence) | A, B | **L2** — merged with Planning |
| Layer 10 / P10 (Execution) | A, B, C | **L10** (live) and **L8** (dispatch) |
| Layer 11 (Outcome) | B | L11 |
| Layer 12 / P12 (Settlement) | A, B | L12 |
| Layer 13 / P13 (Disputes / Claims) | A, B | L13 |
| P4 (Event / AI / Observability) | D | **P6** |
| P4 (Security / Safety) | A, C, E | P4 |
| P6 (Providers) | A | **L4** — Fulfillment, Matching & Team Assembly |
| P8 (Task Safety) | A | **L3** — Trust, Safety, Rules & Compliance |
| P9 (Messaging) | A | **P7** |
| P9 (Finance) | C | **L12** settlement truth, **P9** rails only |
| P7 (Messaging) | C, E | P7 |

Two rows deserve attention because they cross the platform/domain boundary:
scheme A files **Providers** and **Task Safety** as platform layers, while canon
makes them domain layers L4 and L3. That is not a renaming — it is a different
opinion about what is cross-cutting, and it is worth being deliberate about
which one is right.

---

## Why this was invisible

Atlas's eleven specs contain no `Integrations / callbacks` section. Neither did
my own template until all ten authoring agents flagged it independently. With
that section absent from every spec, the only surviving cross-references lived
inside poster images — unreadable to any check, and unread by either of us until
the posters were extracted.

The section is now present in all 23 specs. The conflicting references are
visible, quoted verbatim, and flagged in place.

---

## Recommendation

Rule once, in a single table, and record it where both document sets point at
it. Then normalise every `Integrations / callbacks` entry to canon and add a
check that fails on any reference to `P10`, `P11`, `P12`, `P13`, `P14`,
`Layer 14`, or `Layer 06`.

Until that ruling exists, **do not implement any cross-layer contract from a
poster reference.** Read the target layer's own spec and confirm the artifact
name matches on both sides.

---

## Scheme F, found 2026-08-23

A P1 board in the figma folder — in neither package — uses a sixth scheme, and
it is the one that matches the original twenty-document stack (Customer
Interface, Executor Interface):

| Layer 01 | WorkCase & Intake | Layer 09A | Change & Recovery |
|---|---|---|---|
| Layer 02 | Intelligence & Planning | Layer 09B | Responsibility & Econ. |
| Layer 03 | Trust & Safety | Layer 11 | Outcome & Completion |
| Layer 04 | Matching & Teams | Layer 12 | Settlement & Ledger |
| Layer 05 | Fulfillment & Routing | Layer 13 | Claims & Disputes |
| **Layer 06** | **Customer Interface** | **Layer 14** | **Data & Intelligence** |
| **Layer 07** | **Executor Interface** | | |
| **Layer 08** | **Execution & Monitoring** | | |

This collides hardest with canon and with scheme B at once:

- **Layer 06** is Customer Interface here, Planning in scheme B, and Commercial
  Offer & Pricing in canon. Three different meanings for one number.
- **Layer 07** is Executor Interface here and Commitment/Cancellation in canon.
- **Layer 08** is Execution & Monitoring here and Preflight/Dispatch in canon.

Any cross-reference of the form "Layer 06/07/08" is therefore ambiguous across
three readings and cannot be resolved without knowing which board it came from.
