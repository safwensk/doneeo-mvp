import assert from "node:assert/strict";
import { test } from "node:test";
import { derivePreparationStart, parseClockTime, type PreparationStep, type ScheduleWindow } from "../lib/planner";

const schedule = (over: Partial<ScheduleWindow> = {}): ScheduleWindow => ({
  dateLabel: "Tomorrow",
  arrivalTime: "10:00 AM",
  arrivalLabel: "Arrive at 10:00 AM",
  ...over,
});

const step = (durationMinutes: number, over: Partial<PreparationStep> = {}): PreparationStep => ({
  step: "Pick up rental van",
  kind: "rental",
  durationMinutes,
  billable: true,
  ...over,
});

test("preparation never pushes arrival later", () => {
  const result = derivePreparationStart(schedule(), [step(90)]);
  assert.equal(result?.arrivalTime, "10:00 AM", "arrival is a commitment and must not move");
  assert.equal(result?.preparationStartTime, "8:30 AM");
});

test("multiple preparation steps accumulate backward from arrival", () => {
  const result = derivePreparationStart(schedule(), [step(45), step(30, { kind: "materials" })]);
  assert.equal(result?.preparationStartTime, "8:45 AM");
  assert.equal(result?.arrivalTime, "10:00 AM");
});

test("no preparation means no preparation start at all", () => {
  const result = derivePreparationStart(schedule(), []);
  assert.equal(result?.preparationStartTime, undefined);
  assert.equal(result?.arrivalTime, "10:00 AM");
});

test("a stale preparation start is cleared when preparation is removed", () => {
  const stale = schedule({ preparationStartTime: "7:00 AM", preparationStartLabel: "old" });
  const result = derivePreparationStart(stale, []);
  assert.equal(result?.preparationStartTime, undefined, "must not keep a start time for work that no longer exists");
  assert.equal(result?.preparationStartLabel, undefined);
});

test("the derived label names both times so the executor cannot misread it", () => {
  const result = derivePreparationStart(schedule(), [step(60)]);
  assert.match(String(result?.preparationStartLabel), /9:00 AM/);
  assert.match(String(result?.preparationStartLabel), /10:00 AM/);
});

test("crossing midnight backward wraps instead of going negative", () => {
  const result = derivePreparationStart(schedule({ arrivalTime: "12:30 AM" }), [step(60)]);
  assert.equal(result?.preparationStartTime, "11:30 PM");
});

test("24-hour arrival times are handled", () => {
  const result = derivePreparationStart(schedule({ arrivalTime: "14:00" }), [step(30)]);
  assert.equal(result?.preparationStartTime, "1:30 PM");
});

test("an unparseable arrival is left alone rather than guessed", () => {
  const result = derivePreparationStart(schedule({ arrivalTime: "sometime soon" }), [step(60)]);
  assert.equal(result?.preparationStartTime, undefined);
  assert.equal(result?.arrivalTime, "sometime soon");
});

test("null schedule survives", () => {
  assert.equal(derivePreparationStart(null, [step(60)]), null);
});

test("clock parsing covers the formats the planner emits", () => {
  assert.equal(parseClockTime("9:00 AM"), 540);
  assert.equal(parseClockTime("12:00 AM"), 0);
  assert.equal(parseClockTime("12:00 PM"), 720);
  assert.equal(parseClockTime("1:30 p.m."), 810);
  assert.equal(parseClockTime("07:15"), 435);
  assert.equal(parseClockTime("no time given"), null);
});
