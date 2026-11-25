import { isCompositeDishwasherRequest, type CustomerTaskBlock, type JobFact, type JobIntelligence, type PlannerAnalysis, type PlannerQuestion, type ResourceGap, type TaskPrimitive } from "./planner";
import { recognizeHouseholdItems } from "./household-catalog";
import { buildHouseholdWorkModel } from "./work-ontology";

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function quantity(text: string, noun: string, fallback = 1) {
  const match = text.match(new RegExp(`\\b(\\d+|${Object.keys(NUMBER_WORDS).join("|")})\\s+(?:office\\s+)?${noun}`, "i"));
  if (!match) return fallback;
  return Number(match[1]) || NUMBER_WORDS[match[1].toLowerCase()] || fallback;
}

function primitive(id: string, label: string, count: number, unitMinutes: number, parallelizable = true, dependencies: string[] = []): TaskPrimitive {
  return { id, label, quantity: count, unitMinutes, personMinutes: count * unitMinutes, parallelizable, dependencies };
}

function buildPrimitives(analysis: PlannerAnalysis): TaskPrimitive[] {
  return buildHouseholdWorkModel(analysis).primitives;
  /* Legacy category estimates remain below as documented calibration history.
     The universal ontology above is now authoritative for every work domain. */
  const text = analysis.sourceText.toLowerCase();
  const result: TaskPrimitive[] = [];

  if (analysis.category === "moving") {
    result.push(primitive("prepare_vehicle", "Vehicle and protection setup", 1, 15, false, ["vehicle", "straps", "blankets"]));
    analysis.routeNodes.forEach((node, index) => {
      const handlingActions = Math.max(1, node.actions.length);
      result.push(primitive(`handle_stop_${index + 1}`, `Handle work at stop ${index + 1}`, handlingActions, /heavy|large|stairs|no elevator/.test(text) ? 22 : 14, true, ["confirmed access", "recipient readiness"]));
    });
    result.push(primitive("secure_load", "Protect and secure transported items", Math.max(1, analysis.items.length), 10, true, ["straps", "blankets"]));
    if (/dish\s*washer/i.test(text) && /\b(?:install|instal|connect|hook\s*up|fit)\b/i.test(text)) {
      result.push(primitive("position_dishwasher", "Position and level dishwasher", 1, 20, false, ["model and dimensions", "apartment access"]));
      result.push(primitive("connect_dishwasher", "Connect dishwasher to verified existing services", 1, 40, false, ["connection scope", "model-compatible parts", "qualified installer"]));
      result.push(primitive("test_dishwasher", "Run operational and leak test", 1, 20, false, ["water and power available", "leak protection"]));
    }
  } else if (analysis.category === "installation") {
    const desks = quantity(text, "desks?", 0);
    const chairs = quantity(text, "chairs?", 0);
    const shelves = quantity(text, "(?:wall\\s+)?shel(?:f|ves)", 0);
    if (desks) result.push(primitive("assemble_desk", "Assemble desks", desks, 35, true, ["instructions or model", "parts complete"]));
    if (chairs) result.push(primitive("assemble_chair", "Assemble chairs", chairs, 15, true, ["parts complete"]));
    if (shelves) result.push(primitive("install_shelf", "Measure and install wall shelves", shelves, 35, true, ["wall type", "anchors", "drill"]));
    if (/move.+(?:room|office)|three rooms/.test(text)) result.push(primitive("place_furniture", "Move assembled furniture into final rooms", Math.max(desks, chairs, 1), 6, true, ["clear internal route"]));
    if (/packaging|boxes|cleanup|remove/.test(text)) result.push(primitive("remove_packaging", "Collect and remove packaging", 1, 25, true, ["approved disposal point"]));
    result.push(primitive("setup_quality", "Setup, measurements and quality check", 1, 25, false));
  } else if (analysis.category === "cleaning") {
    const bedrooms = quantity(text, "bedrooms?", 1);
    const bathrooms = quantity(text, "bathrooms?", /bathroom/.test(text) ? 1 : 0);
    result.push(primitive("clean_bedrooms", "Clean bedrooms", bedrooms, 30, true, ["vacuum", "surface-safe products"]));
    if (bathrooms) result.push(primitive("clean_bathrooms", "Clean and sanitize bathrooms", bathrooms, 35, true, ["bathroom cleaner", "gloves"]));
    if (/kitchen/.test(text)) result.push(primitive("clean_kitchen", "Clean kitchen", 1, 45, true, ["degreaser", "surface restrictions"]));
    if (/common|living|hall|area/.test(text)) result.push(primitive("clean_common", "Clean common areas", 1, 35, true, ["vacuum", "mop"]));
    result.push(primitive("cleaning_setup", "Prepare supplies and complete quality check", 1, 20, false));
  } else if (analysis.category === "elder_support") {
    if (/grocer|shop|buy/.test(text)) result.push(primitive("grocery_shop", "Purchase or collect groceries", 1, 45, false, ["list", "payment method"]));
    if (/deliver/.test(text)) result.push(primitive("grocery_delivery", "Deliver and put down groceries", 1, 15, false, ["home access"]));
    const visitMinutes = /(?:one|1)\s+hour/.test(text) ? 60 : 45;
    if (/spend|companionship|visit/.test(text)) result.push(primitive("companionship", "Companionship visit", 1, visitMinutes, false));
    if (/update|report/.test(text)) result.push(primitive("visit_update", "Prepare family visit update", 1, 10, false, ["approved update format"]));
  } else {
    analysis.tasks.slice(0, 8).forEach((task, index) => {
      const unitMinutes = Math.max(30, Math.round(analysis.estimate.serviceMinutesPerVisit / Math.max(1, analysis.tasks.length)));
      result.push(primitive(`custom_${index + 1}`, task, 1, unitMinutes, true, ["task-specific scope"]));
    });
  }

  return result.length ? result : [primitive("custom_work", analysis.title, 1, Math.max(45, analysis.estimate.serviceMinutesPerVisit), true, ["confirmed scope"] )];
}

function buildFacts(analysis: PlannerAnalysis): JobFact[] {
  const facts: JobFact[] = analysis.understoodFacts.map((fact, index) => ({ key: `request_${index + 1}`, label: "Customer fact", value: fact, source: "customer_request", confidence: "confirmed" }));
  Object.entries(analysis.extractedAnswers).forEach(([key, value]) => facts.push({ key, label: key.replaceAll("_", " "), value: typeof value === "boolean" ? (value ? "Yes" : "No") : value, source: key.startsWith("answer_") ? "customer_answer" : "derived", confidence: key.startsWith("answer_") ? "confirmed" : "inferred" }));
  analysis.routeNodes.forEach((node, index) => facts.push({ key: `stop_${index + 1}`, label: `Stop ${index + 1}`, value: `${node.location}: ${node.actions.join("; ")}`, source: "customer_request", confidence: "confirmed" }));
  if (analysis.scheduleWindow?.arrivalTime) facts.push({ key: "arrival_commitment", label: "Requested arrival", value: analysis.scheduleWindow.arrivalLabel, source: "customer_request", confidence: "confirmed" });
  if (analysis.scheduleWindow?.deadlineTime) facts.push({ key: "completion_deadline", label: "Completion deadline", value: analysis.scheduleWindow.deadlineLabel || analysis.scheduleWindow.deadlineTime, source: "customer_request", confidence: "confirmed" });
  return facts.filter((fact, index, all) => all.findIndex(candidate => candidate.key === fact.key && candidate.value === fact.value) === index).slice(0, 30);
}

function equipmentAnswer(analysis: PlannerAnalysis, id: string) {
  const entries = Object.entries(analysis.extractedAnswers);
  return entries.find(([key]) => key === id || key.includes(id) || id.includes(key))?.[1];
}

function buildResources(analysis: PlannerAnalysis): ResourceGap[] {
  const source = analysis.sourceText.toLowerCase();
  return analysis.equipment.map(item => {
    const answer = item.id === "mounting_hardware" && analysis.extractedAnswers.mount_hardware_status === "All available"
      ? true
      : equipmentAnswer(analysis, item.id);
    const customerConfirmed = answer === true || new RegExp(`(?:i|we) (?:have|already have)[^.]{0,35}${item.name.split(" ")[0]}`, "i").test(source);
    const customerMissing = answer === false || /(?:do not|don't|no) have (?:cleaning )?(?:equipment|tools|products|supplies)/i.test(source);
    const normalizedName = item.name.toLowerCase();
    const kind: ResourceGap["kind"] = item.id === "vehicle" || (!/hand truck|dolly/.test(normalizedName) && /vehicle|truck|van|transport/.test(normalizedName)) ? "vehicle" : item.supplyType === "consumable" ? "consumable" : /anchor|fastener|cleaner|degreaser|bags/.test(normalizedName) ? "material" : "equipment";
    if (customerConfirmed) return { id: item.id, name: item.name, kind, status: "customer_confirmed" as const, resolution: "Lock customer-owned item into the work order", estimatedCost: 0 };
    if (item.supplyType === "consumable" && customerMissing) return { id: item.id, name: item.name, kind, status: "purchase_required" as const, resolution: "Provider purchases it and Doneeo adds the approved receipt to the invoice", estimatedCost: item.rentalEstimate };
    return { id: item.id, name: item.name, kind, status: item.supplyType === "consumable" ? "purchase_required" as const : "executor_to_verify" as const, resolution: item.supplyType === "consumable" ? "Confirm customer stock; otherwise add purchase to invoice" : "Check matched executor inventory first; reserve rental only if the team has a gap", estimatedCost: item.supplyType === "consumable" ? item.rentalEstimate : 0 };
  });
}

function accessMinutes(analysis: PlannerAnalysis) {
  return Object.entries(analysis.extractedAnswers).reduce((total, [key, value]) => {
    if (/floor/.test(key) && typeof value === "string") return total + (/4th/.test(value) ? 20 : /3rd/.test(value) ? 14 : /2nd/.test(value) ? 8 : 0);
    if (/elevator/.test(key) && value === false) return total + 10;
    if (/vehicle_access/.test(key) && typeof value === "string") return total + (/remote/i.test(value) ? 15 : /limited/i.test(value) ? 8 : 0);
    return total;
  }, 0);
}

export function applyCustomerAnswers(analysis: PlannerAnalysis, answers: Record<string, string | boolean>) {
  const merged = { ...analysis.extractedAnswers, ...answers };
  const answeredFacts = analysis.questions.flatMap(question => {
    const value = answers[question.id];
    if (!(typeof value === "boolean" || (typeof value === "string" && value.trim()))) return [];
    return [`${question.label}: ${typeof value === "boolean" ? (value ? "Yes" : "No") : value}`];
  });
  const floorByStop = new Map<string, string>();
  Object.entries(merged).forEach(([key, value]) => {
    const match = key.match(/^(stop_\d+)_floor$/);
    if (match && typeof value === "string") floorByStop.set(match[1], value);
  });
  const questions = analysis.questions.filter(question => {
    const value = merged[question.id];
    if (typeof value === "boolean" || (typeof value === "string" && value.trim())) return false;
    if (question.id === "packaging_destination" && merged.packaging_removal === false) return false;
    const elevator = question.id.match(/^(stop_\d+)_elevator$/);
    if (elevator && /ground/i.test(floorByStop.get(elevator[1]) || "")) return false;
    return true;
  });
  const difficultAccess = Object.entries(merged).some(([key, value]) => (/elevator/.test(key) && value === false) || (/floor/.test(key) && typeof value === "string" && /3rd|4th/.test(value)));
  return {
    ...analysis,
    extractedAnswers: merged,
    questions,
    recommendedTeamSize: analysis.category === "moving" && difficultAccess ? Math.max(2, analysis.recommendedTeamSize) : analysis.recommendedTeamSize,
    understoodFacts: [...analysis.understoodFacts, ...answeredFacts].filter((fact, index, all) => all.findIndex(candidate => candidate.toLowerCase() === fact.toLowerCase()) === index).slice(0, 24),
  };
}

function questionDomain(id: string) {
  if (/^(?:wall_type|mounted_item|mount_|concealed_services)/.test(id)) return "mounting";
  if (/^(?:furniture_|parts_complete|packaging_)/.test(id)) return "furniture_assembly";
  if (/^(?:handling_|stop_|pickup_address|delivery_address)/.test(id)) return "transport_handling";
  if (/^(?:dishwasher_|old_dishwasher|range_|refrigerator_)/.test(id)) return "appliance_installation";
  if (/^(?:cleaning_|home_access|surface_notes|pets$)/.test(id)) return "cleaning";
  if (/^(?:water_shutoff|plumbing_)/.test(id)) return "plumbing";
  if (/^(?:electrical_|fixture_parts|work_height)/.test(id)) return "electrical";
  if (/^(?:paint_|painting_|surface_condition)/.test(id)) return "painting";
  if (/^yard_/.test(id)) return "yard_garden";
  if (/^(?:organization_|sorting_decisions|disposal_scope)/.test(id)) return "organization";
  if (/^maintenance_/.test(id)) return "general_maintenance";
}

function groupTaskIntake(analysis: PlannerAnalysis, workstreams: JobIntelligence["workstreams"]) {
  const dishwasherComposite = isCompositeDishwasherRequest(analysis.sourceText);
  const dishwasherBlockId = "dishwasher_pickup_installation";
  const boxBlockId = "onsite_boxes";
  const blocks = new Map<string, CustomerTaskBlock>();
  const firstBlockForDomain = new Map<string, string>();
  for (const stream of workstreams) {
    const dishwasher = dishwasherComposite && /\bdishwasher\b/i.test(stream.title);
    const boxes = stream.phaseIds.includes("onsite_box_move");
    const id = dishwasher ? dishwasherBlockId : boxes ? boxBlockId : stream.id;
    const block = blocks.get(id);
    if (block) block.workstreamIds.push(stream.id);
    else blocks.set(id, {
      id,
      sequence: blocks.size + 1,
      title: dishwasher ? "Pick up, deliver, and install the dishwasher" : stream.title,
      workstreamIds: [stream.id],
    });
    if (!firstBlockForDomain.has(stream.domain)) firstBlockForDomain.set(stream.domain, id);
  }
  const taskBlocks = [...blocks.values()];
  if (!taskBlocks.length) return { taskBlocks, questions: analysis.questions };

  const questions = analysis.questions.map(question => {
    const domain = questionDomain(question.id);
    const dishwasherQuestion = /^(?:dishwasher_|old_dishwasher|retailer_|stop_\d+_|pickup_address$|service_address$|delivery_address$|building_permission$)/.test(question.id);
    const boxQuestion = blocks.has(boxBlockId) && (
      /^(?:handling_|(?:onsite_)?box_)/.test(question.id)
      || (/\bbox(?:es)?\b/i.test(question.label) && !/packaging|dishwasher/i.test(question.label))
    );
    const taskBlockId = question.taskBlockId && blocks.has(question.taskBlockId) ? question.taskBlockId
      : boxQuestion ? boxBlockId
        : blocks.has(dishwasherBlockId) && dishwasherQuestion ? dishwasherBlockId
          : domain ? firstBlockForDomain.get(domain) : undefined;
    return { ...question, taskBlockId: taskBlockId || taskBlocks[0].id };
  }).sort((left, right) => blocks.get(left.taskBlockId)!.sequence - blocks.get(right.taskBlockId)!.sequence);
  return { taskBlocks, questions };
}

export function buildJobIntelligence(analysis: PlannerAnalysis): PlannerAnalysis {
  const householdModel = buildHouseholdWorkModel(analysis);
  const primitives = buildPrimitives(analysis);
  const facts = buildFacts(analysis);
  const resources = buildResources(analysis);
  const reusableResourceIds: Record<string, string[]> = {
    transport_handling: ["vehicle", "straps", "blankets", "dolly", "ppe"],
    mounting: ["drill", "stud_finder", "level", "mounting_hardware", "ladder", "ppe"],
    furniture_assembly: ["assembly_tools", "level", "anti_tip", "ppe"],
    appliance_installation: ["dolly", "plumbing_tools", "plumbing_parts", "leak_protection", "appliance_install_tools", "appliance_connection_parts", "anti_tip", "level", "ppe"],
    plumbing: ["plumbing_tools", "plumbing_parts", "leak_protection", "ppe"],
    electrical: ["electrical_tools", "electrical_parts", "ladder", "ppe"],
    painting: ["painting_tools", "surface_protection", "prep_materials", "paint", "ladder", "ppe"],
    yard_garden: ["mower", "trimmer", "garden_tools", "yard_consumables", "ppe"],
    organization: ["bins_labels", "disposal_supplies", "dolly", "ppe"],
    cleaning: ["cleaning_equipment", "cleaning_products", "ppe"],
    elder_support: ["ppe"],
  };
  const knownResources = new Set(resources.map(resource => resource.id));
  const explicitTaskDomain = (title: string) => {
    const value = title.toLowerCase();
    // Classify the requested action before inspecting the item name. A route
    // title can contain "dishwasher" and even a street named "Test" without
    // becoming the installation task.
    if (/pick\s*up|transport|deliver|carry|boxes?|moving|place/.test(value)) return "transport_handling";
    if (/dish\s*washer|appliance|stove|range|oven|cooker|refrigerator|fridge|freezer|washing machine|washer|dryer/.test(value) && /install|connect|test/.test(value)) return "appliance_installation";
    if (/wall.mount|television|\btv\b|mount/.test(value)) return "mounting";
    return null;
  };
  const taskDomain = (title: string, index: number) => {
    const explicit = explicitTaskDomain(title);
    if (explicit) return explicit;
    const priorExplicitDomains = new Set<string>(
      analysis.tasks.slice(0, index).map(explicitTaskDomain).filter(d => d !== null),
    );
    return householdModel.domainDetails[index]?.id || householdModel.domainDetails.find(domain => !priorExplicitDomains.has(domain.id))?.id || "general_maintenance";
  };
  const usedPhaseIds = new Set<string>();
  const workstreams = analysis.tasks.map((title, index) => {
    const domainId = taskDomain(title, index);
    const domain = householdModel.domainDetails.find(candidate => candidate.id === domainId)
      || { id: domainId, label: title, qualification: "skilled_executor", phaseCount: 1 };
    const value = title.toLowerCase();
    const taskItemId = recognizeHouseholdItems(title)[0]?.id;
    const taskWorkAction = /pick\s*up/.test(value) ? "pickup" : /transport|deliver/.test(value) ? "delivery" : /install|connect|commission/.test(value) ? "installation" : undefined;
    const targetedOccurrence = Math.min(...primitives
      .filter(phase => !usedPhaseIds.has(phase.id)
        && phase.workAction === taskWorkAction
        && (!taskItemId || phase.itemId === taskItemId))
      .map(phase => phase.occurrence || 1));
    const domainPhases = primitives.filter(phase => {
      if (usedPhaseIds.has(phase.id) || (phase.domain || "general_maintenance") !== domainId) return false;
      if (phase.workAction && taskWorkAction) {
        return phase.workAction === taskWorkAction
          && (!taskItemId || !phase.itemId || phase.itemId === taskItemId)
          && (!Number.isFinite(targetedOccurrence) || (phase.occurrence || 1) === targetedOccurrence);
      }
      if (domainId !== "transport_handling") return true;
      if (/boxes?|garage|within the property/.test(value)) return /^onsite_(?:box|handling)_/.test(phase.id);
      if (/pick\s*up/.test(value)) return /^pickup_release|^load_protect_secure/.test(phase.id);
      if (/transport|deliver/.test(value)) return /^unload_place/.test(phase.id);
      return true;
    });
    // Generic plans still receive every phase for their domain. In a split
    // plan, the explicit title filters above keep pickup, delivery and later
    // on-property box handling as separate workstreams.
    if (!domainPhases.length) {
      primitives.filter(phase => !usedPhaseIds.has(phase.id) && (phase.domain || "general_maintenance") === domainId)
        .forEach(phase => domainPhases.push(phase));
    }
    domainPhases.forEach(phase => usedPhaseIds.add(phase.id));
    const transportPickup = domainId === "transport_handling" && /pick\s*up|transport|deliver/.test(value) && !/boxes?|garage/.test(value);
    const serviceGroup = transportPickup ? "transport" as const : domainId === "transport_handling" && !analysis.routeNodes.length ? "shared" as const : "in_home" as const;
    const assignedRole = transportPickup ? "Driver and appliance-handling crew" : domainId === "appliance_installation" ? "Qualified appliance installer" : domainId === "mounting" ? "Wall-mounting specialist" : domainId === "transport_handling" ? "In-home handling crew" : `${domain.label} executor`;
    const taskResources = (reusableResourceIds[domainId] || []).filter(id => knownResources.has(id))
      .filter(id => !(serviceGroup === "in_home" && id === "vehicle"))
      .filter(id => !(/boxes?|garage/.test(value) && ["straps", "vehicle"].includes(id)))
      .filter(id => !(/boxes?|garage/.test(value) && id === "blankets" && !/fragile|valuable|special handling/i.test(`${analysis.sourceText} ${analysis.extractedAnswers.handling_contents || ""}`)));
    const minimumCrew = Math.max(1, ...domainPhases.map(phase => phase.minimumCrew || 1));
    const recommendedCrew = Math.max(minimumCrew, ...domainPhases.map(phase => phase.recommendedCrew || 1));
    const likelyMinutes = domainPhases.reduce((sum, phase) => sum + phase.unitMinutes, 0);
    const rangeLow = domainPhases.reduce((sum, phase) => sum + (phase.lowMinutes || Math.round(phase.unitMinutes * .75)), 0);
    const rangeHigh = domainPhases.reduce((sum, phase) => sum + (phase.highMinutes || Math.round(phase.unitMinutes * 1.5)), 0);
    return {
      id: `task_${index + 1}_${domainId}`,
      sequence: index + 1,
      title,
      domain: domainId,
      qualification: domain.qualification,
      phaseIds: domainPhases.map(phase => phase.id),
      resourceIds: taskResources,
      minimumCrew,
      recommendedCrew,
      likelyMinutes,
      rangeLow,
      rangeHigh,
      completionGate: index < analysis.tasks.length - 1
        ? `Confirm Task ${index + 1} is complete and the result is accepted before Task ${index + 2} begins.`
        : `Confirm Task ${index + 1} and the complete work order are finished and accepted.`,
      serviceGroup,
      assignedRole,
      handoffRequired: serviceGroup === "transport" && analysis.tasks.slice(index + 1).some(task => /install|mount|boxes?|garage/i.test(task)),
    };
  });
  const { taskBlocks, questions } = groupTaskIntake(analysis, workstreams);
  const transportTaskSequences = workstreams.filter(stream => stream.serviceGroup === "transport").map(stream => stream.sequence);
  const inHomeTaskSequences = workstreams.filter(stream => stream.serviceGroup === "in_home").map(stream => stream.sequence);
  const coordinatedSpecialists = analysis.routeNodes.length > 1 && transportTaskSequences.length > 0 && inHomeTaskSequences.length > 0;
  const fulfillment: JobIntelligence["fulfillment"] = coordinatedSpecialists ? {
    mode: "coordinated_specialists",
    singleCustomerOrder: true,
    rationale: "A vehicle-equipped delivery crew and qualified in-home executors cover different requirements. Doneeo compares this handoff with a cross-qualified continuous team and recommends the lower-cost practical fit.",
    groups: [
      { id: "transport_unit", title: "Retail pickup and delivery unit", executorRole: "Driver plus appliance-handling support", taskSequences: transportTaskSequences, vehicleRequired: true, handoffAfterTask: Math.max(...transportTaskSequences) },
      { id: "in_home_unit", title: "In-home installation and finishing unit", executorRole: householdModel.domains.includes("mounting") ? "Qualified appliance installer, wall-mounting lead and handling support" : "Qualified appliance installer and handling support", taskSequences: inHomeTaskSequences, vehicleRequired: false, handoffAfterTask: null },
    ],
  } : {
    mode: "single_team",
    singleCustomerOrder: true,
    rationale: "One matched team can cover the confirmed tasks without an internal service handoff.",
    groups: [{ id: "single_team", title: "Complete execution team", executorRole: "Best-fit executor team", taskSequences: workstreams.map(stream => stream.sequence), vehicleRequired: analysis.routeNodes.length > 1, handoffAfterTask: null }],
  };
  const personMinutes = primitives.reduce((sum, item) => sum + item.personMinutes, 0);
  const access = accessMinutes(analysis);
  const minimum = Math.max(householdModel.minimumCrew, analysis.category === "moving" && (analysis.customerCanHelp === false || /heavy|large|stairs|appliance/.test(analysis.sourceText.toLowerCase())) ? 2 : 1);
  const recommended = Math.max(minimum, householdModel.recommendedCrew, analysis.recommendedTeamSize);
  const elapsedFor = (people: number) => {
    if (people < minimum) return Number.POSITIVE_INFINITY;
    const minutes = primitives.reduce((sum, item) => {
      const calibratedCrew = Math.max(item.minimumCrew || 1, item.recommendedCrew || 1);
      if (!item.parallelizable) return sum + item.unitMinutes;
      const usefulCrew = people <= calibratedCrew
        ? Math.max(1, people)
        : Math.min(4, calibratedCrew + (people - calibratedCrew) * 0.75);
      const scale = calibratedCrew / usefulCrew;
      return sum + item.unitMinutes * scale;
    }, 0);
    return Math.ceil((minutes + access) / 5) * 5;
  };
  const execution = elapsedFor(recommended);
  const route = analysis.routeNodes.length > 1 ? analysis.estimate.travelMinutes : 0;
  const routePending = analysis.routeNodes.length < 2 && isCompositeDishwasherRequest(analysis.sourceText);
  const uncertaintyRatio = householdModel.domains.some(domain => ["plumbing", "electrical", "general_maintenance"].includes(domain)) ? 0.2 : 0.15;
  const buffer = Math.max(15, Math.ceil((execution + route) * uncertaintyRatio / 5) * 5);
  const total = execution + route + buffer;
  const calibratedLow = primitives.reduce((sum, item) => sum + (item.lowMinutes || Math.round(item.unitMinutes * .75)), 0) + access + route;
  const calibratedHigh = primitives.reduce((sum, item) => sum + (item.highMinutes || Math.round(item.unitMinutes * 1.5)), 0) + access + route + buffer;
  const unresolved = questions.filter(question => question.required !== false).map(question => question.label);
  const score = Math.max(30, Math.min(95, 92 - unresolved.length * 9 - (analysis.routeNodes.length > 1 && !route ? 12 : 0)));
  const level = score >= 80 ? "high" : score >= 60 ? "medium" : "low";
  const alternatives: JobIntelligence["manpower"]["alternatives"] = [];
  for (let people = minimum; people <= 4 && alternatives.length < 3; people += 1) {
    const estimatedMinutes = elapsedFor(people);
    const previous = alternatives.at(-1);
    if (previous && estimatedMinutes >= previous.estimatedMinutes - 4) continue;
    alternatives.push({ people, estimatedMinutes, label: people === minimum ? "Safe minimum" : people === recommended ? "Recommended balance" : people < recommended ? "Lower-cost team" : "Faster practical team" });
  }
  const assumptions = [
    routePending ? "Travel time is calculated after pickup and installation locations are confirmed"
      : analysis.routeNodes.length > 1 ? "Travel time is recalculated from Google Routes after exact addresses are validated" : "All execution is at one property; no driving between work locations is included",
    "All listed parts and items are ready unless the work order says otherwise",
    "Unexpected access, site or item conditions can change the range",
  ];
  const manpowerReason = minimum > 1
    ? "The heaviest phase requires at least two eligible executors; credentials and safe crew minimums cannot be traded for speed."
    : recommended > minimum
      ? `${minimum} executor can complete the job, while ${recommended} are recommended because divisible carrying or task units can be completed in parallel with a shorter likely finish time.`
      : "One eligible executor can cover the known sequential phases; another executor is offered only when the model finds a real parallel time saving.";
  const intelligence: JobIntelligence = {
    version: "2.1.0",
    facts,
    primitives,
    resources,
    domains: householdModel.domainDetails,
    workstreams,
    fulfillment,
    manpower: { minimum, recommended, reason: manpowerReason, alternatives },
    estimate: { ready: unresolved.length === 0 && !routePending, personMinutes, executionMinutes: execution, accessMinutes: access, routeMinutes: route, bufferMinutes: buffer, totalMinutes: total, rangeLow: Math.max(15, Math.floor(calibratedLow / 5) * 5), rangeHigh: Math.ceil(calibratedHigh / 5) * 5, equation: route > 0 ? `${execution} min phase model + ${access} min access + ${route} min route + ${buffer} min uncertainty = ${total} min likely total` : `${execution} min phase model + ${access} min access + ${buffer} min uncertainty = ${total} min likely total · ${routePending ? "travel time pending" : "one property, no driving leg"}`, assumptions },
    confidence: { level, score, reason: unresolved.length ? `${unresolved.length} operational detail${unresolved.length > 1 ? "s are" : " is"} still required before matching and pricing.` : "Critical scope, access, schedule and resource inputs passed the Doneeo Rules Gate." },
    unresolved,
  };
  return { ...analysis, questions, taskBlocks, recommendedTeamSize: recommended, estimate: { ...analysis.estimate, serviceMinutesPerVisit: personMinutes, people: recommended }, intelligence };
}

export function answerContext(questions: PlannerQuestion[], answers: Record<string, string | boolean>) {
  return questions.flatMap(question => {
    const value = answers[question.id];
    if (!(typeof value === "boolean" || (typeof value === "string" && value.trim()))) return [];
    return [{ id: question.id, question: question.label, answer: value }];
  });
}
