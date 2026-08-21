import { extractStreetAddresses, type PlannerAnalysis, type PlannerQuestion, type RulesGateDomain, type RulesGateIssue, type RulesGateResult } from "./planner";

const domainLabels: Record<RulesGateDomain, string> = {
  request: "Request integrity",
  scope: "Scope and outcome",
  locations: "Locations and access",
  people: "People and eligibility",
  equipment: "Equipment and materials",
  safety: "Safety and licensing",
  schedule: "Schedule and capacity",
  routing: "Routing and coordination",
  commercial: "Price and protection",
  execution: "Execution and closeout",
};

const domainPassDetail: Record<RulesGateDomain, string> = {
  request: "The request is lawful, serviceable and preserved without inventing facts.",
  scope: "Every requested outcome remains represented in the work scope.",
  locations: "Required service locations and access dependencies are covered.",
  people: "Team size, skills, screening and provider class are bounded.",
  equipment: "Tools, reusable equipment, consumables and rental gaps are represented.",
  safety: "Known risk, licensing and regulated-service boundaries are applied.",
  schedule: "Timing, recurrence and provider capacity are covered before commitment.",
  routing: "Ordered stops, private coordination and route dependencies are covered.",
  commercial: "Estimates wait for critical facts and extra costs require approval.",
  execution: "Acceptance, readiness, milestones, changes and completion proof are controlled.",
};

function hasMeaningfulValue(value: unknown) {
  return typeof value === "boolean" || (typeof value === "string" && value.trim().length > 1);
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, all) => all.findIndex(candidate => candidate.toLowerCase() === value.toLowerCase()) === index);
}

export function applyDoneeoRulesGate(input: PlannerAnalysis): PlannerAnalysis {
  const source = input.sourceText.toLowerCase();
  const answers = input.extractedAnswers || {};
  const questions = [...input.questions];
  const issues: RulesGateIssue[] = [];
  const safeguards = [
    "Lock customer-supplied facts and never ask for them again",
    "Do not produce matching, route, time or price options until required facts are complete",
    "Verify provider identity, eligibility, skills, availability and task history before sending an offer",
    "Confirm every required tool, consumable, vehicle and rental before provider departure",
    "Require provider acceptance of the complete work order after payment authorization",
    "Share only each participant’s authorized stop, timing and validation information",
    "Record arrival, milestone completion, delays, scope changes and final customer validation",
    "Require customer approval before extra work, replacement materials or added charges",
  ];

  const addIssue = (issue: RulesGateIssue) => {
    if (!issues.some(existing => existing.code === issue.code)) issues.push(issue);
  };

  const addQuestion = (question: PlannerQuestion, issue: Omit<RulesGateIssue, "questionId">) => {
    if (hasMeaningfulValue(answers[question.id])) return;
    const exists = questions.some(existing => existing.id === question.id || existing.label.toLowerCase() === question.label.toLowerCase());
    if (!exists) questions.push(question);
    addIssue({ ...issue, questionId: question.id });
  };

  if (!input.tasks.length || !input.tasks.some(task => task.trim().length > 4)) {
    addIssue({ code: "scope.empty", domain: "scope", severity: "block", title: "No executable outcome", detail: "Doneeo cannot match a provider until at least one concrete task is preserved." });
  }

  if (/(urgent medical|medical emergency|not breathing|unconscious|severe injury|immediate danger)/i.test(source)) {
    addIssue({ code: "request.emergency", domain: "request", severity: "block", title: "Emergency response is outside Doneeo", detail: "Do not dispatch a marketplace provider. Direct the requester to the appropriate local emergency service." });
  }

  if (/(break into|forced entry|bypass (?:a )?lock|transport (?:a )?stolen|hide evidence|illegal dumping|dispose .{0,30} illegally)/i.test(source)) {
    addIssue({ code: "request.prohibited", domain: "request", severity: "block", title: "Request cannot be fulfilled", detail: "The described activity is unlawful or cannot be safely authorized through Doneeo." });
  }

  const mixedApplianceInstallation = /dish\s*washer|stove|range\b|oven|cooker|refrigerator|fridge|freezer|washing machine|washer|dryer|appliance/i.test(source) && /\b(?:install|instal|connect|hook\s*up|fit|set\s*up|commission)\b/i.test(source) && (input.routeNodes.length > 1 || /\b(?:pick\s*up|deliver|from|to)\b/i.test(source));
  let providerClass: RulesGateResult["providerClass"] = input.category === "installation" || mixedApplianceInstallation ? "skilled_executor" : "general_helper";
  let riskLevel: RulesGateResult["riskLevel"] = "standard";

  const regulatedCare = /(administer|give).{0,20}(?:medication|medicine)|personal care|bathing|dressing|clinical|nursing|medical procedure/i.test(source) || answers.medication === true || answers.personal_care === true;
  const connectionScope = String(answers.dishwasher_connection_scope || "").toLowerCase();
  const plumbingScope = String(answers.plumbing_modification || "").toLowerCase();
  const electricalScope = String(answers.electrical_scope || "").toLowerCase();
  const applianceEnergy = String(answers.range_energy_source || "").toLowerCase();
  const rangeConnectionScope = String(answers.range_connection_scope || "").toLowerCase();
  const simpleBulbOnly = /(?:change|replace).{0,24}(?:bulb|plug-in lamp)/i.test(source) && !/(hardwire|fixture|switch|outlet|circuit|panel|wiring)/i.test(source);
  const plumbingWork = /\bplumb(?:ing|er)?\b|water line|drain line|pipe|faucet|toilet|water heater/i.test(source);
  const electricalWork = !simpleBulbOnly && /\belectrical?\b|hardwire|wiring|outlet|switch|breaker|circuit|panel|light fixture/i.test(source);
  const regulatedTrade = plumbingWork || electricalWork || /(electrical panel|new circuit|rewir|gas line|gas appliance|plumb(?:ing)? connection|water line|load-bearing|structural wall|fire alarm|refrigerant)/i.test(source) || /new or modified/.test(connectionScope) || /new or modified/.test(plumbingScope) || /new or modified|gas/.test(rangeConnectionScope) || /hardwired|circuit|panel|wiring/.test(electricalScope) || /gas|dual fuel/.test(applianceEnergy) || answers.utilities === true || answers.regulated === true;
  const specialistRisk = /(asbestos|lead paint|black mold|biohazard|chemical spill|roof work|tree.{0,35}power line|pest infestation)/i.test(source);
  const elevatedWork = /(roof|ladder|ceiling|high wall|above.{0,10}(?:3|three) metres?|exterior window)/i.test(source);

  if (regulatedCare) {
    providerClass = "regulated_care_provider";
    riskLevel = "high";
    safeguards.push("Route regulated or personal-care activity only to an appropriately credentialed care provider");
    addIssue({ code: "safety.regulated_care", domain: "safety", severity: "warning", title: "Regulated care boundary detected", detail: "A general helper is not eligible. Credentials and permitted scope must be verified for the service jurisdiction." });
  } else if (regulatedTrade) {
    providerClass = "licensed_professional";
    riskLevel = "high";
    safeguards.push("Verify the required trade licence, insurance and permitted scope before matching");
    addIssue({ code: "safety.licensed_trade", domain: "safety", severity: "warning", title: "Licensed professional required", detail: "Doneeo must verify the trade credential and jurisdiction before the work order can be offered." });
  }

  if (specialistRisk) {
    providerClass = "specialist_only";
    riskLevel = "high";
    safeguards.push("Require specialist assessment, documented controls and appropriate disposal or containment plan");
    addIssue({ code: "safety.specialist", domain: "safety", severity: "warning", title: "Specialist assessment required", detail: "The environment may contain a hazardous condition that is not suitable for a general helper." });
  } else if (elevatedWork && riskLevel === "standard") {
    providerClass = "skilled_executor";
    riskLevel = "elevated";
    safeguards.push("Verify working-height equipment, fall controls and site conditions before dispatch");
    addIssue({ code: "safety.height", domain: "safety", severity: "warning", title: "Working-at-height controls", detail: "Matching must include relevant experience and task-appropriate access equipment." });
  }

  const fragileOrValuable = /(antique|piano|artwork|glass|marble|fragile|collectible|high[- ]value)/i.test(source);
  if (fragileOrValuable) {
    riskLevel = riskLevel === "high" ? "high" : "elevated";
    safeguards.push("Capture pre-service condition evidence and obtain explicit protection acceptance or decline");
    addQuestion(
      { id: "condition_value", label: "What is the item’s approximate value and current condition?", help: "Add photos before booking when damage risk or value is significant.", type: "text", required: true },
      { code: "commercial.condition", domain: "commercial", severity: "information", title: "Condition and value needed", detail: "Protection options and provider requirements depend on the item’s condition and approximate value." },
    );
  }

  const heavyOrBulky = input.category === "moving" && /(large|heavy|oversized|couch|sofa|piano|appliance|wardrobe|table)/i.test(source);
  let recommendedTeamSize = Math.max(1, Math.min(4, input.recommendedTeamSize));
  if (heavyOrBulky && (input.customerCanHelp === false || /stairs|no elevator/i.test(source))) {
    recommendedTeamSize = Math.max(2, recommendedTeamSize);
    riskLevel = riskLevel === "high" ? "high" : "elevated";
    safeguards.push("Do not count the customer or a recipient as required lifting labour");
    addIssue({ code: "people.lifting_team", domain: "people", severity: "warning", title: "Provider team must cover all lifting", detail: "At least two capable executors must be matched unless verified equipment and a task-specific assessment support another safe plan." });
  }

  const addresses = extractStreetAddresses(input.sourceText);
  const unresolvedExternalRoute = input.routeNodes.length === 1
    && /\b(?:pick\s*up|collect)\b.{0,180}\b(?:from|at)\s+(?:costco|ikea|walmart|home depot|rona|store|shop|retailer|warehouse|marketplace|seller)\b/i.test(input.sourceText);
  const hasDrivingRoute = input.routeNodes.length > 1 || addresses.length >= 2 || unresolvedExternalRoute;
  const hasServiceAnswer = ["service_address", "pickup_address", "delivery_address"].some(id => hasMeaningfulValue(answers[id]));
  const scheduleKnown = hasMeaningfulValue(answers.schedule) || /\b(?:today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i.test(input.sourceText);

  if (hasDrivingRoute) {
    if (input.stops.length < 2 && addresses.length < 2) {
      if (unresolvedExternalRoute) addIssue({ code: "routing.destination_pending", domain: "routing", severity: "information", title: "Delivery route is incomplete", detail: "The retailer pickup is known, but the destination must be supplied before Doneeo can calculate or coordinate the driving route." });
      if (!/(pick\s*up|collect).{0,180}\b\d{1,6}\s+/i.test(input.sourceText)) addQuestion(
        { id: "pickup_address", label: "What is the pickup location?", help: "A complete address or uniquely identifiable place is required for the first route node.", type: "text", required: true },
        { code: "locations.pickup", domain: "locations", severity: "information", title: "Pickup node missing", detail: "The first route node must be known before route and price calculation." },
      );
      if (!/(deliver|drop|take).{0,180}\b\d{1,6}\s+/i.test(input.sourceText)) addQuestion(
        { id: "service_address", label: "What is the final delivery location?", help: "A complete address or uniquely identifiable place is required for the final route node.", type: "text", required: true },
        { code: "locations.delivery", domain: "locations", severity: "information", title: "Final route node missing", detail: "The destination must be known before route and price calculation." },
      );
    }
    if (!input.items.length && !/(furniture|boxes|belongings|equipment|order)/i.test(source)) addQuestion(
      { id: "item", label: "Exactly what must be moved?", help: "Include quantity and approximate dimensions or weight when known.", type: "text", required: true },
      { code: "scope.moving_items", domain: "scope", severity: "information", title: "Moved items are not defined", detail: "Vehicle, team and handling requirements cannot be validated without the item scope." },
    );
  } else if (!hasServiceAnswer && addresses.length === 0 && !input.stops.length) {
    addQuestion(
      { id: "service_address", label: "Where will the service be performed?", help: "Enter the address or a uniquely identifiable location.", type: "text", required: true },
      { code: "locations.service", domain: "locations", severity: "information", title: "Service location missing", detail: "Location affects eligibility, travel, access, schedule and price." },
    );
  }

  if (!scheduleKnown) addQuestion(
    { id: "schedule", label: input.recurrence.recurring ? "What days and time windows should the recurring service use?" : "What date and arrival window should Doneeo plan for?", help: "A specific window allows availability and deadline validation.", type: "text", required: true },
    { code: "schedule.missing", domain: "schedule", severity: "information", title: "Requested timing missing", detail: "Doneeo cannot confirm provider availability or a completion window without the requested schedule." },
  );

  if (input.recurrence.recurring) {
    safeguards.push("Confirm recurrence, continuity preference, cancellation terms and a backup-provider policy");
    if (input.recurrence.frequency === "Recurring schedule to confirm" && !hasMeaningfulValue(answers.frequency)) addQuestion(
      { id: "frequency", label: "How often should this service repeat?", type: "text", required: true },
      { code: "schedule.frequency", domain: "schedule", severity: "information", title: "Recurring frequency missing", detail: "Recurring matching and price require a defined frequency." },
    );
  }

  if (!input.equipment.length && input.category !== "elder_support") {
    addIssue({ code: "equipment.empty", domain: "equipment", severity: "block", title: "Resource plan missing", detail: "No provider can be matched until the required tools, materials, consumables, vehicle and safety equipment are identified." });
  } else if (input.equipment.some(item => item.required)) {
    safeguards.push("Resolve each required resource as customer-owned, provider-owned, rental or approved purchase");
  }

  if (input.category === "cleaning") {
    safeguards.push("Confirm product restrictions, delicate surfaces, reusable equipment and consumable purchase responsibility");
  }

  if (hasDrivingRoute) {
    safeguards.push("Preserve stop order, calculate every route leg and require a checkpoint before moving to the next node");
    safeguards.push("Confirm the authorized contact at each stop without exposing unrelated stops or price");
  }

  if (mixedApplianceInstallation) {
    safeguards.push("Preserve pickup, delivery, installation and operational testing as separate dependent work phases");
    safeguards.push("Match transport capability and installation eligibility independently; combine them only when the selected provider covers both");
    safeguards.push("Do not begin installation until the appliance model, energy or utility connection scope, required parts and building permission are confirmed");
    addIssue({ code: "scope.composite_appliance", domain: "scope", severity: "information", title: "Composite delivery and installation order", detail: "The work order must retain both transport and on-site installation rather than classifying the complete request as moving only." });
  }

  if (/(outdoor|yard|garden|snow|roof|exterior|tree)/i.test(source)) {
    riskLevel = riskLevel === "high" ? "high" : "elevated";
    safeguards.push("Recheck weather, daylight and site conditions before dispatch; reschedule when safe execution is not possible");
  }

  const requiredQuestions = questions.filter(question => question.required !== false && !hasMeaningfulValue(answers[question.id]));
  const hasBlock = issues.some(issue => issue.severity === "block");
  const status: RulesGateResult["status"] = hasBlock ? "blocked" : requiredQuestions.length ? "needs_information" : "cleared";
  const domains = (Object.keys(domainLabels) as RulesGateDomain[]).map(id => {
    const domainIssues = issues.filter(issue => issue.domain === id);
    const domainStatus = domainIssues.some(issue => issue.severity === "block") ? "blocked" : domainIssues.length ? "attention" : "pass";
    const passDetail = id === "routing" && !hasDrivingRoute ? "One-property scope confirmed; no driving route or stop coordination is required." : domainPassDetail[id];
    return { id, label: domainLabels[id], status: domainStatus as "pass" | "attention" | "blocked", detail: domainIssues[0]?.detail || passDetail };
  });
  const summary = hasBlock
    ? "Doneeo stopped this request before matching because a hard rule is unresolved."
    : requiredQuestions.length
      ? `${requiredQuestions.length} required detail${requiredQuestions.length === 1 ? "" : "s"} must be resolved before matching, ${hasDrivingRoute ? "route, " : ""}time and price options.`
      : "All intake rules are cleared. Doneeo may calculate transparent work options.";

  const rulesGate: RulesGateResult = {
    version: "1.0",
    status,
    riskLevel,
    providerClass,
    summary,
    issues,
    safeguards: uniqueStrings(safeguards),
    domains,
  };

  return {
    ...input,
    questions: questions.filter((question, index, all) => all.findIndex(candidate => candidate.id === question.id) === index),
    recommendedTeamSize,
    estimate: { ...input.estimate, people: recommendedTeamSize },
    rulesGate,
  };
}
