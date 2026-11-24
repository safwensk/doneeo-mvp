import test from "node:test";
import assert from "node:assert/strict";
import { canContinueIntake, rememberClarifications, retainKnownIntakeFacts, savedPlanningFallback } from "../lib/planning-continuity";
import { fallbackAnalysis } from "../lib/planner";
import { applyCustomerAnswers } from "../lib/job-intelligence";
import { applyDoneeoRulesGate } from "../lib/rules-gate";

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

test("facts supplied up front remove repeat intake questions and preserve the real unknown", () => {
  const analysis = fallbackAnalysis("Please clean the kitchen and two bathrooms at 100 Example Avenue in Toronto on Friday at 10 a.m. I'll be home to let the cleaner in. We have no pets. I'll provide the cleaning supplies. Please do not use bleach.");
  analysis.questions = [
    { id: "entry_method", label: "How will the cleaner enter?", type: "text", required: true },
    { id: "pet_presence", label: "Will any pets be present?", type: "boolean" },
    { id: "materials_owner", label: "Can you provide the cleaning supplies?", type: "boolean" },
    { id: "cleaning_product_restrictions", label: "Are there any products to avoid?", type: "text" },
    { id: "cleaning_depth", label: "Would you like a standard or deep clean?", type: "choice", required: true },
  ];
  const intake = retainKnownIntakeFacts(analysis, {}, []);
  assert.deepEqual(intake.questions.map(question => question.id), ["cleaning_depth"]);
  assert.equal(intake.extractedAnswers.pets, false);
  assert.match(String(intake.extractedAnswers.home_access), /let the cleaner in/);
  assert.match(String(intake.extractedAnswers.surface_notes), /bleach/);
});

test("a reworded question does not reopen a confirmed answer or facts volunteered in the reply", () => {
  const previous = fallbackAnalysis("Please clean the kitchen and bathrooms at 100 Example Avenue on Friday at 10 a.m.");
  previous.questions = [{ id: "cleaning_depth", label: "What cleaning level is needed?", type: "text", required: true }];
  const answers = { cleaning_depth: "Routine cleaning. I will let the cleaner in. We have no pets." };
  const history = rememberClarifications(previous, answers);
  const revised = { ...previous, questions: [
    { id: "depth_recheck", label: "Do you need a standard or deep clean?", type: "text" as const },
    { id: "entry_method", label: "How will the cleaner enter?", type: "text" as const },
    { id: "pet_presence", label: "Are any pets present?", type: "boolean" as const },
    { id: "large_item", label: "Which items must be moved to reach the floor?", type: "text" as const },
  ] };
  const continued = retainKnownIntakeFacts(revised, answers, history);
  assert.deepEqual(continued.questions.map(question => question.id), ["large_item"]);
  assert.equal(continued.extractedAnswers.pets, false);
  assert.deepEqual(continued.answeredQuestions, history);
});

test("a confirmed pickup detail does not suppress the same kind of question at delivery", () => {
  const previous = fallbackAnalysis("Move a sofa from 100 Example Avenue to 200 Example Road on Friday at 10 a.m.");
  previous.questions = [{ id: "stop_1_elevator", label: "Is there an elevator at pickup?", type: "boolean", required: true }];
  const answers = { stop_1_elevator: false };
  const revised = { ...previous, questions: [
    ...previous.questions,
    { id: "stop_2_elevator", label: "Is there an elevator at delivery?", type: "boolean" as const, required: true },
  ] };
  const intake = retainKnownIntakeFacts(revised, answers, rememberClarifications(previous, answers));
  assert.deepEqual(intake.questions.map(question => question.id), ["stop_2_elevator"]);
});

test("reuse the saved queue for an ordinary answer, but reevaluate scope changes and completed intake", () => {
  const previous = fallbackAnalysis("Clean the kitchen at 100 Example Avenue on Friday at 10 a.m.");
  previous.questions = [
    { id: "cleaning_depth", label: "Standard or deep clean?", type: "text", required: true },
    { id: "home_access", label: "Who will open the door?", type: "text", required: true },
  ];
  const draft = applyDoneeoRulesGate(applyCustomerAnswers(previous, { cleaning_depth: "Standard" }));
  assert.equal(canContinueIntake(draft, previous, { cleaning_depth: "Standard" }), true);
  assert.equal(canContinueIntake(draft, previous, { cleaning_depth: "Actually, also need three rooms painted" }), false);
  assert.equal(canContinueIntake(draft, previous, {}), false);
  const finished = applyDoneeoRulesGate(applyCustomerAnswers(previous, { cleaning_depth: "Standard", home_access: "I will open the door" }));
  assert.equal(canContinueIntake(finished, previous, { home_access: "I will open the door" }), false);
});
