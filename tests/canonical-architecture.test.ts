import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_ARCHITECTURE_VERSION,
  DOMAIN_LAYERS,
  PLATFORM_LAYERS,
  allowedTargetLayers,
  architecturePosition,
  canTransitionLayer,
} from "../lib/canonical-architecture";

test("the master registry contains every domain and platform layer once", () => {
  assert.equal(CANONICAL_ARCHITECTURE_VERSION, "3.0.0");
  assert.deepEqual(DOMAIN_LAYERS.map(layer => layer.id), [
    "L01", "L02", "L03", "L04", "L05", "L06", "L07",
    "L08", "L09", "L10", "L11", "L12", "L13",
  ]);
  assert.deepEqual(PLATFORM_LAYERS.map(layer => layer.id), [
    "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09",
  ]);
  assert.equal(new Set(DOMAIN_LAYERS.map(layer => layer.authoritativeArtifact)).size, 13);
});
test("continuity is sequential with explicit recovery loops", () => {
  assert.deepEqual(allowedTargetLayers("L01"), ["L02"]);
  assert.deepEqual(allowedTargetLayers("L02"), ["L03"]);
  assert.equal(canTransitionLayer("L09", "L10"), true);
  assert.equal(canTransitionLayer("L10", "L08"), true);
  assert.equal(canTransitionLayer("L10", "L03"), false);
  assert.equal(canTransitionLayer("L13", "L12"), true);
});

test("architecture position is derived from the master registry", () => {
  const position = architecturePosition("L02");
  assert.equal(position.currentLayer.title, "Intelligence & Planning");
  assert.deepEqual(position.allowedNextLayerIds, ["L03"]);
});
