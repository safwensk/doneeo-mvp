import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("planner and operations share one canonical WorkCase identity", () => {
  const plannerRoute = fs.readFileSync("app/api/plan/route.ts", "utf8");
  const operationsRoute = fs.readFileSync("app/api/operations/route.ts", "utf8");
  const workOrderClient = fs.readFileSync("lib/work-orders.ts", "utf8");
  const schema = fs.readFileSync("db/schema.ts", "utf8");

  assert.match(plannerRoute, /architecturePosition\(control\.currentLayerId\)/);
  assert.match(workOrderClient, /work_case_id: string/);
  assert.match(workOrderClient, /job_order_id: string/);
  assert.match(workOrderClient, /requirement_contract_ref: string/);
  assert.match(schema, /currentLayerId: text\("current_layer_id"\)/);
  assert.match(schema, /workCaseId: text\("work_case_id"\)/);
  assert.match(operationsRoute, /advanceToFulfillment/);
  assert.match(operationsRoute, /targetLayerId: "L03"/);
  assert.match(operationsRoute, /targetLayerId: "L04"/);
  assert.match(operationsRoute, /current\.current\.requirementContractRef !== input\.requirement_contract_ref/);
});
test("the visible architecture and API both import the master registry", () => {
  const page = fs.readFileSync("app/architecture/page.tsx", "utf8");
  const route = fs.readFileSync("app/api/architecture/route.ts", "utf8");

  assert.match(page, /from "\.\.\/\.\.\/lib\/canonical-architecture"/);
  assert.match(route, /from "\.\.\/\.\.\/\.\.\/lib\/canonical-architecture"/);
  assert.doesNotMatch(page, /title:\s*"Intake & Context"/);
  assert.doesNotMatch(route, /title:\s*"Intake & Context"/);
});
