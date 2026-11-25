import assert from "node:assert/strict";
import test from "node:test";
import { attachPlanEdits, planEditFor, revisePlanSource } from "../lib/customer-plan-review";
import { buildJobIntelligence } from "../lib/job-intelligence";
import { fallbackAnalysis } from "../lib/planner";
import { augmentWithHouseholdKnowledge } from "../lib/work-ontology";

test("a box-step edit updates that scope and clears prior confirmation", () => {
  const source = "Pick up a dishwasher from Costco Anjou and install it in my apartment. After this, carry 10 boxes from my apartment to my garage in the basement.";
  const outline = buildJobIntelligence(augmentWithHouseholdKnowledge(fallbackAnalysis(source)));
  const edit = planEditFor(outline, { stepId: "onsite_box_move", revision: "Carry 6 boxes to the storage room instead." });
  assert.ok(edit);
  const updated = revisePlanSource(source, [edit]);
  assert.match(updated, /dishwasher from Costco Anjou/i);
  assert.match(updated, /carry 6 boxes from my apartment to the storage room/i);
  const rewritten = buildJobIntelligence(augmentWithHouseholdKnowledge(fallbackAnalysis(updated)));
  const revised = attachPlanEdits({ ...rewritten, planConfirmed: true }, [edit]);
  assert.equal(revised.planConfirmed, false);
  assert.ok(revised.intelligence?.primitives.find(step => step.id === edit.stepId)?.dependencies.includes(`Customer instruction: ${edit.revision}`));
});

test("review edits must identify a current plan step", () => {
  const outline = fallbackAnalysis("Clean the kitchen and two bathrooms at 100 Example Avenue.");
  outline.preparation = [{ step: "Collect supplies", kind: "materials", durationMinutes: 15, billable: true }];
  assert.equal(planEditFor(outline, { stepId: "preparation-1", revision: "Collect the supplies at the front counter." })?.title, "Collect supplies");
  assert.equal(planEditFor(outline, { stepId: "invented-step", revision: "Replace this step." }), null);
});

test("an external box-delivery question stays on an existing task block", () => {
  const analysis = fallbackAnalysis("Pick up five boxes from 100 Main Street and deliver them to 20 Lake Road.");
  analysis.questions.push({ id: "packing_check", label: "Are the boxes packed for transport?", type: "boolean", required: true });
  const result = buildJobIntelligence(analysis);
  const question = result.questions.find(item => item.id === "packing_check");
  assert.ok(question?.taskBlockId);
  assert.ok(result.taskBlocks?.some(block => block.id === question.taskBlockId));
});
