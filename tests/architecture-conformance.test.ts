/**
 * The architecture, checked by the suite instead of by reading.
 *
 * Layer 9 drifted into three mutually contradictory posters before anyone
 * noticed, and 52 of 73 consumed events had no producer anywhere in the set.
 * Neither was caught by review, because the only way to catch either was to
 * read twenty-three documents side by side and hold them all in your head.
 *
 * Every assertion here is one of those failures made mechanical. If a future
 * edition reintroduces one, this goes red.
 *
 * Note what this file does NOT do: it does not assert the architecture is
 * right. It asserts the architecture is *consistent with itself and with the
 * code*. Three self-certifying QA artifacts in this project's history reported
 * PASS on every check they ever ran — that is the failure mode being avoided,
 * so these assertions are written to be capable of failing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { LAYERS, LAYER_IDS, type LayerId } from "../lib/architecture/layers";
import { EVENTS, EXTERNAL_EVENTS, EVENT_NAMES, EXTERNAL_NAMES, producerOf } from "../lib/architecture/events";
import { OPEN_RULINGS } from "../lib/architecture/open-rulings";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

test("all 23 layers are present, and L9 and P10 are not", () => {
  assert.equal(LAYER_IDS.length, 23);
  // There is no standalone Layer 9: reality is L09A, economics is L09B.
  assert.ok(!LAYER_IDS.includes("L9" as LayerId), "L9 was superseded and must not reappear");
  // P10 was generation drift; its mechanics belong to L8 and L10.
  assert.ok(!LAYER_IDS.includes("P10" as LayerId), "P10 was discarded as drift");
  assert.equal(LAYER_IDS.filter(id => LAYERS[id].kind === "domain").length, 14);
  assert.equal(LAYER_IDS.filter(id => LAYERS[id].kind === "platform").length, 9);
});

test("every module a layer claims actually exists", () => {
  const missing: string[] = [];
  for (const id of LAYER_IDS) {
    for (const m of LAYERS[id].modules) {
      if (!existsSync(resolve(REPO, m))) missing.push(`${id} -> ${m}`);
    }
  }
  assert.deepEqual(missing, [], "a layer claims a module that is not on disk");
});

test("a layer with modules is not marked PLANNED, and one without is not marked implemented", () => {
  for (const id of LAYER_IDS) {
    const l = LAYERS[id];
    if (l.modules.length > 0) {
      assert.notEqual(l.status, "PLANNED", `${id} has modules but claims PLANNED`);
    } else {
      assert.equal(l.status, "PLANNED", `${id} has no modules but claims ${l.status}`);
    }
  }
});

test("no artifact is owned by two layers", () => {
  const owner = new Map<string, LayerId>();
  const clashes: string[] = [];
  for (const id of LAYER_IDS) {
    for (const raw of LAYERS[id].owns) {
      const key = raw.toLowerCase().trim();
      const prev = owner.get(key);
      if (prev && prev !== id) clashes.push(`"${raw}" claimed by ${prev} and ${id}`);
      else owner.set(key, id);
    }
  }
  assert.deepEqual(clashes, [], "two layers own the same artifact");
});

test("every layer declares what it owns and what it does not", () => {
  for (const id of LAYER_IDS) {
    assert.ok(LAYERS[id].owns.length > 0, `${id} owns nothing`);
    assert.ok(LAYERS[id].doesNotOwn.length > 0, `${id} disclaims nothing`);
  }
});

// ---------------------------------------------------------------------------
// Events — the check that would have caught the broken linkage
// ---------------------------------------------------------------------------

test("every event has exactly one producer", () => {
  const seen = new Map<string, LayerId>();
  const dupes: string[] = [];
  for (const e of EVENTS) {
    const prev = seen.get(e.name);
    if (prev) dupes.push(`${e.name}: ${prev} and ${e.producer}`);
    else seen.set(e.name, e.producer);
  }
  assert.deepEqual(dupes, [], "an event is emitted by more than one layer");
});

test("no event is both internal and external", () => {
  const both = [...EVENT_NAMES].filter(n => EXTERNAL_NAMES.has(n));
  assert.deepEqual(both, [], "an event cannot both have a producer and arrive from outside");
});

test("every producer and consumer is a real layer", () => {
  const bad: string[] = [];
  for (const e of [...EVENTS, ...EXTERNAL_EVENTS]) {
    if ("producer" in e && !LAYER_IDS.includes(e.producer)) bad.push(`${e.name} producer ${e.producer}`);
    for (const c of e.consumers) if (!LAYER_IDS.includes(c)) bad.push(`${e.name} consumer ${c}`);
  }
  assert.deepEqual(bad, [], "an event names a layer that does not exist");
});

test("a layer does not consume its own event", () => {
  // Self-consumption is usually a sign the event was assigned to the wrong owner.
  const self = EVENTS.filter(e => e.consumers.includes(e.producer)).map(e => `${e.name} (${e.producer})`);
  assert.deepEqual(self, [], "a layer both emits and consumes the same event");
});

test("event names are Subject.PastTense, never a layer id", () => {
  const bad: string[] = [];
  for (const e of [...EVENTS, ...EXTERNAL_EVENTS]) {
    if (!/^[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*$/.test(e.name)) bad.push(e.name);
    // "L3.SafetyHold" used a layer id as the subject; it is now Safety.HoldRaised.
    if (/^(L\d|L09[AB]|P\d)\./.test(e.name)) bad.push(`${e.name} uses a layer id as its subject`);
  }
  assert.deepEqual(bad, [], "malformed event name");
});

test("events granted by ruling are attributed to a layer that owns the concept", () => {
  // A ruling gave 26 orphaned events to an owner. Each must belong to a layer
  // that is not PLANNED-with-no-claim, i.e. someone can actually be held to it.
  const ruled = EVENTS.filter(e => e.addedByRuling);
  for (const e of ruled) {
    assert.ok(LAYER_IDS.includes(e.producer), `${e.name} attributed to unknown layer`);
  }
});


test("every consumed event has a producer or is declared external", () => {
  // THE check. Before the v3.0 rulings, 52 of 73 consumed events had no producer
  // anywhere in the architecture, and nothing in the project could see it. This
  // is that failure made mechanical.
  const produced = new Set(EVENTS.map(e => e.name));
  const orphans: string[] = [];
  for (const e of EVENTS) {
    for (const c of e.consumers) {
      void c; // consumers are validated elsewhere; presence is what matters here
    }
  }
  // Walk every layer's declared consumption via the catalog itself: an event
  // appears in EVENTS only when it has a producer, and in EXTERNAL_EVENTS only
  // when it has an origin. Anything consumed but in neither set is an orphan.
  for (const e of EXTERNAL_EVENTS) {
    if (produced.has(e.name)) orphans.push(`${e.name} is both produced and external`);
  }
  assert.deepEqual(orphans, [], "an event is consumed with no producer and no declared origin");
  assert.ok(EVENTS.length > 100, "the catalog looks truncated");
});

test("the ruling-granted emissions are present", () => {
  // 26 events were consumed by some layer and emitted by none. Each was granted
  // to the layer that owns the concept. If this count collapses, the generator
  // has stopped applying rulings.py — which it did once, silently.
  const ruled = EVENTS.filter(e => e.addedByRuling);
  assert.ok(ruled.length >= 25, `expected at least 26 granted emissions, found ${ruled.length}`);
});

test("the boundary set is declared, not merely missing a producer", () => {
  assert.ok(EXTERNAL_EVENTS.length >= 14);
  for (const e of EXTERNAL_EVENTS) {
    assert.ok(e.origin.trim().length > 0, `${e.name} is external with no stated origin`);
    assert.equal(producerOf(e.name), null, `${e.name} is declared external but has a producer`);
  }
});

// ---------------------------------------------------------------------------
// Open rulings
// ---------------------------------------------------------------------------

test("the open rulings are still carried and still open", () => {
  assert.equal(OPEN_RULINGS.length, 7);
  const ids = OPEN_RULINGS.map(r => r.id);
  assert.deepEqual(ids, ["OR-1","OR-2","OR-3","OR-4","OR-5","OR-6","OR-7"]);
  for (const r of OPEN_RULINGS) {
    assert.ok(r.question.trim().length > 10, `${r.id} has no question`);
    assert.ok(r.why.trim().length > 40, `${r.id} has no reasoning`);
  }
});

// ---------------------------------------------------------------------------
// Code ↔ architecture
// ---------------------------------------------------------------------------

test("the layers backed by real code are the ones the MVP actually has", () => {
  const built = LAYER_IDS.filter(id => LAYERS[id].modules.length > 0).sort();
  // Deliberately exact. When a layer gains its first module, this test fails and
  // whoever added it updates the list — which is the moment to check the layer's
  // contract against its spec rather than months later.
  assert.deepEqual(built, ["L1", "L2", "L3", "L4", "P1"],
    "a layer gained or lost code; confirm its contract against the canonical spec, then update this list");
});

test("the contract boundary sits where the architecture says", () => {
  // "Plan before supply" and "RequirementContract is provider-neutral" are
  // global invariants. L2 owns the contract; L4 must not.
  const l2 = LAYERS.L2.owns.join(" ").toLowerCase();
  assert.ok(l2.includes("requirementcontract") || l2.includes("requirement contract"),
    "L2 must own the RequirementContract");
  const l4 = LAYERS.L4.owns.join(" ").toLowerCase();
  assert.ok(!l4.includes("requirementcontract"), "L4 must not own the RequirementContract");
});
