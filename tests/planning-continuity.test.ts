import test from "node:test";
import assert from "node:assert/strict";
import { savedPlanningFallback } from "../lib/planning-continuity";
import { fallbackAnalysis } from "../lib/planner";
import { applyCustomerAnswers } from "../lib/job-intelligence";

test("an AI outage preserves the last architecture and applies the new confirmed answer", () => {
  const request = "Prepare a room for a community event.";
  const previous = fallbackAnalysis(request);
  previous.tasks = ["Assess the room", "Arrange the event space", "Verify safe access"];
  previous.understoodFacts = ["Twenty guests; existing furniture stays in the room"];
  previous.extractedAnswers = { guest_count: "20", customer_help: false };
  previous.questions = [{
    id: "event_access", label: "Is the entrance accessible?", type: "boolean", required: true,
  }];
  const stored = structuredClone(previous);
  const fallback = savedPlanningFallback(previous, request);
  assert.ok(fallback);
  const continued = applyCustomerAnswers(fallback, { event_access: true });
  assert.deepEqual(continued.tasks, previous.tasks);
  assert.equal(continued.extractedAnswers.guest_count, "20");
  assert.equal(continued.extractedAnswers.customer_help, false);
  assert.equal(continued.extractedAnswers.event_access, true);
  assert.ok(continued.understoodFacts.includes(previous.understoodFacts[0]));
  assert.ok(!continued.questions.some(question => question.id === "event_access"));
  assert.deepEqual(previous, stored, "Continuing a plan must not mutate its saved snapshot.");
});

test("missing or incomplete snapshots fall back to normal first-intake planning", () => {
  assert.equal(savedPlanningFallback(null, "A request"), null);
  assert.equal(savedPlanningFallback({ tasks: [] }, "A request"), null);
});

test("packaging destination is requested only when removal has not been declined", () => {
  const analysis = fallbackAnalysis("Assemble a desk and move boxes into the garage.");
  analysis.questions = [
    { id: "packaging_removal", label: "Remove packaging?", type: "boolean", required: true },
    { id: "packaging_destination", label: "Where should the packaging go?", type: "text", required: true },
    { id: "schedule", label: "When should the work happen?", type: "text", required: true },
  ];
  const declined = applyCustomerAnswers(analysis, { packaging_removal: false });
  assert.ok(!declined.questions.some(question => question.id === "packaging_destination"));
  assert.ok(declined.questions.some(question => question.id === "schedule"));
  assert.ok(applyCustomerAnswers(analysis, { packaging_removal: true }).questions
    .some(question => question.id === "packaging_destination"));
});
