import assert from "node:assert/strict";
import test from "node:test";

import { applyCustomerAnswers, buildJobIntelligence } from "../lib/job-intelligence";
import { enforceSafety, extractStreetAddresses, fallbackAnalysis } from "../lib/planner";
import { applyDoneeoRulesGate } from "../lib/rules-gate";
import { augmentWithHouseholdKnowledge } from "../lib/work-ontology";
import { recognizeHouseholdItems } from "../lib/household-catalog";

function plan(request: string, answers: Record<string, string | boolean> = {}) {
  const analyzed = enforceSafety(augmentWithHouseholdKnowledge(fallbackAnalysis(request)));
  const answered = applyCustomerAnswers(analyzed, answers);
  return buildJobIntelligence(applyDoneeoRulesGate(enforceSafety(answered)));
}

function questionConcepts(result: ReturnType<typeof plan>) {
  return result.questions.map(question => `${question.id} ${question.label}`.toLowerCase()).join(" | ");
}

test("household item aliases prefer the specific item without losing separate mentions", () => {
  assert.deepEqual(recognizeHouseholdItems("Move a dish washer").map(item => item.id), ["dishwasher"]);
  assert.deepEqual(recognizeHouseholdItems("Move a pool table").map(item => item.id), ["pool_table"]);
  assert.deepEqual(recognizeHouseholdItems("Move a table and a lamp").map(item => item.id), ["dining_table", "lamp"]);
});

test("a short Costco fridge request activates the refrigerator knowledge layer", () => {
  const result = plan("Pick up a fridge from Costco.");
  const concepts = questionConcepts(result);

  assert.ok(result.items.some(item => /refrigerator/i.test(item)));
  assert.ok(result.understoodFacts.some(fact => /household catalog match: refrigerator/i.test(fact)));
  assert.match(concepts, /refrigerator_details|refrigerator_condition|refrigerator_pickup_ready/);
  assert.ok(result.questions.some(question => question.id === "service_address" && /delivery location|delivery address/i.test(question.label)));
  assert.equal(result.rulesGate?.domains.find(domain => domain.id === "routing")?.status, "attention");
  assert.match(result.rulesGate?.domains.find(domain => domain.id === "routing")?.detail || "", /destination|final route node/i);
});

test("thirteen boxes inside one property never invents recurrence or driving", () => {
  const result = plan("Move 13 boxes from my basement to my house.");
  const concepts = questionConcepts(result);
  const options = result.intelligence?.manpower.alternatives || [];

  assert.equal(result.title, "Moving and physical handling");
  assert.equal(result.routeNodes.length, 0);
  assert.equal(result.stops.length, 0);
  assert.equal(result.recurrence.recurring, false);
  assert.equal(result.intelligence?.estimate.routeMinutes, 0);
  assert.equal(result.intelligence?.manpower.minimum, 1);
  assert.equal(result.intelligence?.manpower.recommended, 2);
  assert.deepEqual(options.map(option => option.people), [1, 2, 3]);
  assert.ok(options[0].estimatedMinutes > options[1].estimatedMinutes);
  assert.ok(options[1].estimatedMinutes > options[2].estimatedMinutes);
  assert.match(concepts, /handling_access/);
  assert.match(concepts, /handling_size_weight/);
  assert.doesNotMatch(concepts, /frequency|how often|recurr|repeat|elevator|vehicle|pickup|delivery/);
});

test("pickup wording for boxes inside one property never creates a van or route", () => {
  const request = "Pickup 15 box from my basement to put it inside my house this Saturday at 10 am at 12395 av Roland Paradis";
  const result = plan(request);
  const alternatives = result.intelligence?.manpower.alternatives || [];

  assert.deepEqual(extractStreetAddresses(request), ["12395 av Roland Paradis"]);
  assert.equal(result.category, "general");
  assert.equal(result.title, "Moving and physical handling");
  assert.deepEqual(result.tasks, ["Carry and place 15 boxes within the property"]);
  assert.equal(result.routeNodes.length, 0);
  assert.equal(result.stops.length, 0);
  assert.equal(result.intelligence?.estimate.routeMinutes, 0);
  assert.ok(!result.equipment.some(item => ["vehicle", "straps", "blankets"].includes(item.id)));
  assert.ok(result.questions.some(question => question.id === "handling_destination"));
  assert.ok(result.questions.some(question => question.id === "handling_access"));
  assert.doesNotMatch(questionConcepts(result), /pickup_address|delivery_address|vehicle_access|frequency/);
  assert.deepEqual(alternatives.map(option => option.people), [1, 2, 3]);
  assert.ok(alternatives[0].estimatedMinutes > alternatives[1].estimatedMinutes);
  assert.ok(alternatives[1].estimatedMinutes > alternatives[2].estimatedMinutes);
  assert.ok(!result.understoodFacts.some(fact => /address supplied:\s*15 box/i.test(fact)));
});

test("completed on-site box intake can build estimates without a hidden final question", () => {
  const result = plan("Take 25 boxes from my basement and put them inside the house this Saturday at 10 am at 12395 av Roland Paradis", {
    handling_destination: "Main-floor storage room",
    handling_access: "One flight of stairs, clear path and normal-width door",
    handling_size_weight: "Largest box is about 12 kg",
    handling_contents: "Ordinary household items",
  });

  assert.equal(result.questions.length, 0);
  assert.equal(result.intelligence?.estimate.ready, true);
  assert.equal(result.intelligence?.estimate.routeMinutes, 0);
  assert.equal(result.intelligence?.manpower.minimum, 1);
  assert.equal(result.intelligence?.manpower.recommended, 2);
  assert.deepEqual(result.intelligence?.manpower.alternatives.map(option => option.people), [1, 2, 3]);
  assert.ok((result.intelligence?.manpower.alternatives[0].estimatedMinutes || 0) > (result.intelligence?.manpower.alternatives[1].estimatedMinutes || 0));
});

test("answers change on-site box manpower and duration", () => {
  const request = "Move 13 boxes from my basement to my house.";
  const easy = plan(request, {
    service_address: "25 Pine Street, Montréal",
    handling_destination: "Main-floor storage room",
    handling_access: "One flight of stairs with a clear wide path",
    handling_size_weight: "8 kg",
    handling_contents: "Ordinary household items",
    schedule: "Saturday at 10 a.m.",
  });
  const difficult = plan(request, {
    service_address: "25 Pine Street, Montréal",
    handling_destination: "Main-floor storage room",
    handling_access: "Two narrow flights with tight turns",
    handling_size_weight: "28 kg",
    handling_contents: "Some fragile or valuable items",
    schedule: "Saturday at 10 a.m.",
  });

  assert.equal(easy.questions.length, 0);
  assert.equal(difficult.questions.length, 0);
  assert.equal(easy.intelligence?.estimate.routeMinutes, 0);
  assert.equal(difficult.intelligence?.estimate.routeMinutes, 0);
  assert.equal(difficult.intelligence?.manpower.minimum, 2);
  assert.ok((difficult.intelligence?.estimate.executionMinutes || 0) > (easy.intelligence?.estimate.executionMinutes || 0));
});

test("address-to-address boxes keep a real transport route", () => {
  const result = plan("Tomorrow at 9 a.m., pick up 13 boxes at 10 Main Street, Laval, and deliver them to 25 Pine Street, Montréal.");

  assert.equal(result.routeNodes.length, 2);
  assert.equal(result.routeNodes[0].location, "10 Main Street, Laval");
  assert.ok((result.intelligence?.estimate.routeMinutes || 0) > 0);
  assert.ok(result.intelligence?.resources.some(resource => resource.id === "vehicle"));
  assert.equal(result.recurrence.recurring, false);
});

test("dishwasher delivery and installation remains a composite work order", () => {
  const result = plan("Tomorrow at 10:00 a.m., pick up a dishwasher already paid for and ready at Costco Boucherville, deliver it to my apartment at 12385 Rivière-des-Prairies, apartment 5, then install and test it. Existing water, drain and electrical connections are accessible. No old dishwasher is installed.");

  assert.equal(result.routeNodes.length, 2);
  assert.ok(result.tasks.some(task => /install/i.test(task)));
  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "transport_handling"));
  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "appliance_installation"));
  assert.ok(result.intelligence?.primitives.some(phase => phase.id === "connect_appliance"));
  assert.ok((result.intelligence?.estimate.executionMinutes || 0) >= 200);
  assert.ok((result.intelligence?.estimate.rangeHigh || 0) > (result.intelligence?.estimate.rangeLow || 0));
  assert.ok(!result.questions.some(question => ["retailer_pickup_status", "dishwasher_connection_scope", "old_dishwasher"].includes(question.id)));
});

test("Costco refrigerator delivery uses item-specific intelligence without inventing installation", () => {
  const result = plan("Saturday at 10 a.m., pick up a fridge from Costco Anjou and deliver it to my apartment at 12385 Test Avenue.");
  const concepts = questionConcepts(result);

  assert.ok(result.items.some(item => /refrigerator/i.test(item)));
  assert.ok(result.understoodFacts.some(fact => /household catalog match: refrigerator/i.test(fact)));
  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "transport_handling"));
  assert.ok(!result.intelligence?.domains?.some(domain => domain.id === "appliance_installation"));
  assert.deepEqual(result.routeNodes.map(node => node.location), ["Costco Anjou", "my apartment at 12385 Test Avenue"]);
  assert.deepEqual(result.tasks, [
    "Pick up the refrigerator at Costco Anjou",
    "Transport and deliver the refrigerator to my apartment at 12385 Test Avenue",
  ]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.phaseIds.length), [2, 1]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.recommendedCrew), [2, 2]);
  assert.equal(result.recommendedTeamSize, 2);
  assert.ok(result.intelligence?.primitives.some(phase => /load refrigerator upright/i.test(phase.label)));
  assert.ok(result.intelligence?.resources.some(resource => resource.id === "vehicle"));
  assert.match(concepts, /refrigerator_details/);
  assert.match(concepts, /refrigerator_condition/);
  assert.match(concepts, /refrigerator_pickup_ready/);
  assert.match(concepts, /refrigerator_destination_scope/);
  assert.match(concepts, /refrigerator_old_unit/);
  assert.doesNotMatch(concepts, /when should|schedule|date|requested time/);
});

test("misspelled Costco stove request preserves pickup, delivery and kitchen installation", () => {
  const result = plan("i want you to pick up stove from costico enjou saturday at 10am and bring it to my appartment at 12385 av roland pardis app 5 and instal it proporly in my kistchen");
  const concepts = questionConcepts(result);

  assert.deepEqual(result.tasks, [
    "Pick up the kitchen range at costco enjou",
    "Transport and deliver the kitchen range to my apartment at 12385 av roland pardis app 5",
    "Install, connect and test the kitchen range in the kitchen",
  ]);
  assert.deepEqual(result.routeNodes.map(node => node.location), ["costco enjou", "my apartment at 12385 av roland pardis app 5"]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.domain), ["transport_handling", "transport_handling", "appliance_installation"]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.phaseIds.length), [2, 1, 4]);
  assert.equal(result.scheduleWindow?.arrivalTime, "10:00 AM");
  assert.ok(result.understoodFacts.some(fact => /^Address supplied: 12385 av roland pardis app 5$/i.test(fact)));
  assert.ok(!result.understoodFacts.some(fact => /Address supplied:.*install/i.test(fact)));
  assert.match(concepts, /range_connection_scope/);
  assert.doesNotMatch(concepts, /range_energy_source/);
  assert.match(concepts, /range_parts/);
  assert.doesNotMatch(concepts, /schedule|when should|service_address|handling_destination|handling_size_weight|customer_help/);
  assert.ok(result.intelligence?.resources.some(resource => resource.id === "vehicle"));
  assert.ok(result.intelligence?.resources.some(resource => resource.id === "appliance_install_tools"));
  assert.match(result.intelligence?.resources.find(resource => resource.id === "anti_tip")?.name || "", /stove anti-tip/i);
  assert.doesNotMatch(result.intelligence?.fulfillment.groups.find(group => group.id === "in_home_unit")?.executorRole || "", /wall-mount/i);
  assert.equal(result.rulesGate?.providerClass, "skilled_executor");
});

test("ordered stove and old-refrigerator workflows remain one continuous six-task order", () => {
  const result = plan("Pick up stove from Ikea Bouchervile and bring it to my apartement and instal it, after this i need some help in taking out old fridge to my sister house and instal it");
  const concepts = questionConcepts(result);
  const streams = result.intelligence?.workstreams || [];

  assert.deepEqual(result.routeNodes.map(node => node.location), ["Ikea Boucherville", "my apartment", "my sister house"]);
  assert.deepEqual(result.tasks, [
    "Pick up the kitchen range at Ikea Boucherville",
    "Transport and deliver the kitchen range to my apartment",
    "Install, connect and test the kitchen range at my apartment",
    "Pick up the old refrigerator at my apartment",
    "Transport and deliver the old refrigerator to my sister house",
    "Install, connect and test the old refrigerator at my sister house",
  ]);
  assert.equal(streams.length, 6);
  assert.deepEqual(streams.map(stream => stream.sequence), [1, 2, 3, 4, 5, 6]);
  assert.ok(streams.every(stream => stream.likelyMinutes > 0));
  assert.ok(streams[2].phaseIds.every(id => /_range_1$/.test(id)));
  assert.ok(streams[5].phaseIds.every(id => /_refrigerator_1$/.test(id)));
  assert.ok(!result.intelligence?.domains?.some(domain => domain.id === "furniture_assembly"));
  assert.doesNotMatch(concepts, /furniture_models|parts_complete|furniture_anchoring|packaging_removal|refrigerator_condition|refrigerator_pickup_ready|refrigerator_destination_scope|refrigerator_old_unit/);
  assert.match(concepts, /refrigerator_disconnect_status/);
  assert.doesNotMatch(result.skillRequirements.join(" | "), /furniture|product assembly/i);
});

test("three sequential item workflows preserve all six pickup and delivery tasks", () => {
  const result = plan("Pick up a refrigerator from Costco Laval and bring it to my house. After this take the old refrigerator to my mother house. After this pick up a sofa from the seller home and bring it to my brother apartment.");
  const streams = result.intelligence?.workstreams || [];
  const concepts = questionConcepts(result);

  assert.deepEqual(result.tasks, [
    "Pick up the refrigerator at Costco Laval",
    "Transport and deliver the refrigerator to my house",
    "Pick up the old refrigerator at my house",
    "Transport and deliver the old refrigerator to my mother house",
    "Pick up the sofa or sectional at the seller home",
    "Transport and deliver the sofa or sectional to my brother apartment",
  ]);
  assert.equal(result.routeNodes.length, 5);
  assert.equal(streams.length, 6);
  assert.ok(streams.every(stream => stream.likelyMinutes > 0));
  assert.deepEqual(streams.map(stream => stream.phaseIds.length), [2, 1, 2, 1, 2, 1]);
  assert.ok(streams[0].phaseIds.every(id => /refrigerator_1$/.test(id)));
  assert.ok(streams[2].phaseIds.every(id => /refrigerator_2$/.test(id)));
  assert.ok(streams[4].phaseIds.every(id => /sofa_1$/.test(id)));
  assert.ok(!result.intelligence?.domains?.some(domain => domain.id === "elder_support"));
  assert.match(concepts, /refrigerator_details_1/);
  assert.match(concepts, /refrigerator_details_2/);
  assert.match(concepts, /refrigerator_pickup_ready_1/);
  assert.doesNotMatch(concepts, /refrigerator_pickup_ready_2/);
  assert.match(concepts, /refrigerator_disconnect_status_2/);
});

test("gas stove answer upgrades installation eligibility to a licensed professional", () => {
  const result = plan("Pick up a stove from Costco Anjou and bring it to 12385 Test Avenue, then install it in my kitchen.", {
    range_energy_source: "Gas",
    range_connection_scope: "Existing gas shutoff and connector location",
  });

  assert.equal(result.rulesGate?.providerClass, "licensed_professional");
  assert.ok(result.intelligence?.primitives.some(phase => phase.id === "connect_appliance" && phase.qualification === "licensed_professional"));
});

test("misspelled refrigerator and schedule are normalized before questions", () => {
  const result = plan("Pick up a refridgerator from Costo Anjou and bring it to 12385 Test Avenue preferably Saturday starting from 10.");

  assert.equal(result.scheduleWindow?.dateLabel, "Saturday");
  assert.equal(result.scheduleWindow?.arrivalTime, "10:00 AM");
  assert.ok(result.items.some(item => /refrigerator/i.test(item)));
  assert.ok(!result.questions.some(question => /when|schedule|date|time/i.test(`${question.id} ${question.label}`)));
});

test("supplied refrigerator facts remove only the questions they answer", () => {
  const result = plan("Saturday at 10 a.m., pick up a new factory-boxed refrigerator, model RF28, 36 x 34 x 70 inches and 310 lb, paid and ready at Costco Anjou, and deliver it to 12385 Test Avenue. Measurements checked. Carry in and place only. No existing refrigerator to move.");
  const concepts = questionConcepts(result);

  assert.doesNotMatch(concepts, /refrigerator_details|refrigerator_access_fit|refrigerator_condition|refrigerator_pickup_ready|refrigerator_destination_scope|refrigerator_old_unit/);
  assert.doesNotMatch(concepts, /when should|schedule|date|time/);
  assert.ok(result.intelligence?.primitives.some(phase => /refrigerator/i.test(phase.label)));
});

test("external dishwasher pickup remains visible beside later in-home work", () => {
  const request = "I want you to pick up dishwasher from Coscto Anjou bring it to my apartment at 12385 AV Roland Paradis then unstall it in my kitchen. After this, I want to wallmount a TV in my bedroom. Before leaving I have 12 boxes I need to take from my apartment to my garage in the basement.";
  const result = plan(request);

  assert.equal(result.routeNodes.length, 2);
  assert.match(result.routeNodes[0].location, /costco anjou/i);
  assert.match(result.routeNodes[0].actions.join(" | "), /pick up dishwasher/i);
  assert.match(result.routeNodes[1].location, /12385 AV Roland Paradis/i);
  assert.ok(result.intelligence?.resources.some(resource => resource.id === "vehicle"));
  assert.deepEqual(result.tasks, [
    "Pick up the dishwasher at costco Anjou",
    "Transport and deliver the dishwasher to 12385 AV Roland Paradis",
    "Install, connect and test the dishwasher in the kitchen",
    "Wall-mount the television in the bedroom, level it and verify the finished installation",
    "Carry 12 boxes from the apartment to the basement garage",
  ]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.sequence), [1, 2, 3, 4, 5]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.domain), ["transport_handling", "transport_handling", "appliance_installation", "mounting", "transport_handling"]);
  assert.equal(result.intelligence?.fulfillment.mode, "coordinated_specialists");
  assert.equal(result.intelligence?.fulfillment.singleCustomerOrder, true);
  assert.deepEqual(result.intelligence?.fulfillment.groups[0].taskSequences, [1, 2]);
  assert.deepEqual(result.intelligence?.fulfillment.groups[1].taskSequences, [3, 4, 5]);
  assert.ok(result.intelligence?.primitives.some(phase => phase.id === "onsite_box_move"));
  assert.ok(result.intelligence?.workstreams[4].phaseIds.includes("onsite_box_move"));
  assert.ok(result.intelligence?.workstreams[3].resourceIds.some(id => ["drill", "level", "stud_finder"].includes(id)));
  assert.ok(!result.intelligence?.workstreams[4].resourceIds.some(id => ["vehicle", "straps"].includes(id)));
  assert.ok(result.equipment.some(item => item.id === "stud_finder"));
  assert.ok(result.questions.some(question => question.id === "mount_hardware_status"));
  assert.match(result.intelligence?.workstreams[1].completionGate || "", /before Task 3 begins/);
});

test("misspelled passive box request remains the fifth task with the stated room and schedule", () => {
  const request = "Pick up the dishwasher at costco enjou to mu appartement 12385 Test Avenue app 5 the unstall in my kistchen, after this mount a tv in my leaving room, after this i have 15 boxes need to be taken from my appratment to my bassment preferblu staturday starting from 10 the dishwacher ready fro";
  const result = plan(request);

  assert.deepEqual(result.routeNodes.map(node => node.location), ["costco enjou", "12385 Test Avenue app 5"]);
  assert.deepEqual(result.tasks, [
    "Pick up the dishwasher at costco enjou",
    "Transport and deliver the dishwasher to 12385 Test Avenue app 5",
    "Install, connect and test the dishwasher in the kitchen",
    "Wall-mount the television in the living room, level it and verify the finished installation",
    "Carry 15 boxes from the apartment to the basement",
  ]);
  assert.equal(result.scheduleWindow?.dateLabel, "Saturday");
  assert.equal(result.scheduleWindow?.arrivalTime, "10:00 AM");
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.domain), ["transport_handling", "transport_handling", "appliance_installation", "mounting", "transport_handling"]);
  assert.ok(result.intelligence?.workstreams[4].phaseIds.includes("onsite_box_move"));
  assert.ok(!result.questions.some(question => ["schedule", "handling_destination"].includes(question.id)));
});

test("a street named Test cannot turn dishwasher delivery into installation", () => {
  const result = plan("Pick up a dishwasher from Coscto Anjou, bring it to my apartment at 12385 Test Avenue, then install it in my kitchen. After this, wallmount a TV in my bedroom. Before leaving, take 12 boxes from my apartment to my garage in the basement.");
  const streams = result.intelligence?.workstreams || [];

  assert.equal(streams[1].domain, "transport_handling");
  assert.deepEqual(streams[1].phaseIds, ["unload_place"]);
  assert.equal(streams[2].domain, "appliance_installation");
  assert.ok(streams[2].phaseIds.includes("connect_appliance"));
  assert.deepEqual(result.intelligence?.fulfillment.groups[0].taskSequences, [1, 2]);
  assert.deepEqual(result.intelligence?.fulfillment.groups[1].taskSequences, [3, 4, 5]);
});

test("garage organization does not invent a transport route", () => {
  const result = plan("Organize my one-car garage with about 20 boxes. Keep everything onsite and do not discard anything.");

  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "organization"));
  assert.ok(!result.intelligence?.domains?.some(domain => domain.id === "transport_handling"));
  assert.ok(!result.intelligence?.resources.some(resource => resource.id === "vehicle"));
  assert.ok((result.intelligence?.estimate.executionMinutes || 0) >= 180);
});

test("on-site box lifting uses handling phases without inventing a vehicle", () => {
  const result = plan("Lift twelve boxes from my basement storage room to the garage. The heaviest box is about 18 kg.");

  assert.equal(result.category, "general");
  assert.ok(result.intelligence?.primitives.some(phase => phase.id === "onsite_handling_move"));
  assert.ok(!result.intelligence?.resources.some(resource => resource.id === "vehicle"));
  assert.ok(result.questions.some(question => question.id === "service_address"));
  assert.ok(!result.questions.some(question => question.id === "pickup_address"));
});

test("same-property boxes followed by TV mounting preserves two ordered tasks", () => {
  const result = plan("Pick up 12 boxes from my basement to inside my house then wall mount a TV.");

  assert.deepEqual(result.tasks, [
    "Carry and place 12 boxes within the property",
    "Wall-mount the television, level it and verify the finished installation",
  ]);
  assert.deepEqual(result.intelligence?.workstreams.map(stream => stream.domain), ["transport_handling", "mounting"]);
  assert.equal(result.intelligence?.workstreams[0].sequence, 1);
  assert.match(result.intelligence?.workstreams[0].completionGate || "", /before Task 2 begins/);
  assert.ok(result.intelligence?.workstreams[0].phaseIds.includes("onsite_handling_move"));
  assert.ok(result.intelligence?.workstreams[1].phaseIds.includes("mount_install"));
  assert.ok(result.intelligence?.workstreams[0].resourceIds.includes("dolly"));
  assert.ok(result.intelligence?.workstreams[1].resourceIds.includes("drill"));
  assert.ok((result.intelligence?.workstreams[0].rangeHigh || 0) > (result.intelligence?.workstreams[0].rangeLow || 0));
  assert.match(result.intelligence?.workstreams[1].completionGate || "", /complete work order/);
  assert.doesNotMatch(result.skillRequirements.join(" | "), /product assembly/i);
  assert.ok(result.questions.some(question => question.id.startsWith("handling_")));
  assert.ok(result.questions.some(question => question.id === "handling_size_weight"));
  assert.ok(result.questions.some(question => question.id === "mounted_item"));
  assert.ok(result.questions.some(question => question.id === "wall_type"));
  assert.ok(result.questions.some(question => question.id === "mount_hardware_status"));
  assert.ok(!result.questions.some(question => question.id === "packaging_destination"));
  assert.ok(!result.intelligence?.resources.some(resource => resource.id === "anchors"));
  assert.equal(result.intelligence?.resources.find(resource => resource.id === "dolly")?.kind, "equipment");
  assert.equal(result.intelligence?.estimate.routeMinutes, 0);
  assert.ok(!result.intelligence?.resources.some(resource => resource.id === "vehicle"));
});

test("regulated plumbing is routed to a licensed professional", () => {
  const result = plan("Replace a leaking kitchen faucet and test it for leaks at 25 Example Street, Montréal.");

  assert.equal(result.rulesGate?.providerClass, "licensed_professional");
  assert.ok(result.intelligence?.primitives.some(phase => phase.domain === "plumbing"));
  assert.ok(result.intelligence?.primitives.filter(phase => phase.domain === "plumbing").every(phase => phase.qualification === "licensed_professional"));
});

test("a simple bulb change is not treated like circuit work", () => {
  const result = plan("Change the burned-out bulb in my plug-in living room lamp. The replacement bulb is onsite.");

  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "electrical"));
  assert.ok(result.intelligence?.primitives.every(phase => phase.qualification !== "licensed_professional"));
});

const domainScenarios = [
  ["Paint two bedrooms with two coats; the walls have minor holes.", "painting"],
  ["Mow my medium backyard lawn, trim the edges and bag the clippings.", "yard_garden"],
  ["Mount a 65-inch TV on a drywall wall; the bracket is included.", "mounting"],
  ["Assemble six IKEA desks and remove the packaging.", "furniture_assembly"],
  ["Clean a three-bedroom house with two bathrooms and a kitchen every Friday.", "cleaning"],
  ["Buy groceries, deliver them to my elderly father, spend one hour with him and send me a visit update twice a week.", "elder_support"],
] as const;

for (const [request, expectedDomain] of domainScenarios) {
  test(`detects ${expectedDomain} and produces phases and resources`, () => {
    const result = plan(request);
    assert.ok(result.intelligence?.domains?.some(domain => domain.id === expectedDomain));
    assert.ok((result.intelligence?.primitives.length || 0) >= 2);
    assert.ok((result.intelligence?.estimate.executionMinutes || 0) > 0);
    assert.ok((result.intelligence?.estimate.rangeHigh || 0) >= (result.intelligence?.estimate.totalMinutes || 0));
  });
}

const onePropertyRelevanceScenarios = [
  {
    name: "painting facts",
    request: "Paint two bedrooms with two coats at 25 Pine Street. The walls have minor holes and the paint is not purchased yet.",
    domain: "painting",
    forbidden: /paint_status|paint_coats|surface_condition|frequency|elevator|vehicle/,
  },
  {
    name: "yard facts",
    request: "Mow my medium backyard lawn once this Saturday at 25 Pine Street and bag the clippings.",
    domain: "yard_garden",
    forbidden: /yard_size|yard_disposal|frequency|elevator|vehicle/,
  },
  {
    name: "hardwired light replacement",
    request: "Replace a hardwired ceiling light fixture at 25 Pine Street. The new fixture is available.",
    domain: "electrical",
    forbidden: /electrical_scope|electrical_symptom|fixture_parts|frequency|vehicle/,
  },
  {
    name: "television mounting",
    request: "Mount a 65-inch TV on a drywall wall at 25 Pine Street; the bracket is included.",
    domain: "mounting",
    forbidden: /mounted_item|wall_type|frequency|vehicle/,
  },
  {
    name: "office assembly and internal placement",
    request: "Next Monday, assemble twelve office desks and twelve chairs at 40 King Street, move them into three rooms, install six wall shelves and remove all packaging before 5 p.m.",
    domain: "furniture_assembly",
    forbidden: /frequency|pickup address|delivery address|vehicle access|usable elevator/,
  },
] as const;

for (const scenario of onePropertyRelevanceScenarios) {
  test(`${scenario.name} keeps only relevant one-property questions`, () => {
    const result = plan(scenario.request);
    assert.ok(result.intelligence?.domains?.some(domain => domain.id === scenario.domain));
    assert.equal(result.intelligence?.estimate.routeMinutes, 0);
    assert.equal(result.recurrence.recurring, false);
    assert.doesNotMatch(questionConcepts(result), scenario.forbidden);
  });
}

test("large TV mounting enforces the safe team minimum", () => {
  const result = plan("Mount a 65-inch TV on a drywall wall at 25 Pine Street; the bracket is included.");
  assert.equal(result.intelligence?.manpower.minimum, 2);
  assert.equal(result.rulesGate?.providerClass, "skilled_executor");
});

test("explicit recurring cleaning remains recurring and keeps supply verification", () => {
  const result = plan("Clean my three-bedroom house with two bathrooms and a kitchen every Friday at 25 Pine Street. I have a vacuum but no cleaning products.");
  assert.equal(result.recurrence.recurring, true);
  assert.match(result.recurrence.frequency.toLowerCase(), /every friday|recurr/);
  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "cleaning"));
  assert.ok(result.intelligence?.resources.some(resource => resource.kind === "consumable"));
  assert.equal(result.intelligence?.estimate.routeMinutes, 0);
});

test("explicit recurring elder support remains recurring without becoming moving", () => {
  const result = plan("Twice a week, buy groceries, deliver them to my 84-year-old father at 25 Pine Street, spend one hour with him and send me a visit update. He walks independently and needs no medication or personal care.");
  assert.equal(result.recurrence.recurring, true);
  assert.ok(result.intelligence?.domains?.some(domain => domain.id === "elder_support"));
  assert.ok(!result.intelligence?.domains?.some(domain => domain.id === "transport_handling"));
});

test("regulated work cannot be matched to a general helper", () => {
  const requests = [
    "Replace a leaking kitchen faucet and test it at 25 Pine Street.",
    "Replace a hardwired ceiling light fixture at 25 Pine Street.",
  ];
  for (const request of requests) {
    const result = plan(request);
    assert.equal(result.rulesGate?.providerClass, "licensed_professional");
    assert.ok(result.intelligence?.primitives.some(phase => phase.qualification === "licensed_professional"));
  }
});

test("arrival commitment stays separate from completion deadline", () => {
  const result = plan("Tomorrow at 9:00 a.m., pick up a table at 10 Main Street, Laval, deliver it to 25 Pine Street, Montréal, and finish before 1:00 p.m. I cannot help carry.");
  assert.equal(result.scheduleWindow?.arrivalTime, "9:00 AM");
  assert.equal(result.scheduleWindow?.deadlineTime, "1:00 PM");
  assert.equal(result.customerCanHelp, false);
});
