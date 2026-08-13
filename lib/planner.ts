export type JobCategory = "moving" | "installation" | "cleaning" | "elder_support" | "general";

export type PlannerQuestion = {
  id: string;
  label: string;
  help?: string;
  type: "text" | "choice" | "boolean";
  options?: string[];
  required?: boolean;
};

export type RulesGateDomain = "request" | "scope" | "locations" | "people" | "equipment" | "safety" | "schedule" | "routing" | "commercial" | "execution";

export type RulesGateIssue = {
  code: string;
  domain: RulesGateDomain;
  severity: "information" | "warning" | "block";
  title: string;
  detail: string;
  questionId?: string;
};

export type RulesGateResult = {
  version: string;
  status: "blocked" | "needs_information" | "cleared";
  riskLevel: "standard" | "elevated" | "high";
  providerClass: "general_helper" | "skilled_executor" | "licensed_professional" | "regulated_care_provider" | "specialist_only";
  summary: string;
  issues: RulesGateIssue[];
  safeguards: string[];
  domains: Array<{ id: RulesGateDomain; label: string; status: "pass" | "attention" | "blocked"; detail: string }>;
};

export type PlannerAnalysis = {
  category: JobCategory;
  title: string;
  summary: string;
  safetyNote: string;
  questions: PlannerQuestion[];
  extractedAnswers: Record<string, string | boolean>;
  tasks: string[];
  stops: string[];
  routeNodes: RouteNode[];
  scheduleWindow: ScheduleWindow | null;
  items: string[];
  customerCanHelp: boolean | null;
  equipment: EquipmentRequirement[];
  recurrence: { recurring: boolean; frequency: string };
  recommendedTeamSize: number;
  skillRequirements: string[];
  executionSteps: string[];
  understoodFacts: string[];
  estimate: { serviceMinutesPerVisit: number; travelMinutes: number; people: number; recurringVisits: string; materialsSummary: string };
  sourceText: string;
  audit: { status: "verified" | "corrected" | "deterministic"; issues: string[]; checks: string[]; pipeline?: string };
  rulesGate?: RulesGateResult;
  intelligence?: JobIntelligence;
};

export type JobFact = {
  key: string;
  label: string;
  value: string;
  source: "customer_request" | "customer_answer" | "derived";
  confidence: "confirmed" | "inferred";
};

export type TaskPrimitive = {
  id: string;
  label: string;
  quantity: number;
  unitMinutes: number;
  personMinutes: number;
  parallelizable: boolean;
  dependencies: string[];
  domain?: string;
  lowMinutes?: number;
  highMinutes?: number;
  minimumCrew?: number;
  recommendedCrew?: number;
  qualification?: "general_helper" | "skilled_executor" | "licensed_professional" | "regulated_care_provider" | "specialist_only";
  locationIndex?: number;
};

export type ResourceGap = {
  id: string;
  name: string;
  kind: "tool" | "equipment" | "vehicle" | "material" | "consumable";
  status: "customer_confirmed" | "executor_to_verify" | "purchase_required" | "rental_fallback";
  resolution: string;
  estimatedCost: number;
};

export type JobIntelligence = {
  version: string;
  facts: JobFact[];
  primitives: TaskPrimitive[];
  resources: ResourceGap[];
  domains?: Array<{ id: string; label: string; qualification: string; phaseCount: number }>;
  workstreams: Array<{
    id: string;
    sequence: number;
    title: string;
    domain: string;
    qualification: string;
    phaseIds: string[];
    resourceIds: string[];
    minimumCrew: number;
    recommendedCrew: number;
    likelyMinutes: number;
    rangeLow: number;
    rangeHigh: number;
    completionGate: string;
    serviceGroup: "transport" | "in_home" | "shared";
    assignedRole: string;
    handoffRequired: boolean;
  }>;
  fulfillment: {
    mode: "single_team" | "coordinated_specialists";
    singleCustomerOrder: true;
    rationale: string;
    groups: Array<{
      id: string;
      title: string;
      executorRole: string;
      taskSequences: number[];
      vehicleRequired: boolean;
      handoffAfterTask: number | null;
    }>;
  };
  manpower: {
    minimum: number;
    recommended: number;
    reason: string;
    alternatives: Array<{ people: number; estimatedMinutes: number; label: string }>;
  };
  estimate: {
    ready: boolean;
    personMinutes: number;
    executionMinutes: number;
    accessMinutes: number;
    routeMinutes: number;
    bufferMinutes: number;
    totalMinutes: number;
    rangeLow: number;
    rangeHigh: number;
    equation: string;
    assumptions: string[];
  };
  confidence: {
    level: "high" | "medium" | "low";
    score: number;
    reason: string;
  };
  unresolved: string[];
};

export type RouteNode = {
  location: string;
  actions: string[];
};

export type ScheduleWindow = {
  dateLabel: string;
  arrivalTime: string;
  deadlineTime?: string;
  arrivalLabel: string;
  deadlineLabel?: string;
};

export type EquipmentRequirement = {
  id: string;
  name: string;
  purpose: string;
  required: boolean;
  rentalEstimate: number;
  supplyType?: "reusable" | "consumable";
};

const clockPattern = String.raw`(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)`;

export function normalizeIntakeForInference(sourceText: string) {
  return sourceText
    .replace(/\b(?:coscto|costico|costo)\b/gi, "costco")
    .replace(/\bdishwacher\b/gi, "dishwasher")
    .replace(/\b(?:frige|refridgerator|refrigerater)\b/gi, "refrigerator")
    .replace(/\b(?:appartement|apartement|appartment|appratment)\b/gi, "apartment")
    .replace(/\b(?:bassment|baisment)\b/gi, "basement")
    .replace(/\bkistchen\b/gi, "kitchen")
    .replace(/\bleaving room\b/gi, "living room")
    .replace(/\bstaturday\b/gi, "saturday")
    .replace(/\bpreferblu\b/gi, "preferably")
    .replace(/\bmu(?=\s+apartment\b)/gi, "my")
    .replace(/\bthe\s+unstall\b/gi, "then install")
    .replace(/\bunstall\b/gi, "install")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClock(hourText: string, minuteText: string | undefined, meridiemText: string) {
  const hour = Math.max(1, Math.min(12, Number(hourText)));
  const minutes = Math.max(0, Math.min(59, Number(minuteText || "0")));
  return `${hour}:${String(minutes).padStart(2, "0")} ${meridiemText.replaceAll(".", "").toUpperCase()}`;
}

function titleCaseDate(value: string) {
  return value.trim().replace(/\b\w/g, letter => letter.toUpperCase());
}

export function extractScheduleWindow(sourceText: string): ScheduleWindow | null {
  sourceText = normalizeIntakeForInference(sourceText);
  const dateMatch = sourceText.match(/\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i);
  const dateLabel = titleCaseDate(dateMatch?.[1] || "Requested date");
  const deadlineRegex = new RegExp(String.raw`\b(?:finish|complete|completed|done|end)[^.;\n]{0,35}?\b(?:before|by)\s+${clockPattern}`, "i");
  const looseDeadlineRegex = new RegExp(String.raw`\b(?:before|no later than)\s+${clockPattern}`, "i");
  const deadlineMatch = sourceText.match(deadlineRegex) || sourceText.match(looseDeadlineRegex);
  const deadlineTime = deadlineMatch ? normalizeClock(deadlineMatch[1], deadlineMatch[2], deadlineMatch[3]) : undefined;

  const explicitArrivalRegex = new RegExp(String.raw`\b(?:arrive|arrival|start|starting|begin|be there|show up)\s+(?:at|by)\s+${clockPattern}`, "i");
  const datedArrivalRegex = new RegExp(String.raw`\b(?:today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b[^.;\n]{0,30}?\bat\s+${clockPattern}`, "i");
  let arrivalMatch = sourceText.match(explicitArrivalRegex) || sourceText.match(datedArrivalRegex);

  if (!arrivalMatch) {
    const allAtTimes = Array.from(sourceText.matchAll(new RegExp(String.raw`\bat\s+${clockPattern}`, "gi")));
    arrivalMatch = allAtTimes.find(match => {
      const prefix = sourceText.slice(Math.max(0, (match.index || 0) - 35), match.index || 0);
      return !/(?:finish|complete|completed|done|end|before|no later than)\s*$/i.test(prefix);
    }) || null;
  }

  const looseStartMatch = !arrivalMatch
    ? sourceText.match(/\b(?:start|starting|begin|beginning)\s+(?:at|from)\s+(\d{1,2})(?::(\d{2}))?\b/i)
    : null;
  const datedLooseStartMatch = !arrivalMatch && !looseStartMatch
    ? sourceText.match(/\b(?:today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b[^.;\n]{0,30}?\bat\s+(\d{1,2})(?::(\d{2}))?\b/i)
    : null;
  const arrivalTime = arrivalMatch
    ? normalizeClock(arrivalMatch[1], arrivalMatch[2], arrivalMatch[3])
    : looseStartMatch
      ? normalizeClock(looseStartMatch[1], looseStartMatch[2], "AM")
      : datedLooseStartMatch
        ? normalizeClock(datedLooseStartMatch[1], datedLooseStartMatch[2], "AM")
      : "";
  if (!arrivalTime && !deadlineTime) return null;
  return {
    dateLabel,
    arrivalTime,
    deadlineTime,
    arrivalLabel: arrivalTime ? `${dateLabel} at ${arrivalTime}` : `${dateLabel} · arrival time to confirm`,
    deadlineLabel: deadlineTime ? `${dateLabel} by ${deadlineTime}` : undefined,
  };
}

function cleanRouteText(value: string) {
  return value
    .split(/\b(?:I|we|the customer)\s+(?:cannot|can't|can not|won't|will not|am unable|are unable)\b|\b(?:finish|complete|completed|done|deadline)\b/i)[0]
    .split(/[.!?]\s+(?=(?:The|There|This|It|Both|All|Each|I|We|Pick|Collect|Deliver|Bring|Carry|Move|Install|Mount|Remove)\b)/i)[0]
    .split(/\b(?:both|all|each)\s+(?:tables?|items?|pieces?|objects?)\s+(?:are|is|weigh|have)\b/i)[0]
    .split(/\s+(?:and\s+)?(?:then\s+)?(?:install|instal|connect|hook\s*up|set\s*up|commission)\b/i)[0]
    .replace(/\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?(?:\s+and)?$/i, "")
    .replace(/(?:,?\s+(?:on|at)?\s*(?:the\s+)?(?:ground|street[ -]?level|\d+(?:st|nd|rd|th)?)\s+(?:floor|level)\b.*)$/i, "")
    .replace(/,?\s+and$/i, "")
    .replace(/\bthen\s*$/i, "")
    .replace(/^[\s,:;-]+|[\s,:;.-]+$/g, "")
    .trim();
}

function cleanItem(value: string) {
  return value
    .replace(/\b(?:already\s+)?paid\s+for\b/gi, "")
    .replace(/\b(?:already\s+)?ready\b/gi, "")
    .replace(/\b(?:and|or)\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,:;-]+|[\s,:;.-]+$/g, "")
    .trim();
}

function addRouteNode(nodes: RouteNode[], location: string, action: string) {
  const normalizedLocation = cleanRouteText(location);
  if (!normalizedLocation || normalizedLocation.length < 2) return;
  const existing = nodes.find(node => node.location.toLowerCase() === normalizedLocation.toLowerCase());
  if (existing) {
    if (!existing.actions.some(value => value.toLowerCase() === action.toLowerCase())) existing.actions.push(action);
    return;
  }
  nodes.push({ location: normalizedLocation, actions: [action] });
}

export function deriveRouteNodes(sourceText: string): RouteNode[] {
  const actionMatches = Array.from(sourceText.matchAll(/\b(?:pick\s*up|collect|deliver|drop\s*off|take|bring)\b/gi));
  if (!actionMatches.length) return [];
  const nodes: RouteNode[] = [];
  let carriedItem = "item";

  actionMatches.forEach((match, index) => {
    const start = match.index || 0;
    const end = index + 1 < actionMatches.length ? actionMatches[index + 1].index || sourceText.length : sourceText.length;
    const clause = sourceText.slice(start, end).replace(/^[\s,;]+|[\s,;]+$/g, "").trim();
    const verb = match[0].toLowerCase().replace(/\s+/g, " ");

    if (/^(?:pick up|pickup|collect)$/.test(verb)) {
      const parts = clause.match(/^(?:pick\s*up|collect)\s+(.+?)\s+(?:at|from)\s+(.+)$/i);
      if (!parts) {
        const localPickup = clause.match(/^(?:pick\s*up|collect)\s+(.+)$/i);
        const localItem = cleanItem(localPickup?.[1] || "");
        if (localItem && nodes.length) {
          carriedItem = localItem;
          const previous = nodes[nodes.length - 1];
          const pickupAction = `Pick up ${localItem}`;
          if (!previous.actions.some(action => action.toLowerCase() === pickupAction.toLowerCase())) previous.actions.push(pickupAction);
        }
        return;
      }
      carriedItem = cleanItem(parts[1]) || carriedItem;
      addRouteNode(nodes, parts[2], `Pick up ${carriedItem}`);
      return;
    }

    if (/^(?:deliver|drop off|bring)$/.test(verb)) {
      const parts = clause.match(/^(?:deliver|drop\s*off|bring)\s+(.+?)\s+to\s+(.+)$/i);
      if (!parts) return;
      const rawItem = cleanItem(parts[1]);
      const item = /^(?:it|them|this|that|the item)$/i.test(rawItem) ? carriedItem : rawItem || carriedItem;
      carriedItem = item;
      addRouteNode(nodes, parts[2], `Deliver ${item}`);
      return;
    }

    if (verb === "take") {
      const parts = clause.match(/^take\s+(.+?)\s+to\s+(.+)$/i);
      if (!parts) return;
      const item = cleanItem(parts[1]) || "item";
      if (nodes.length) {
        const previous = nodes[nodes.length - 1];
        const pickupAction = `Pick up ${item}`;
        if (!previous.actions.some(action => action.toLowerCase() === pickupAction.toLowerCase())) previous.actions.push(pickupAction);
      }
      carriedItem = item;
      addRouteNode(nodes, parts[2], `Deliver ${item}`);
    }
  });

  return nodes;
}

function equipmentFor(category: JobCategory, text: string): EquipmentRequirement[] {
  if (category === "cleaning") return [
    { id: "vacuum", name: "Vacuum cleaner", purpose: "Vacuum bedrooms and common areas before floor cleaning", required: true, rentalEstimate: 20, supplyType: "reusable" },
    { id: "mop", name: "Mop and bucket", purpose: "Wash suitable hard floors", required: true, rentalEstimate: 12, supplyType: "reusable" },
    { id: "microfiber", name: "Microfiber cloth set", purpose: "Dust and wipe surfaces without cross-contamination", required: true, rentalEstimate: 8, supplyType: "consumable" },
    { id: "bathroom_cleaner", name: "Bathroom cleaner", purpose: "Clean and disinfect the two bathrooms", required: /bathroom/i.test(text), rentalEstimate: 7, supplyType: "consumable" },
    { id: "kitchen_degreaser", name: "Kitchen degreaser", purpose: "Clean kitchen work surfaces and cooking residue", required: /kitchen/i.test(text), rentalEstimate: 7, supplyType: "consumable" },
    { id: "floor_cleaner", name: "Floor cleaner", purpose: "Clean floors using a surface-compatible product", required: /floor/i.test(text), rentalEstimate: 6, supplyType: "consumable" },
    { id: "gloves_bags", name: "Gloves and waste bags", purpose: "Safe handling and removal of routine household waste", required: true, rentalEstimate: 6, supplyType: "consumable" },
  ].filter(item => item.required);
  if (category === "moving") return [
    { id: "vehicle", name: /small|chair|box/i.test(text) ? "Pickup truck or cargo van" : "Cargo van or moving truck", purpose: "Transport every listed item between stops", required: true, rentalEstimate: 75 },
    { id: "straps", name: "Moving straps", purpose: "Secure furniture during transport", required: true, rentalEstimate: 10 },
    { id: "blankets", name: "Protective blankets", purpose: "Prevent surface and furniture damage", required: true, rentalEstimate: 12 },
    { id: "dolly", name: "Furniture dolly", purpose: "Move heavy items safely", required: true, rentalEstimate: 18 },
  ];
  if (category === "installation") return [
    { id: "drill", name: "Drill and bit set", purpose: "Assembly and secure installation", required: true, rentalEstimate: 18 },
    { id: "level", name: "Level and measuring kit", purpose: "Accurate placement and alignment", required: true, rentalEstimate: 8 },
    { id: "anchors", name: "Task-appropriate anchors", purpose: "Secure mounting for the identified surface", required: true, rentalEstimate: 12 },
    { id: "stud_finder", name: "Stud finder", purpose: "Locate safe wall fixing points", required: /wall|mount|secure|shelf|tv/i.test(text), rentalEstimate: 10 },
  ].filter(item => item.required);
  if (category === "elder_support") return [
    { id: "transport", name: "Suitable transportation", purpose: "Complete errands and deliveries in the work order", required: /grocer|errand|pickup|deliver/i.test(text), rentalEstimate: 35 },
  ].filter(item => item.required);
  return [
    { id: "toolkit", name: "General task toolkit", purpose: "Complete the requested practical work", required: true, rentalEstimate: 15 },
    { id: "ppe", name: "Task-appropriate safety equipment", purpose: "Protect the provider and work area", required: true, rentalEstimate: 10 },
  ];
}

const commonTiming: PlannerQuestion = {
  id: "schedule",
  label: "When should this happen?",
  help: "A date, time window, or level of urgency is enough.",
  type: "text",
  required: true,
};

const questionSets: Record<JobCategory, PlannerQuestion[]> = {
  moving: [
    { id: "pickup_address", label: "Pickup address", type: "text", required: true },
    { id: "service_address", label: "Delivery address", type: "text", required: true },
    { id: "item", label: "What is being moved?", help: "Include approximate size or weight if known.", type: "text", required: true },
    { id: "floor", label: "Delivery access", type: "choice", options: ["Ground floor", "2nd floor", "3rd floor", "4th+ floor"], required: true },
    { id: "elevator", label: "Is there a usable elevator?", type: "boolean" },
    { id: "customer_help", label: "Can you safely help carry?", type: "boolean" },
    { id: "straps", label: "Do you already have moving straps?", type: "boolean" },
    commonTiming,
  ],
  installation: [
    { id: "service_address", label: "Installation address", type: "text", required: true },
    { id: "item", label: "What needs to be assembled or installed?", type: "text", required: true },
    { id: "mounting", label: "Does it attach to a wall or ceiling?", type: "boolean" },
    { id: "utilities", label: "Does it involve electricity, gas, or plumbing?", type: "boolean", help: "Regulated connections may require a licensed professional." },
    { id: "materials", label: "Are all parts and mounting materials available?", type: "boolean" },
    { id: "instructions", label: "Do you have the instructions or product model?", type: "boolean" },
    commonTiming,
  ],
  cleaning: [],
  elder_support: [
    { id: "service_address", label: "Where will support be provided?", type: "text", required: true },
    { id: "tasks", label: "What support is needed?", help: "For example: groceries, companionship, meal preparation, or a wellness visit.", type: "text", required: true },
    { id: "independent", label: "Can the person walk and manage daily activities independently?", type: "boolean" },
    { id: "personal_care", label: "Is bathing, dressing, lifting, or other personal care requested?", type: "boolean" },
    { id: "medication", label: "Is medication administration requested?", type: "boolean" },
    { id: "cognitive", label: "Is specialized dementia or cognitive support required?", type: "boolean" },
    { id: "frequency", label: "Is this one visit or recurring support?", type: "choice", options: ["One visit", "Weekly", "Twice weekly", "Other recurring"], required: true },
    commonTiming,
  ],
  general: [
    { id: "service_address", label: "Where is the work needed?", type: "text", required: true },
    { id: "task_details", label: "What would a prepared helper need to know?", type: "text", required: true },
    { id: "tools", label: "Do you have the required tools or equipment?", type: "boolean" },
    { id: "regulated", label: "Could this require a licence or certified professional?", type: "boolean" },
    commonTiming,
  ],
};

export function questionsFor(category: JobCategory) {
  return questionSets[category];
}

function stopAccessQuestions(stops: string[]): PlannerQuestion[] {
  const route = stops.length ? stops : ["Pickup location", "Delivery location"];
  return route.flatMap((stop, index) => {
    const number = index + 1;
    const role = index === 0 ? "PICKUP" : index === route.length - 1 ? "FINAL DELIVERY" : `STOP ${number}`;
    const retailerPickup = index === 0 && /\b(?:costco|ikea|walmart|home depot|rona|store|shop|retailer|warehouse)\b/i.test(stop);
    if (retailerPickup) return [{ id: `stop_${number}_vehicle_access`, label: `${role} · Is there a designated loading or merchandise-pickup area?`, help: `${stop} — include the bay, parking instructions or retailer collection process if known.`, type: "choice" as const, options: ["Yes — designated loading area", "Regular parking only", "Not sure"], required: true }];
    return [
      { id: `stop_${number}_floor`, label: `${role} · What floor is the item on?`, help: `${stop} — include basement or ground floor.`, type: "choice" as const, options: ["Ground floor", "2nd floor", "3rd floor", "4th+ floor"], required: true },
      { id: `stop_${number}_elevator`, label: `${role} · Is there a usable elevator?`, help: "This changes handling time and team size for this location only.", type: "boolean" as const, required: true },
      { id: `stop_${number}_vehicle_access`, label: `${role} · Can the vehicle stop close to the entrance?`, help: "Consider loading zones, parking restrictions, gates and long walking distances.", type: "choice" as const, options: ["Yes — close access", "Limited access", "No — remote parking"], required: true },
    ];
  });
}

function routeStopPosition(sourceText: string, stop: string, index: number) {
  const streetNumber = stop.match(/\b\d{1,6}\b/)?.[0];
  if (streetNumber) {
    const match = new RegExp(`\\b${streetNumber}\\b`, "i").exec(sourceText);
    if (match?.index !== undefined) return match.index;
  }
  const words = stop.match(/[A-Za-zÀ-ÖØ-öø-ÿ]{4,}/g) || [];
  for (const word of words) {
    const position = sourceText.toLowerCase().indexOf(word.toLowerCase());
    if (position >= 0) return position;
  }
  return index * Math.max(1, Math.floor(sourceText.length / 3));
}

/** Returns the part of the request that belongs to one route stop. */
function stopContext(sourceText: string, stops: string[], index: number) {
  const positions = stops.map((stop, stopIndex) => routeStopPosition(sourceText, stop, stopIndex));
  const current = positions[index] ?? 0;
  const next = index < positions.length - 1 ? positions[index + 1] : sourceText.length;
  const start = Math.max(0, current);
  const end = Math.min(sourceText.length, Math.max(current + 1, next));
  return sourceText.slice(start, end);
}

function contextHasFloor(context: string) {
  return /\bground[ -]?floor\b|\b(?:floor|level)\s*(?:#\s*)?\d+\b|\b\d+(?:st|nd|rd|th)?\s*(?:floor|level)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+flights?\s+of\s+stairs?\b/i.test(context);
}

function contextMakesElevatorIrrelevant(context: string) {
  return /\bground[ -]?floor\b|\bstreet[ -]?level\b/i.test(context);
}

export function deriveStopAccessNote(sourceText: string, stops: string[], index: number) {
  const context = `${stopContext(sourceText, stops, index)} ${stops[index] || ""}`;
  const details: string[] = [];
  const floor = context.match(/\bground[ -]?floor\b|\bstreet[ -]?level\b|\b(?:floor|level)\s*(?:#\s*)?\d+\b|\b\d+(?:st|nd|rd|th)?\s*(?:floor|level)\b/i)?.[0];
  const stairs = context.match(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+flights?\s+of\s+stairs?\b/i)?.[0];
  const elevator = context.match(/\b(?:no|without)\s+(?:usable\s+)?elevator\b|\b(?:has|with|there is|usable)\s+(?:an?\s+)?elevator\b/i)?.[0];
  if (floor) details.push(floor);
  if (stairs) details.push(stairs);
  if (elevator) details.push(elevator);
  if (contextMakesElevatorIrrelevant(context) && !elevator) details.push("Elevator not required");
  return details.length ? details.join(" · ") : "Access details to confirm";
}

function contextualQuestions(category: JobCategory, text: string, recurring: boolean, stops: string[]): PlannerQuestion[] {
  if (category === "elder_support") {
    return [
      { id: "service_address", label: "What is your father’s service address?", help: "Used to match a nearby provider and estimate travel.", type: "text", required: true },
      ...(!/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|\d{1,2}\s*(?:am|pm))/i.test(text) ? [{ id: "preferred_visits", label: recurring ? "Which two days and time windows work best?" : "What day and time works best?", help: "For example: Tuesday and Friday, 10 a.m.–1 p.m.", type: "text" as const, required: true }] : []),
      { id: "grocery_method", label: "How should groceries be ordered and paid for?", type: "choice", options: ["Provider shops from my list", "Order prepared for pickup", "Decide with my father"], required: true },
      { id: "visit_update", label: "What should the visit update include?", type: "choice", options: ["Completion note", "Note and photos", "Phone call after each visit"], required: true },
      { id: "home_access", label: "How will the provider enter or meet your father?", help: "Doorbell, concierge, key arrangement, or your father answers.", type: "text", required: true },
      { id: "emergency_contact", label: "Who should Doneeo contact if something prevents the visit?", help: "Name and test phone number for this prototype.", type: "text", required: true },
      { id: "preferred_provider", label: "For recurring visits, do you prefer the same provider each time?", type: "choice", options: ["Yes, same provider", "Same provider plus backup", "No preference"], required: true },
    ];
  }
  if (category === "moving") return [
    { id: "pickup_address", label: "Exact pickup address", type: "text", required: true },
    { id: "service_address", label: "Exact final delivery address", type: "text", required: true },
    { id: "item", label: "What is being moved?", help: "Include approximate dimensions or weight if known.", type: "text", required: true },
    ...stopAccessQuestions(stops),
    { id: "pickup_contact_help", label: "Can the pickup contact safely help load?", help: "This is separate from whether the customer can help at delivery.", type: "boolean", required: true },
    { id: "customer_help", label: "Can you safely help carry at final delivery?", type: "boolean", required: true },
    commonTiming,
  ];
  if (category === "installation") return [
    { id: "service_address", label: "What is the office installation address?", help: "Required for provider and rental-route estimates.", type: "text", required: true },
    ...(/shel|wall|mount/i.test(text) ? [{ id: "wall_type", label: "What type of wall will the shelves be mounted on?", help: "Drywall, concrete, brick, or unknown—this determines anchors and drilling equipment.", type: "choice" as const, options: ["Drywall", "Concrete or brick", "Unknown"], required: true }] : []),
    { id: "fasteners", label: "Are shelf brackets, anchors and fasteners included?", help: "Doneeo can add missing consumable materials to the work order.", type: "choice", options: ["All included", "Some may be missing", "I don’t know"], required: true },
    { id: "instructions", label: "Are assembly instructions or product models available?", type: "boolean", required: false },
    ...(/packaging|boxes|cleanup|remove/i.test(text) ? [{ id: "packaging_destination", label: "Where should the removed packaging go?", type: "choice" as const, options: ["Building recycling area", "Provider takes it away", "Leave stacked onsite"], required: true }] : []),
    { id: "site_access", label: "Are there loading, elevator or parking restrictions for the team?", help: "Enter “none” if access is unrestricted.", type: "text", required: true },
  ];
  if (category === "cleaning") return [
    { id: "service_address", label: "What is the cleaning address?", help: "Used to match a nearby cleaner and estimate travel.", type: "text", required: true },
    ...(!/(?:8|9|10|11|12)\s*(?:a\.?m\.?|in the morning)/i.test(text) ? [{ id: "arrival_window", label: "What Friday-morning arrival window works best?", type: "choice" as const, options: ["8–9 a.m.", "9–10 a.m.", "10–11 a.m.", "Flexible morning"], required: true }] : []),
    { id: "surface_notes", label: "Are there delicate surfaces, allergies or products that must be avoided?", help: "Enter “none” if there are no restrictions.", type: "text", required: true },
    { id: "home_access", label: "How will the cleaner access the house?", help: "Someone home, lockbox, concierge, or another arrangement.", type: "text", required: true },
    { id: "pets", label: "Will any pets be present during cleaning?", type: "boolean", required: false },
  ];
  return questionSets.general;
}

const streetTypePattern = /\b(?:av(?:e(?:nue)?)?|avenue|rue|street|st|road|rd|boulevard|blvd|chemin|ch|place|drive|dr|lane|ln|court|ct|route|rang|terrasse|way|crescent|cres)\b/i;
const countedObjectPattern = /^\d+(?:\.\d+)?\s*(?:boxes?|box|items?|desks?|chairs?|shelves?|rooms?|people|persons?|helpers?|workers?|executors?|flights?|steps?|doors?|appliances?|pieces?|kg|lb|lbs|pounds?|minutes?|mins?|hours?|hrs?|feet|ft|inches?|m²|sq\.?\s*(?:ft|m))\b/i;

/**
 * Extract only plausible civic addresses. The look-ahead intentionally finds
 * overlapping number-led candidates, so a quantity or time earlier in the
 * sentence cannot swallow a later real address (for example: “15 boxes … at
 * 12395 av Roland Paradis”).
 */
export function extractStreetAddresses(sourceText: string) {
  const candidatePattern = /(?=(?<![:\d])\b(\d{1,6}\s+[A-Za-zÀ-ÖØ-öø-ÿ0-9'’.-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ0-9'’.-]+){0,7}))/g;
  const matches = Array.from(sourceText.matchAll(candidatePattern));
  const addresses = matches.flatMap(match => {
    const raw = String(match[1] || "").trim();
    if (!raw || /^\d{1,2}\s+(?:a\.?m\.?|p\.?m\.?)(?:\s|$)/i.test(raw) || countedObjectPattern.test(raw)) return [];

    const trimmed = raw
      .split(/\s+\b(?:today|tomorrow|next|this|every|before|after|then|deliver|drop|install|instal|connect|assemble|move|carry|pick)\b/i)[0]
      .replace(/\s+and$/i, "")
      .replace(/[\s,;:.-]+$/g, "")
      .trim();
    if (!trimmed) return [];

    const index = match.index || 0;
    const prefix = sourceText.slice(Math.max(0, index - 48), index);
    const hasAddressContext = /(?:\b(?:at|address|located at|location|apartment|office|house|home)\s*)$/i.test(prefix);
    return streetTypePattern.test(trimmed) || hasAddressContext ? [trimmed] : [];
  });

  return addresses.filter((address, index, all) => all.findIndex(candidate => candidate.toLowerCase() === address.toLowerCase()) === index);
}

function providedStreetAddresses(sourceText: string) {
  return extractStreetAddresses(sourceText);
}

function compositeDishwasherRequest(sourceText: string) {
  const text = sourceText.toLowerCase();
  const dishwasher = /dish\s*washer/.test(text);
  // Accept common intake misspellings such as “unstall” as installation intent.
  // The other signals still have to identify a dishwasher and an external
  // pickup/delivery, so this cannot turn an unrelated sentence into an install.
  const installation = /\b(?:install|instal|unstall|connect|hook\s*up|fit)\b/.test(text);
  const transport = /\b(?:pick\s*up|collect|deliver|bring|transport|move)\b|\bfrom\b.{0,180}\bto\b|\b(?:costco|ikea|store|shop|retailer)\b.{0,180}\bto\b/.test(text);
  return dishwasher && installation && transport;
}

function compositeDishwasherRoute(sourceText: string, existing: RouteNode[]) {
  sourceText = normalizeIntakeForInference(sourceText);
  const nodes = existing.map(node => ({ ...node, actions: [...node.actions] }));
  const pickupMatch = sourceText.match(/\b(?:pick\s*up|collect)\s+(?:a\s+|the\s+)?dish\s*washer\s+(?:from|at)\s+(.+?)(?=\s+(?:and\s+)?(?:bring|deliver|transport)\s+(?:it|the\s+dish\s*washer)\s+to|,\s*(?:deliver|bring|transport)|\s+to\s+(?:my\s+)?(?:apartment|home|house))/i)
    || sourceText.match(/\bfrom\s+(.+?)(?=,\s*(?:deliver|bring|transport)|\s+to\s+(?:my\s+)?(?:apartment|home|house))/i)
    || sourceText.match(/^\s*(.+?)\s+to\s+(?:my\s+)?(?:apartment|home|house)\b/i);
  const destinationMatch = sourceText.match(/\b(?:deliver|bring|transport)(?:\s+(?:the\s+)?dish\s*washer|\s+it)?\s+to\s+(?:my\s+)?(?:apartment|home|house)?\s*(?:in|at)?\s*(.+?)(?=,?\s+(?:and\s+)?(?:then\s+)?(?:install|instal|unstall|connect|hook)|[.;]|$)/i)
    || sourceText.match(/\bto\s+(?:my\s+)?(?:apartment|home|house)\s*(?:in|at)?\s*(.+?)(?=,?\s+(?:and\s+)?(?:then\s+)?(?:install|instal|unstall|connect|hook)|[.;]|$)/i);
  const pickup = cleanRouteText(pickupMatch?.[1] || "");
  const destination = cleanRouteText(destinationMatch?.[1] || "");
  if (pickup && destination) {
    nodes.splice(0, nodes.length,
      { location: pickup, actions: ["Pick up dishwasher"] },
      { location: destination, actions: ["Deliver dishwasher"] },
    );
  }
  if (nodes.length) {
    const destination = nodes[nodes.length - 1];
    if (!destination.actions.some(action => /install|connect|hook/i.test(action))) destination.actions.push("Install and test dishwasher");
  }
  return nodes;
}

function enrichCompositeRequest(analysis: PlannerAnalysis): PlannerAnalysis {
  if (!compositeDishwasherRequest(analysis.sourceText)) return analysis;
  const alreadyStructuredByOntology = analysis.tasks.some(task => /^Pick up the dishwasher at\b/i.test(task));
  const source = analysis.sourceText.toLowerCase();
  const routeNodes = compositeDishwasherRoute(analysis.sourceText, analysis.routeNodes || []);
  const equipment: EquipmentRequirement[] = [
    ...equipmentFor("moving", analysis.sourceText),
    { id: "appliance_dolly", name: "Appliance dolly", purpose: "Move the dishwasher safely between the vehicle and apartment", required: true, rentalEstimate: 22 },
    { id: "installation_toolkit", name: "Dishwasher installation toolkit", purpose: "Level, secure and connect the appliance to existing approved services", required: true, rentalEstimate: 18 },
    { id: "connection_parts", name: "Model-compatible connection parts", purpose: "Supply line, drain connection, power component and fittings required by the model", required: true, rentalEstimate: 45, supplyType: "consumable" },
    { id: "leak_protection", name: "Leak protection and test supplies", purpose: "Protect the work area and verify the completed water connection", required: true, rentalEstimate: 8, supplyType: "consumable" },
  ].filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index);
  const irrelevantTemplateQuestion = (question: PlannerQuestion) =>
    ["service_address", "item", "mounting", "utilities", "materials", "instructions", "mounting_materials", "site_access"].includes(question.id)
    || question.id.startsWith("stop_")
    || /shelf|bracket|anchor|wall or ceiling|assembled or installed/i.test(`${question.id} ${question.label}`);
  const destination = routeNodes[routeNodes.length - 1]?.location || "the apartment";
  const questions: PlannerQuestion[] = [
    { id: "retailer_pickup_status", label: "Is the dishwasher paid for and ready for pickup at the retailer?", help: "This prevents assigning travel before the order can actually be released.", type: "choice", options: ["Paid and ready", "Ordered — not ready yet", "Not sure"], required: true },
    { id: "retailer_release_details", label: "What will the executor need to collect the dishwasher?", help: "Add the pickup name, order or confirmation reference, and any retailer pickup instructions.", type: "text", required: true },
    { id: "dishwasher_model", label: "What is the dishwasher model or its exact dimensions?", help: "A model number or product photo confirms fit, required parts and installation instructions.", type: "text", required: true },
    { id: "dishwasher_connection_scope", label: "Is this a replacement using existing accessible water, drain and electrical connections?", help: "New or modified plumbing/electrical work changes provider eligibility and may require a licensed professional.", type: "choice", options: ["Yes — existing connections", "New or modified connections", "Not sure"], required: true },
    { id: "dishwasher_parts", label: "Are all model-required installation parts included?", help: "Examples include the supply line, drain fittings, power component and mounting hardware.", type: "choice", options: ["Yes — all included", "No — parts needed", "Not sure"], required: true },
    { id: "old_dishwasher", label: "Is an old dishwasher currently installed?", help: "If yes, Doneeo adds safe disconnection, removal and disposal or relocation to the work order.", type: "boolean", required: true },
    { id: "building_permission", label: "Does the building allow this appliance installation at the requested time?", help: "Include elevator reservations, working-hour rules or required proof of insurance if applicable.", type: "choice", options: ["Yes — approved", "Permission required", "Not sure"], required: true },
    { id: "stop_1_vehicle_access", label: "RETAILER PICKUP · Is there a designated loading area?", help: `${routeNodes[0]?.location || "Retailer"} — include curbside, warehouse bay or parking restrictions.`, type: "choice", options: ["Yes — loading area", "Regular parking only", "Not sure"], required: true },
    { id: "stop_2_floor", label: "APARTMENT · Which floor is the unit on?", help: `${destination} — the apartment number does not necessarily identify the floor.`, type: "choice", options: ["Ground floor", "2nd floor", "3rd floor", "4th+ floor"], required: true },
    { id: "stop_2_elevator", label: "APARTMENT · Is there a usable elevator?", help: "This question disappears when the apartment is confirmed as ground floor.", type: "boolean", required: true },
    { id: "stop_2_vehicle_access", label: "APARTMENT · Can the vehicle stop close to the entrance?", help: "Consider loading zones, parking restrictions and carrying distance.", type: "choice", options: ["Yes — close access", "Limited access", "No — remote parking"], required: true },
    ...analysis.questions.filter(question => !irrelevantTemplateQuestion(question)),
  ];
  const tasks = [
    "Pick up dishwasher from the retailer",
    "Transport and deliver dishwasher to the apartment",
    "Install dishwasher using the verified connection scope",
    "Test operation and check for leaks",
  ];
  const skillRequirements = ["Safe appliance handling and load securement", "Dishwasher installation", "Water, drain and electrical connection assessment", "Leak and operation testing"]
    .filter((skill, index, all) => all.findIndex(candidate => candidate.toLowerCase() === skill.toLowerCase()) === index);
  const executionSteps = [
    "Verify retailer pickup readiness, dishwasher model and dimensions",
    "Confirm apartment access, connection scope, included parts and building permission",
    "Match the transport team and appropriately qualified installer; combine roles only when one provider is eligible for both",
    "Collect, protect and transport the dishwasher",
    "Deliver, position, install and test the dishwasher",
    "Record installation evidence and customer completion validation",
  ];
  const extractedAnswers = { ...analysis.extractedAnswers };
  if (/\b(?:already\s+)?paid\b[^.]{0,100}\bready\b|\bready\b[^.]{0,100}\bpaid\b/.test(source)) extractedAnswers.retailer_pickup_status = "Paid and ready";
  if (/\bexisting\b[^.]{0,100}\b(?:water|drain|electrical|power)\b[^.]{0,120}\b(?:connection|hookup|supply)/.test(source) || /\bexisting (?:accessible )?(?:water,?\s*drain and (?:electrical|power)|connections?)\b/.test(source)) extractedAnswers.dishwasher_connection_scope = "Yes — existing connections";
  if (/\b(?:new|modified|relocat(?:e|ed|ing))\b[^.]{0,100}\b(?:water|drain|electrical|connection|hookup)/.test(source)) extractedAnswers.dishwasher_connection_scope = "New or modified connections";
  if (/\b(?:no|without)\s+(?:old|existing)\s+dish\s*washer\b|\b(?:old|existing)\s+dish\s*washer\s+(?:is\s+)?not\s+installed\b/.test(source)) extractedAnswers.old_dishwasher = false;
  else if (/\b(?:old|existing)\s+dish\s*washer\s+(?:is\s+)?(?:installed|onsite|in place)\b/.test(source)) extractedAnswers.old_dishwasher = true;
  if (/\b(?:all|required|installation)\s+(?:parts|fittings|hardware)\s+(?:are\s+)?(?:included|available|ready)\b/.test(source)) extractedAnswers.dishwasher_parts = "Yes — all included";
  if (/\b(?:building|condo|landlord)\s+(?:permission|approval)\s+(?:is\s+)?(?:confirmed|approved|not required)\b/.test(source)) extractedAnswers.building_permission = "Yes — approved";
  return {
    ...analysis,
    title: alreadyStructuredByOntology ? analysis.title : "Dishwasher pickup, delivery and installation",
    summary: alreadyStructuredByOntology ? analysis.summary : "Doneeo identified one connected order with two distinct services: retailer pickup and delivery, followed by on-site dishwasher installation and testing.",
    tasks: alreadyStructuredByOntology ? analysis.tasks : tasks,
    routeNodes,
    extractedAnswers,
    stops: routeNodes.length ? routeNodes.map(node => node.location) : analysis.stops,
    items: analysis.items.some(item => /dish\s*washer/i.test(item)) ? analysis.items : [...analysis.items, "dishwasher"],
    equipment: alreadyStructuredByOntology ? analysis.equipment : equipment,
    questions: alreadyStructuredByOntology ? analysis.questions : questions.filter((question, index, all) => all.findIndex(candidate => candidate.id === question.id) === index),
    recommendedTeamSize: alreadyStructuredByOntology ? analysis.recommendedTeamSize : Math.max(2, analysis.recommendedTeamSize),
    skillRequirements: alreadyStructuredByOntology ? analysis.skillRequirements : skillRequirements,
    executionSteps: alreadyStructuredByOntology ? analysis.executionSteps : executionSteps,
    safetyNote: alreadyStructuredByOntology ? analysis.safetyNote : "Doneeo separates transport eligibility from installation eligibility. Any new or modified plumbing or electrical work is routed to an appropriately licensed professional.",
    estimate: alreadyStructuredByOntology ? analysis.estimate : { ...analysis.estimate, materialsSummary: equipment.map(item => item.name).join(", ") },
    understoodFacts: [...analysis.understoodFacts, "Dishwasher must be collected from the retailer", "Dishwasher must be delivered to the apartment", "Dishwasher installation is required at the destination"]
      .filter((fact, index, all) => all.findIndex(candidate => candidate.toLowerCase() === fact.toLowerCase()) === index),
  };
}

function requestProvidesAddressForQuestion(question: PlannerQuestion, sourceText: string, category: JobCategory) {
  const concept = `${question.id} ${question.label}`.toLowerCase();
  const isAccessQuestion = /(floor|elevator|stairs|loading|parking|access|entrance|door|gate)/.test(concept);
  const isAddressQuestion = !isAccessQuestion && /(address|where (?:is|will|should)|(?:work|service|installation|cleaning|pickup|delivery) location)/.test(concept);
  if (!isAddressQuestion) return false;

  const addresses = providedStreetAddresses(sourceText);
  if (!addresses.length) return false;

  const pickupProvided = /(?:pick\s*up|collect)[^.;\n]{0,220}\b\d{1,6}\s+[A-Za-zÀ-ÖØ-öø-ÿ]/i.test(sourceText);
  const deliveryProvided = /(?:deliver|drop|take|bring)[^.;\n]{0,220}\b\d{1,6}\s+[A-Za-zÀ-ÖØ-öø-ÿ]/i.test(sourceText);
  if (/(pickup|collection|origin)/.test(concept)) return pickupProvided;
  if (/(delivery|destination|drop|final)/.test(concept)) return deliveryProvided;

  // A service/office question is answered when the request already pairs the
  // work with a street address. Access questions remain separate and are kept.
  if (/(office|service|installation|cleaning|work|location|address)/.test(concept)) return true;
  return category !== "moving" && addresses.length > 0;
}

export function requestAlreadyAnswersQuestion(question: PlannerQuestion, analysis: PlannerAnalysis) {
  const sourceText = analysis.sourceText;
  const source = sourceText.toLowerCase();
  const concept = `${question.id} ${question.label}`.toLowerCase();
  const suppliedSchedule = extractScheduleWindow(sourceText);

  const stopQuestion = question.id.match(/^stop_(\d+)_(floor|elevator|vehicle_access)$/);
  if (stopQuestion) {
    const index = Math.max(0, Number(stopQuestion[1]) - 1);
    const routeStops = analysis.routeNodes.length ? analysis.routeNodes.map(node => node.location) : analysis.stops;
    const context = `${stopContext(sourceText, routeStops, index)} ${routeStops[index] || ""}`;
    if (stopQuestion[2] === "floor" && contextHasFloor(context)) return true;
    if (stopQuestion[2] === "elevator" && (/\belevator\b/i.test(context) || contextMakesElevatorIrrelevant(context))) return true;
    if (stopQuestion[2] === "vehicle_access" && /\b(?:loading zone|parking|vehicle|truck|van|driveway|curb|entrance|remote parking)\b/i.test(context)) return true;
  }

  if (requestProvidesAddressForQuestion(question, sourceText, analysis.category)) return true;
  if (/(order|item).*(paid|ready)|(paid|ready).*(order|item)/.test(concept) && /\border\b[^.]{0,60}\bpaid\b[^.]{0,60}\bready\b|\bpaid\b[^.]{0,60}\bready\b/i.test(sourceText)) return true;
  if (/(customer|you).*(help|carry|lift)|(help|carry|lift).*(customer|you)/.test(concept) && /(?:cannot|can't|can not|unable|won't)\s+(?:help|assist|carry|lift)/i.test(sourceText)) return true;
  const itemScopeQuestion = /(what.*(?:move|deliver|assemble|install)|items?|quantity|how many)/.test(concept)
    && !/(where|destination|room|area|receive|place|path|access)/.test(concept);
  if (!/(floor|elevator|stairs|access|weight|size|dimension|condition|content|fragile|special handling|anchor|mount|hardware|parts?|instructions?)/.test(concept) && itemScopeQuestion && analysis.items.length > 0 && /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b/i.test(sourceText)) return true;
  if (/(when|schedule|date|time|arrival|start)/.test(concept) && suppliedSchedule?.arrivalTime) return true;
  if (/(deadline|complete by|finish by)/.test(concept) && suppliedSchedule?.deadlineTime) return true;
  if (/(remove|dispose).*(packaging|boxes)|(packaging|boxes).*(remove|dispose)/.test(concept) && !/(where|destination|recycl|take away|leave)/.test(concept) && /remove\s+all\s+packaging|remove\s+(?:the\s+)?(?:packaging|boxes)/i.test(sourceText)) return true;
  if (question.id === "mounted_item" && /\b\d{2,3}[ -]?(?:inch|in\b|")|\b\d+\s*(?:kg|lb)/i.test(sourceText)) return true;
  if (question.id === "wall_type" && /\b(?:drywall|concrete|brick|plaster|tile)\b/i.test(sourceText)) return true;
  if ((question.id === "task_details" || question.id === "tasks" || /^(?:what )?(?:tasks?|work scope|support needed)\b/.test(question.label.toLowerCase())) && analysis.tasks.length > 0) return true;
  if (/(recurring|frequency|how often)/.test(concept) && analysis.recurrence.recurring && analysis.recurrence.frequency !== "Recurring schedule to confirm") return true;
  if (/(instruction|product model)/.test(concept) && /instructions? (?:are|is) (?:included|available)|product model\s+(?:is\s+)?(?:included|provided)/.test(source)) return true;
  return false;
}

export function fallbackAnalysis(request: string): PlannerAnalysis {
  const normalizedRequest = normalizeIntakeForInference(request);
  const text = normalizedRequest.toLowerCase();
  const category: JobCategory = /(father|mother|parent|elder|senior|grocer|companionship|wellness|lives alone)/.test(text)
    ? "elder_support"
    : /(clean|cleaning|vacuum|mop|bathroom|housekeeping)/.test(text)
      ? "cleaning"
    : /(assemble|install|mount|wardrobe|shelf|tv|fixture)/.test(text)
      ? "installation"
      : /(couch|sofa|\bmove\b|moving|pick\s*up|carry|furniture|appliance|boxes)/.test(text)
        ? "moving"
        : "general";

  const titles: Record<JobCategory, string> = {
    moving: "Move and delivery",
    installation: "Assembly and installation",
    cleaning: "Recurring home cleaning",
    elder_support: "Practical support visit",
    general: "Custom practical task",
  };

  const customerCanHelp = /(cannot|can't|can not|unable|won't)\s+(help|assist|carry|lift)/i.test(normalizedRequest) ? false : null;
  const items = Array.from(new Set((normalizedRequest.match(/\b(sofa|couch|table|chair|bed|dresser|wardrobe|cabinet|desk|furniture|appliance|box|boxes)\b/gi) || []).map(item => item.toLowerCase())));
  const rawTasks = normalizedRequest.split(/,\s*(?=(?:then\s+)?(?:pick|deliver|take|move|carry|install|remove|assemble|clean))|\b(?:then|after that|after this|next)\b|[.;]\s*/i).map(task => task.replace(/^(?:and\s+)?/i, "").trim()).filter(task => task.length > 5 && !/^(?:today|tomorrow|this\s+(?:morning|afternoon|evening)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?$/i.test(task));
  const routeNodes = category === "moving" ? deriveRouteNodes(normalizedRequest) : [];
  const tasks = category === "moving" && routeNodes.length ? routeNodes.flatMap(node => node.actions) : rawTasks;
  const genericStops = Array.from(normalizedRequest.matchAll(/(?:\bat\b|\bfrom\b|\bto\b|\bdeliver(?:ed)?\s+to\b|\bdrop(?:ped)?\s+(?:it\s+)?at\b)\s+([^,.;]+?)(?=\s+(?:and|then)\s+(?:pick|drop|deliver|take)|[,.;]|$)/gi)).map(match => match[1].trim());
  const movingStops = category === "moving" ? [
    normalizedRequest.match(/pick\s*up.+?\s(?:at|in|from)\s+([^,.;]+)/i)?.[1],
    normalizedRequest.match(/deliver(?:\s+it)?\s+to\s+([^,.;]+)/i)?.[1],
    normalizedRequest.match(/(?:then\s+)?take.+?\s+to\s+([^,.;]+)/i)?.[1],
  ].filter((value): value is string => Boolean(value)).map(value => value.trim()) : [];
  const stops = routeNodes.length ? routeNodes.map(node => node.location) : Array.from(new Set(movingStops.length >= 2 ? movingStops : genericStops));
  const scheduleWindow = extractScheduleWindow(normalizedRequest);
  const recurring = /(?:each|every|weekly|daily|monthly|recurring|twice\s+(?:a|per)\s+week|biweekly)/i.test(normalizedRequest);
  const frequency = normalizedRequest.match(/(?:each|every)\s+(?:day|week|month)|weekly|daily|monthly|twice\s+(?:a|per)\s+week|biweekly/i)?.[0] || (recurring ? "Recurring schedule to confirm" : "One-time");
  const largeInstallation = category === "installation" && /(?:twelve|12).{0,35}(?:desk|chair)|(?:six|6).{0,25}(?:shelf|shelves)|three rooms/i.test(normalizedRequest);
  const recommendedTeamSize = category === "moving" && (customerCanHelp === false || /heavy|large|couch|sofa|appliance|stairs/i.test(normalizedRequest)) ? 2 : /(?:four|4)\s+(?:people|helpers|workers)/i.test(normalizedRequest) ? 4 : /(?:three|3)\s+(?:people|helpers|workers)/i.test(normalizedRequest) || largeInstallation ? 3 : 1;
  const skillRequirements = category === "moving" ? ["Safe lifting and carrying", "Load securement", "Route and handoff coordination"] : category === "installation" ? ["Product assembly", "Accurate measurement", "Task-specific installation"] : category === "cleaning" ? ["Residential cleaning", "Kitchen and bathroom sanitation", "Surface-safe product use"] : category === "elder_support" ? ["Reliable practical support", "Clear family communication", "Relevant screening"] : ["Relevant task experience", "Reliable completion history", "Task-specific preparation"];
  const executionSteps = ["Confirm scope, access and timing", "Verify skills, team capacity and equipment", ...(recurring ? ["Confirm recurring schedule and continuity provider"] : []), "Execute the work in planned order", "Record checkpoints and customer confirmation"];
  const extractedAnswers: Record<string, string | boolean> = customerCanHelp === false ? { customer_help: false } : {};
  if (category === "installation" && /assemble|install|mount/i.test(normalizedRequest)) extractedAnswers.item = normalizedRequest;
  if (category === "installation" && /wall shel|install.{0,30}shel|mount/i.test(normalizedRequest)) extractedAnswers.mounting = true;
  if (category === "installation" && !/(electric|wiring|outlet|gas|plumb|pipe|water connection)/i.test(normalizedRequest)) extractedAnswers.utilities = false;
  if (/\b(?:has|with|there is|usable)\s+(?:an?\s+)?elevator\b/i.test(normalizedRequest)) extractedAnswers.elevator = true;
  if (/\b(?:no|without)\s+elevator\b/i.test(normalizedRequest)) extractedAnswers.elevator = false;
  if (scheduleWindow?.arrivalTime) extractedAnswers.schedule = scheduleWindow.arrivalLabel;
  if (scheduleWindow?.deadlineTime && scheduleWindow.deadlineLabel) extractedAnswers.deadline = scheduleWindow.deadlineLabel;
  if (/walks? independently|independent/i.test(request)) extractedAnswers.independent = true;
  if (/does not need|no\s+(?:medication|personal care)/i.test(request) && /medication/i.test(request)) extractedAnswers.medication = false;
  if (/does not need|no\s+(?:medication|personal care)/i.test(request) && /personal care/i.test(request)) extractedAnswers.personal_care = false;
  if (/twice\s+(?:a|per)\s+week/i.test(request)) extractedAnswers.frequency = "Twice weekly";
  const understoodFacts = category === "elder_support" ? [
    ...(request.match(/\b\d{2,3}-year-old\s+(?:father|mother|parent|senior)/i)?.[0] ? [request.match(/\b\d{2,3}-year-old\s+(?:father|mother|parent|senior)/i)![0]] : []),
    ...(/lives alone/i.test(request) ? ["Lives alone"] : []),
    ...(/twice\s+(?:a|per)\s+week/i.test(request) ? ["Two visits each week"] : recurring ? [frequency] : []),
    ...(/(?:buy|shop for).{0,25}grocer/i.test(request) ? ["Buy groceries"] : []),
    ...(/deliver.{0,25}grocer|grocer.{0,35}deliver/i.test(request) ? ["Deliver groceries"] : []),
    ...(/(?:spend\s+)?(?:one|1)\s+hour/i.test(request) ? ["One hour of companionship per visit"] : /companionship|spend time/i.test(request) ? ["Companionship visit"] : []),
    ...(/send (?:me )?(?:a|an)?\s*(?:visit )?update/i.test(request) ? ["Send an update after each visit"] : []),
    ...(/walks? independently|independent/i.test(request) ? ["Walks independently"] : []),
    ...(/(?:no|does not need|doesn't need)[^.]{0,35}(?:medication|medicine)/i.test(request) ? ["No medication assistance"] : []),
    ...(/(?:no|does not need|doesn't need)[^.]{0,35}personal care/i.test(request) ? ["No personal care"] : []),
  ] : [request];
  const serviceMinutesPerVisit = category === "elder_support" ? (/one hour/i.test(request) ? 120 : 90) : category === "moving" ? 90 : category === "cleaning" ? 180 : largeInstallation ? 420 : 75;
  const travelMinutes = category === "elder_support" ? 30 : category === "moving" ? 35 : 20;
  return enforceSafety({
    category,
    title: titles[category],
    summary: `Doneeo identified this as ${titles[category].toLowerCase()} and will map the people, access, equipment, timing, safety and price before matching anyone.`,
    safetyNote: category === "elder_support"
      ? "Doneeo separates practical companionship from regulated personal or clinical care."
      : "Licensing and safety requirements are checked before a provider can be assigned.",
    questions: contextualQuestions(category, request, recurring, stops),
    extractedAnswers,
    tasks: tasks.length ? tasks : [request],
    stops,
    routeNodes,
    scheduleWindow,
    items,
    customerCanHelp,
    equipment: equipmentFor(category, request),
    recurrence: { recurring, frequency },
    recommendedTeamSize,
    skillRequirements,
    executionSteps,
    understoodFacts,
    estimate: { serviceMinutesPerVisit, travelMinutes, people: recommendedTeamSize, recurringVisits: recurring ? frequency : "One-time", materialsSummary: category === "elder_support" ? "Provider transportation, grocery list/payment method, phone for visit update" : equipmentFor(category, request).map(item => item.name).join(", ") },
    sourceText: request,
    audit: { status: "deterministic", issues: [], checks: ["Facts extracted", "Repeated questions removed", "Tasks preserved", "Team size bounded", "Equipment plan present", "Safety rules applied"] },
  });
}

export function enforceSafety(analysis: PlannerAnalysis): PlannerAnalysis {
  analysis = enrichCompositeRequest(analysis);
  const answered = analysis.extractedAnswers || {};
  const source = analysis.sourceText.toLowerCase();
  const suppliedSchedule = extractScheduleWindow(analysis.sourceText);
  const questions = analysis.questions.filter(question => {
    const concept = `${question.id} ${question.label}`.toLowerCase();
    if (requestAlreadyAnswersQuestion(question, analysis)) return false;
    if (analysis.category === "moving" && question.id === "pickup_address" && /(?:pick\s*up|collect)[^.;\n]{0,220}\b\d{1,6}\s+[A-Za-zÀ-ÖØ-öø-ÿ]/i.test(analysis.sourceText)) return false;
    if (analysis.category === "moving" && question.id === "service_address" && /(?:deliver|drop|take)[^.;\n]{0,220}\b\d{1,6}\s+[A-Za-zÀ-ÖØ-öø-ÿ]/i.test(analysis.sourceText)) return false;
    if (analysis.category === "moving" && analysis.items.length > 0 && question.id === "item") return false;
    if (analysis.customerCanHelp !== null && question.id === "customer_help") return false;
    if (!question.id.startsWith("stop_") && /(elevator)/.test(concept) && /\b(?:has|with|there is|usable)\s+(?:an?\s+)?elevator\b|\b(?:no|without)\s+elevator\b/.test(source)) return false;
    if (/(straps)/.test(concept)) return false;
    if (/(when|schedule|date|time|arrival|start)/.test(concept) && suppliedSchedule?.arrivalTime) return false;
    if (/(deadline|complete by|finish by)/.test(concept) && suppliedSchedule?.deadlineTime) return false;
    if (analysis.tasks.length > 0 && (question.id === "task_details" || question.id === "tasks")) return false;
    if (["item", "mounting"].includes(question.id) && /assemble|install|mount/.test(source)) return false;
    if (question.id === "mounting" && /wall shel|install.{0,30}shel|mount/.test(source)) return false;
    if (/(when|schedule|date|time|deadline)/.test(concept) && /next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|before\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?/i.test(source)) return false;
    if (/(when|schedule|date|time|deadline)/.test(concept) && /every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening))?/i.test(source)) return false;
    if (analysis.category === "cleaning" && /(tools?|equipment|cleaning products?|what.*clean)/.test(concept)) return false;
    if (["utilities", "regulated"].includes(question.id) && !/(electric|wiring|outlet|gas|plumb|pipe|water connection)/.test(source)) return false;
    if (/(frequency|how often|visits? per week|one visit or recurring)/.test(concept) && analysis.recurrence.recurring && analysis.recurrence.frequency !== "Recurring schedule to confirm") return false;
    if (/(independent|walk|mobility)/.test(concept) && /walks? independently|independent/.test(source)) return false;
    if (/(medication|medicine)/.test(concept) && /(?:no|does not need|doesn't need)[^.]{0,35}(?:medication|medicine)/.test(source)) return false;
    if (/(personal care|bathing|dressing)/.test(concept) && /(?:no|does not need|doesn't need)[^.]{0,35}personal care/.test(source)) return false;
    if (/(lives alone|living arrangement)/.test(concept) && /lives alone/.test(source)) return false;
    if (/(visit length|duration|how long)/.test(concept) && /(?:spend\s+)?(?:one|1)\s+hour/.test(source)) return false;
    if (/(visit update|required update|send.*update)/.test(concept) && /send (?:me )?(?:a )?visit update|send (?:me )?(?:an )?update/.test(source) && !/(format|include|how)/.test(concept)) return false;
    const value = answered[question.id];
    return !(typeof value === "boolean" || (typeof value === "string" && value.trim().length > 1));
  });
  const normalizedSource = normalizeIntakeForInference(analysis.sourceText);
  const deterministicRoute = compositeDishwasherRequest(normalizedSource)
    ? compositeDishwasherRoute(normalizedSource, deriveRouteNodes(normalizedSource))
    : analysis.category === "moving" ? deriveRouteNodes(normalizedSource) : [];
  const routeNodes = deterministicRoute.length >= 2 ? deterministicRoute : (analysis.routeNodes || []);
  const stops = routeNodes.length ? routeNodes.map(node => node.location) : analysis.stops;
  const scheduleWindow = extractScheduleWindow(analysis.sourceText) || analysis.scheduleWindow || null;
  const requiredStopAccess = analysis.category === "moving" ? stopAccessQuestions(stops) : [];
  const mergedQuestions = [...requiredStopAccess, ...questions]
    .filter(question => !requestAlreadyAnswersQuestion(question, analysis))
    .filter(question => {
      const value = answered[question.id];
      if (typeof value === "boolean" || (typeof value === "string" && value.trim().length > 0)) return false;
      const elevator = question.id.match(/^(stop_\d+)_elevator$/);
      if (elevator && typeof answered[`${elevator[1]}_floor`] === "string" && /ground/i.test(String(answered[`${elevator[1]}_floor`]))) return false;
      return true;
    })
    .filter((question, index, all) => all.findIndex(candidate => candidate.id === question.id) === index);
  const addressFacts = providedStreetAddresses(analysis.sourceText).map(address => `Address supplied: ${address}`);
  const understoodFacts = [...analysis.understoodFacts, ...addressFacts]
    .filter((fact, index, all) => all.findIndex(candidate => candidate.toLowerCase() === fact.toLowerCase()) === index)
    .slice(0, 16);
  return { ...analysis, stops, routeNodes, scheduleWindow, understoodFacts, questions: mergedQuestions };
}
