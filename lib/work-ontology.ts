import { extractScheduleWindow, extractStreetAddresses, normalizeIntakeForInference, type EquipmentRequirement, type PlannerAnalysis, type PlannerQuestion, type TaskPrimitive } from "./planner";
import { catalogKnowledgeFacts, catalogResourceIds, questionsForRecognizedItems, recognizeHouseholdItems } from "./household-catalog";

export type WorkDomain =
  | "transport_handling"
  | "organization"
  | "appliance_installation"
  | "plumbing"
  | "electrical"
  | "painting"
  | "yard_garden"
  | "mounting"
  | "furniture_assembly"
  | "cleaning"
  | "elder_support"
  | "general_maintenance";

export type Qualification = "general_helper" | "skilled_executor" | "licensed_professional" | "regulated_care_provider" | "specialist_only";

type PhaseInput = {
  id: string;
  domain: WorkDomain;
  label: string;
  low: number;
  likely: number;
  high: number;
  minimumCrew?: number;
  recommendedCrew?: number;
  parallelizable?: boolean;
  qualification?: Qualification;
  dependencies?: string[];
  locationIndex?: number;
  workAction?: "pickup" | "delivery" | "installation";
  itemId?: string;
  occurrence?: number;
};

type DomainDefinition = {
  id: WorkDomain;
  label: string;
  qualification: Qualification;
  pattern: RegExp;
};

const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  { id: "elder_support", label: "Practical home support", qualification: "general_helper", pattern: /elder|senior|companionship|wellness visit|grocer|meal preparation|practical support visit/i },
  { id: "cleaning", label: "Home cleaning", qualification: "general_helper", pattern: /clean|vacuum|mop|sanitize|housekeeping/i },
  { id: "plumbing", label: "Plumbing", qualification: "licensed_professional", pattern: /plumb|pipe|faucet|tap\b|toilet|sink|drain|water line|water heater|leak/i },
  { id: "electrical", label: "Electrical and lighting", qualification: "licensed_professional", pattern: /electric|wiring|outlet|socket|switch|breaker|circuit|hardwire|ceiling light|light fixture|light bulb|\bbulb\b|plug.in lamp|\blamp\b/i },
  { id: "appliance_installation", label: "Appliance installation", qualification: "skilled_executor", pattern: /dish\s*washer|washing machine|washer\b|dryer\b|refrigerator|fridge|freezer|stove|range\b|wall oven|\boven\b|cooker|appliance/i },
  { id: "painting", label: "Interior or exterior painting", qualification: "skilled_executor", pattern: /\bpaint(?:ing|ed)?\b|repaint|primer|wall colour|ceiling colour/i },
  { id: "yard_garden", label: "Yard and garden work", qualification: "general_helper", pattern: /lawn|grass|mow|garden|plant(?:ing)?|hedge|yard|leaves|weeding|mulch/i },
  { id: "mounting", label: "Wall mounting", qualification: "skilled_executor", pattern: /mount|hang (?:a |the )?(?:tv|television|mirror|shelf|curtain)|wall shelf|tv bracket/i },
  { id: "furniture_assembly", label: "Furniture assembly", qualification: "skilled_executor", pattern: /assemble|assembly|wardrobe|flat.pack|desk|bed frame|bookcase|cabinet/i },
  { id: "organization", label: "Organization and decluttering", qualification: "general_helper", pattern: /organiz|organis|arrang|declutter|sort (?:the |my )?(?:garage|basement|storage)|garage cleanup/i },
  { id: "transport_handling", label: "Moving and physical handling", qualification: "general_helper", pattern: /pick\s*up|deliver|transport|\bmove\b|moving|carry|lift|unload|\bload\b|\b(?:take|bring|put)\b.{0,80}\b(?:box(?:es)?|furniture|items?|appliance|belongings)\b|\b\d+\s+box(?:es)?\b.{0,100}\b(?:basement|garage|attic|room|floor|house|home)\b/i },
  { id: "general_maintenance", label: "General home maintenance", qualification: "skilled_executor", pattern: /repair|replace|change (?:a |the )?(?:lamp|bulb|door|handle)|caulk|seal|maintenance|fix/i },
];

const RESOURCE_CATALOG: Record<string, EquipmentRequirement> = {
  vehicle: { id: "vehicle", name: "Cargo vehicle", purpose: "Transport items safely between route nodes", required: true, rentalEstimate: 85 },
  straps: { id: "straps", name: "Load straps", purpose: "Secure transported items", required: true, rentalEstimate: 12 },
  blankets: { id: "blankets", name: "Protective blankets", purpose: "Protect items and building surfaces", required: true, rentalEstimate: 15 },
  dolly: { id: "dolly", name: "Hand truck or stair dolly", purpose: "Reduce repeated carrying when the confirmed path safely permits it", required: true, rentalEstimate: 22 },
  ramp: { id: "ramp", name: "Appliance loading ramp", purpose: "Load or unload heavy wheeled equipment without unsafe lifting", required: true, rentalEstimate: 35 },
  bins_labels: { id: "bins_labels", name: "Sorting bins and labels", purpose: "Separate keep, donate, recycle and disposal groups", required: true, rentalEstimate: 25, supplyType: "consumable" },
  disposal_supplies: { id: "disposal_supplies", name: "Waste and donation supplies", purpose: "Bag, box and label approved outgoing items", required: true, rentalEstimate: 20, supplyType: "consumable" },
  plumbing_tools: { id: "plumbing_tools", name: "Plumbing diagnostic and hand tools", purpose: "Inspect and complete the verified plumbing scope", required: true, rentalEstimate: 35 },
  plumbing_parts: { id: "plumbing_parts", name: "Model-compatible plumbing parts", purpose: "Replace approved seals, valves, lines or fittings", required: true, rentalEstimate: 55, supplyType: "consumable" },
  leak_protection: { id: "leak_protection", name: "Leak protection and testing supplies", purpose: "Protect the work area and test completed connections", required: true, rentalEstimate: 10, supplyType: "consumable" },
  electrical_tools: { id: "electrical_tools", name: "Electrical testing and trade tools", purpose: "Verify isolation and complete eligible electrical work", required: true, rentalEstimate: 40 },
  electrical_parts: { id: "electrical_parts", name: "Approved electrical components", purpose: "Provide task-specific fixture, connector or device components", required: true, rentalEstimate: 45, supplyType: "consumable" },
  ladder: { id: "ladder", name: "Task-height ladder", purpose: "Reach elevated work safely", required: true, rentalEstimate: 25 },
  painting_tools: { id: "painting_tools", name: "Rollers, brushes, trays and extension poles", purpose: "Apply the specified coating", required: true, rentalEstimate: 35 },
  surface_protection: { id: "surface_protection", name: "Drop cloths and masking materials", purpose: "Protect floors, furniture and fixtures", required: true, rentalEstimate: 28, supplyType: "consumable" },
  prep_materials: { id: "prep_materials", name: "Surface preparation materials", purpose: "Patch, sand, clean and prime as required", required: true, rentalEstimate: 35, supplyType: "consumable" },
  paint: { id: "paint", name: "Paint or exterior coating", purpose: "Complete the requested finish and coat count", required: true, rentalEstimate: 90, supplyType: "consumable" },
  mower: { id: "mower", name: "Lawn mower", purpose: "Cut the confirmed grass area", required: true, rentalEstimate: 45 },
  trimmer: { id: "trimmer", name: "Edge trimmer", purpose: "Finish lawn edges and restricted areas", required: true, rentalEstimate: 28 },
  garden_tools: { id: "garden_tools", name: "Garden hand tools", purpose: "Prepare soil, weed, plant and finish the area", required: true, rentalEstimate: 25 },
  yard_consumables: { id: "yard_consumables", name: "Plants, soil, mulch or yard bags", purpose: "Supply the confirmed garden scope", required: true, rentalEstimate: 65, supplyType: "consumable" },
  drill: { id: "drill", name: "Drill and task-specific bits", purpose: "Complete assembly or mounting", required: true, rentalEstimate: 20 },
  stud_finder: { id: "stud_finder", name: "Stud and service detector", purpose: "Check the fixing area before drilling", required: true, rentalEstimate: 12 },
  level: { id: "level", name: "Level and measuring kit", purpose: "Measure, align and verify the finished work", required: true, rentalEstimate: 10 },
  mounting_hardware: { id: "mounting_hardware", name: "Surface-appropriate mounting hardware", purpose: "Secure the item to the verified wall construction", required: true, rentalEstimate: 25, supplyType: "consumable" },
  assembly_tools: { id: "assembly_tools", name: "Furniture assembly toolkit", purpose: "Assemble and adjust the confirmed models", required: true, rentalEstimate: 20 },
  anti_tip: { id: "anti_tip", name: "Anti-tip or anchoring hardware", purpose: "Secure furniture when the model or location requires it", required: true, rentalEstimate: 18, supplyType: "consumable" },
  appliance_install_tools: { id: "appliance_install_tools", name: "Appliance installation and testing kit", purpose: "Position, level, connect and commission the appliance within the verified eligible scope", required: true, rentalEstimate: 30 },
  appliance_connection_parts: { id: "appliance_connection_parts", name: "Model-compatible appliance connection parts", purpose: "Provide the approved power cord or gas connector and required fittings for the confirmed model", required: true, rentalEstimate: 65, supplyType: "consumable" },
  cleaning_equipment: { id: "cleaning_equipment", name: "Vacuum, mop and reusable cleaning tools", purpose: "Complete the confirmed rooms and surfaces", required: true, rentalEstimate: 35 },
  cleaning_products: { id: "cleaning_products", name: "Surface-compatible cleaning products", purpose: "Clean without damaging surfaces or triggering stated restrictions", required: true, rentalEstimate: 25, supplyType: "consumable" },
  ppe: { id: "ppe", name: "Task-appropriate protective equipment", purpose: "Protect the executor and work area", required: true, rentalEstimate: 15 },
};

function phase(input: PhaseInput): TaskPrimitive {
  const recommendedCrew = input.recommendedCrew || input.minimumCrew || 1;
  return {
    id: input.id,
    label: input.label,
    quantity: 1,
    unitMinutes: input.likely,
    personMinutes: input.likely * recommendedCrew,
    parallelizable: input.parallelizable === true,
    dependencies: input.dependencies || [],
    domain: input.domain,
    lowMinutes: input.low,
    highMinutes: input.high,
    minimumCrew: input.minimumCrew || 1,
    recommendedCrew,
    qualification: input.qualification || "general_helper",
    locationIndex: input.locationIndex,
    workAction: input.workAction,
    itemId: input.itemId,
    occurrence: input.occurrence,
  };
}

function numberFor(text: string, pattern: RegExp, fallback: number) {
  const match = text.match(pattern);
  if (!match) return fallback;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, "twenty-five": 25, "twenty five": 25 };
  return Number(match[1]) || words[match[1].toLowerCase()] || fallback;
}

function explicitRecurrence(text: string) {
  return /\b(?:each|every)\s+(?:day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:daily|weekly|biweekly|monthly|recurring|repeat(?:ing|ed)?|ongoing)\b|\b(?:once|twice|three times?)\s+(?:a|per)\s+(?:day|week|month)\b/i.test(text);
}

function streetAddressCount(text: string) {
  return extractStreetAddresses(text).length;
}

function isInternalPropertyMove(text: string) {
  if (streetAddressCount(text) >= 2) return false;
  if (/\b(?:another|different|friend(?:'s)?|sister(?:'s)?|brother(?:'s)?|seller(?:'s)?|customer(?:'s)?)\s+(?:house|home|apartment|property)\b/i.test(text)) return false;
  if (/\b(?:same|within)\s+(?:the |my |our )?(?:house|home|property|building|apartment)\b/i.test(text)) return true;

  // “Pick up” can mean lift/reposition. An interior origin plus an interior
  // destination is a one-property task, even when the customer uses that verb.
  const origin = /\bfrom\s+(?:(?:the|my|our)\s+)?(?:basement|garage|attic|bedroom|living room|kitchen|storage(?: room)?|room|main floor|ground floor|upper floor|upstairs|downstairs)\b/i.test(text);
  const destination = /\b(?:to|into)\b.{0,130}\b(?:(?:inside\s+)?(?:the|my|our)\s+(?:house|home)|basement|garage|attic|bedroom|living room|kitchen|storage(?: room)?|room|main floor|ground floor|upper floor|upstairs|downstairs)\b/i.test(text)
    || /\bput\b.{0,100}\binside\s+(?:(?:the|my|our)\s+)?(?:house|home)\b/i.test(text)
    || /\bfrom\b.{0,120}\b(?:upstairs|downstairs|inside)\b/i.test(text);
  const interiorHandling = /\b(?:move|carry|lift|pick\s*up|bring|take|reposition|put)\b/i.test(text)
    && /\b(?:basement|garage|attic|bedroom|living room|kitchen|storage room|main floor|ground floor|upstairs|downstairs)\b/i.test(text)
    && !/\b(?:deliver|drop\s*off|truck|cargo van|moving van|costco|ikea|walmart|home depot|rona|store|shop|retailer|warehouse|marketplace|seller)\b/i.test(text);
  return (origin && destination) || interiorHandling;
}

function isRouteTransport(analysis: PlannerAnalysis) {
  const text = analysis.sourceText;
  if (streetAddressCount(text) >= 2) return true;
  // An external retailer pickup takes precedence over a later internal move.
  // A mixed request can legitimately contain both an outside route and an
  // apartment-to-garage task; the latter must never erase the driving leg.
  if (/\b(?:pick\s*up|collect)\b.{0,180}\b(?:from|at)\s+(?:costco|coscto|ikea|store|shop|retailer|marketplace|seller)\b/i.test(text)
    || /\b(?:costco|coscto|ikea|store|shop|retailer|marketplace|seller)\b.{0,180}\b(?:deliver|bring|transport|drive)\b/i.test(text)) return true;
  if (isInternalPropertyMove(text)) return false;
  if (/\b(?:deliver|drop\s*off|transport|courier|drive)\b|load.{0,40}(?:truck|van|vehicle)|\b(?:truck|cargo van|moving van)\b/i.test(text)) return true;
  // “Pick up” alone is not proof of a driving job. Two verified route nodes,
  // a retailer/external pickup, or an actual address-to-destination chain is.
  if (/\b(?:pick\s*up|collect)\b.{0,140}\b(?:costco|ikea|store|shop|retailer|marketplace|seller)\b/i.test(text)) return true;
  return analysis.routeNodes.length > 1 && /\bfrom\b.{2,160}\bto\b|\btake\b.{2,120}\bto\b|\bbring\b.{2,120}\bto\b|\bdeliver\b/i.test(text);
}

function hasInternalBoxMove(text: string) {
  const normalized = normalizeIntakeForInference(text);
  return /\b(?:take|move|carry|bring|put)\b.{0,120}\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s+box(?:es)?\b.{0,180}\b(?:garage|basement|storage|bedroom|room|apartment|house|home)\b/i.test(normalized)
    || /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s+box(?:es)?\b.{0,180}\b(?:from|to|into)\b.{0,100}\b(?:garage|basement|storage|bedroom|room|apartment|house|home)\b/i.test(normalized);
}

function internalBoxLocations(text: string) {
  const normalized = normalizeIntakeForInference(text).toLowerCase();
  const boxIndex = normalized.search(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s+box(?:es)?\b/i);
  const boxClause = boxIndex >= 0 ? normalized.slice(boxIndex, boxIndex + 320) : normalized;
  const room = String.raw`apartment|house|home|basement|garage|storage(?: room)?|bedroom|living room|kitchen|main floor|ground floor|upstairs|downstairs`;
  const origin = boxClause.match(new RegExp(String.raw`\bfrom\s+(?:(?:the|my|our)\s+)?(${room})\b`, "i"))?.[1] || "confirmed origin";
  const basementGarage = /\bgarage\b.{0,35}\bbasement\b|\bbasement\s+garage\b/i.test(boxClause);
  const destination = basementGarage
    ? "basement garage"
    : boxClause.match(new RegExp(String.raw`\b(?:to|into)\s+(?:(?:the|my|our)\s+)?(${room})\b`, "i"))?.[1] || "confirmed destination";
  return { origin, destination };
}

function requestedMountLocation(text: string) {
  const normalized = normalizeIntakeForInference(text).toLowerCase();
  const match = normalized.match(/\b(?:wall\s*-?mount|mount|hang)\b.{0,70}\b(?:tv|television)\b.{0,70}\b(?:in|inside)\s+(?:(?:the|my|our)\s+)?(living room|bedroom|family room|den|office|kitchen|basement)\b/i);
  return match?.[1] || "confirmed room";
}

function hasExternalAppliancePickup(text: string) {
  return recognizeHouseholdItems(text).some(item => item.family === "major_appliance")
    && /\b(?:pick\s*up|collect)\b.{0,180}\b(?:from|at)\s+(?:costco|ikea|walmart|home depot|rona|store|shop|retailer|warehouse)\b/i.test(text);
}

function hasApplianceInstallationIntent(text: string) {
  return recognizeHouseholdItems(text).some(item => item.family === "major_appliance")
    && /\b(?:install|instal|unstall|connect|hook\s*up|fit|set\s*up|commission|replace)\b/i.test(text);
}

function requestedApplianceLocation(text: string) {
  return normalizeIntakeForInference(text).match(/\b(?:install|instal|connect|hook\s*up|fit|set\s*up)\b.{0,90}\b(?:in|inside)\s+(?:(?:the|my|our)\s+)?(kitchen|laundry room|utility room|basement|garage)\b/i)?.[1]?.toLowerCase() || "confirmed installation location";
}

function hasStreetAddress(text: string) {
  return extractStreetAddresses(text).length > 0;
}

function questionsForDomains(domains: WorkDomain[], text: string): PlannerQuestion[] {
  const questions: PlannerQuestion[] = [];
  const add = (question: PlannerQuestion, covered = false) => { if (!covered && !questions.some(item => item.id === question.id)) questions.push(question); };
  if (domains.includes("transport_handling") && isInternalPropertyMove(text)) {
    add({ id: "service_address", label: "Where will the lifting or on-site moving happen?", type: "text", required: true }, hasStreetAddress(text));
    add({ id: "handling_destination", label: "Exactly which room or area should receive the items?", help: "A destination such as the living room, garage or main floor is enough.", type: "text", required: true }, /\bto\s+(?:the |my |our )?(?:apartment|house|home|basement|living room|garage|bedroom|kitchen|storage room|main floor|ground floor|upstairs|downstairs|attic)\b/i.test(text));
    add({ id: "handling_access", label: "What is the carrying path between the two areas?", help: "Include flights of stairs, narrow turns or doors, and whether the path is clear.", type: "text", required: true }, /\b(?:no stairs?|\d+|one|two|three)\s+flights?\b|\b(?:stairs?|path|hallway)\s+(?:is|are)\s+(?:clear|wide)|\belevator\b/i.test(text));
    add({ id: "handling_size_weight", label: "What are the approximate size and weight of the heaviest item?", type: "text", required: true }, /\b\d+\s*(?:kg|lb)|lightweight|heavy|large/i.test(text));
    if (/\bbox(?:es)?\b/i.test(text)) add({ id: "handling_contents", label: "Do any boxes need special handling?", help: "This identifies protection and safety needs without asking for a full inventory.", type: "choice", options: ["Ordinary household items", "Some fragile or valuable items", "Some unusually heavy, liquid or sharp items", "Mixed or not sure"], required: true }, /ordinary household|fragile|valuable|books|clothes|liquid|sharp|hazard/i.test(text));
  }
  if (domains.includes("organization")) {
    add({ id: "organization_size", label: "How large and full is the area to organize?", help: "For example: one-car garage half full, or approximate number of boxes and large items.", type: "text", required: true }, /\b(?:one|two|three|\d)[ -]car garage|\b\d+\s+boxes|half full|fully packed/i.test(text));
    add({ id: "sorting_decisions", label: "Who will decide what is kept, donated, recycled or discarded?", type: "choice", options: ["I will decide during the job", "Rules supplied in advance", "Organize only — discard nothing"], required: true });
    add({ id: "disposal_scope", label: "Should outgoing items be removed from the property?", type: "choice", options: ["No removal", "Donation/recycling only", "Donation, recycling and disposal"], required: true }, /no removal|take.+donat|dispose|recycl/i.test(text));
    add({ id: "organization_heavy_items", label: "Are there heavy, hazardous or unusually large items in the area?", help: "This changes team size, handling equipment and eligibility.", type: "boolean", required: true }, /heavy|large appliance|hazard|chemical|paint cans?/i.test(text));
  }
  if (domains.includes("plumbing")) {
    add({ id: "plumbing_symptom", label: "What plumbing problem or outcome should be addressed?", help: "Describe where it occurs, whether water is actively leaking, and what has already been tried.", type: "text", required: true }, /leak|clog|blocked|replace|install|low pressure|no hot water/i.test(text));
    add({ id: "water_shutoff", label: "Is the relevant water shutoff accessible and working?", type: "choice", options: ["Yes", "No", "Not sure"], required: true });
    add({ id: "plumbing_modification", label: "Does this require a new or modified water, drain or gas connection?", type: "choice", options: ["Existing connection repair/replacement", "New or modified connection", "Not sure"], required: true });
    add({ id: "plumbing_parts_status", label: "Are the replacement fixture and model-compatible parts already available?", type: "choice", options: ["All available", "Parts must be purchased", "Not sure"], required: true });
  }
  if (domains.includes("electrical")) {
    add({ id: "electrical_scope", label: "Is this a simple bulb/lamp change or work on a hardwired electrical component?", type: "choice", options: ["Bulb or plug-in lamp only", "Hardwired fixture, switch or outlet", "Circuit, panel or new wiring", "Not sure"], required: true }, /\b(?:bulb|plug[- ]?in lamp|hardwired|light fixture|ceiling light|switch|outlet|socket|circuit|breaker|panel|new wiring)\b/i.test(text));
    add({ id: "electrical_symptom", label: "What currently happens when the light, fixture or circuit is used?", help: "Describe the outcome without opening or modifying electrical components.", type: "text", required: true }, /\b(?:install|replace|change|mount)\b/i.test(text) || /\b(?:burned?[- ]?out|flicker|trip|sparks?|not working|no power)\b/i.test(text));
    add({ id: "fixture_parts", label: "Is the replacement bulb, lamp or fixture already available and model-compatible?", type: "choice", options: ["Yes", "Needs purchase", "Not sure"], required: true }, /\b(?:replacement|new)\s+(?:bulb|lamp|fixture).{0,35}\b(?:onsite|on[- ]site|available|included|ready)\b|\b(?:bulb|lamp|fixture).{0,35}\b(?:not purchased|needs? purchase|must be purchased)\b/i.test(text));
    add({ id: "work_height", label: "What is the approximate working height?", type: "choice", options: ["Normal reach", "Standard step ladder", "High ceiling or stairwell", "Not sure"], required: true }, /\b(?:normal reach|standard (?:step )?ladder|high ceiling|stairwell|\d+(?:\.\d+)?\s*(?:ft|feet|m|metres?))\b/i.test(text));
  }
  if (domains.includes("painting")) {
    add({ id: "painting_scope", label: "Which surfaces and approximately how much area should be painted?", help: "Include rooms, walls, ceilings, trim, fence or exterior surfaces.", type: "text", required: true }, /\b\d+\s*(?:sq|square)|\b(?:one|two|three|\d+)\s+rooms?|walls?|ceiling|fence/i.test(text));
    add({ id: "surface_condition", label: "What is the current surface condition?", type: "choice", options: ["Good — clean and smooth", "Minor holes or peeling", "Significant repair or moisture issue", "Not sure"], required: true }, /\b(?:clean and smooth|good condition|minor holes?|peeling|cracks?|damaged|repair|moisture|mould|mold|stained)\b/i.test(text));
    add({ id: "paint_status", label: "Are the paint colour, finish and required quantity already selected and available?", type: "choice", options: ["Paint is ready", "Doneeo should calculate and purchase it", "Not sure"], required: true }, /\bpaint.{0,45}\b(?:ready|available|onsite|on[- ]site|already purchased|not purchased|needs? purchase|must be purchased)\b/i.test(text));
    add({ id: "paint_coats", label: "How many coats are expected?", type: "choice", options: ["One coat", "Two coats", "Primer plus two coats", "Not sure"], required: true }, /\b(?:one|two|three|1|2|3)\s+coats?\b|\bprimer\s+(?:and|plus|\+)\s+(?:one|two|three|1|2|3)\s+coats?\b/i.test(text));
  }
  if (domains.includes("yard_garden")) {
    add({ id: "yard_size", label: "What is the approximate lawn or garden size?", help: "Use dimensions, square metres/feet, or small/medium/large.", type: "text", required: true }, /\b\d+\s*(?:m²|sq|square)|\b(?:small|medium|large)\s+(?:front|back)?\s*(?:yard|backyard|lawn|garden)\b/i.test(text));
    add({ id: "yard_condition", label: "What is the current grass, soil or planting-area condition?", type: "text", required: true }, /\b(?:normal|short|long|overgrown|wet|dry|patchy|uneven|weedy|rocky)\s+(?:grass|lawn|soil|garden|yard)\b|\b(?:grass|lawn|soil|garden|yard)\s+(?:is|looks)\s+(?:normal|short|long|overgrown|wet|dry|patchy|uneven|weedy|rocky)\b/i.test(text));
    add({ id: "yard_equipment", label: "Which mower, trimmer or garden tools are already available and working?", type: "text", required: true }, /\b(?:mower|trimmer|garden tools?).{0,35}\b(?:available|onsite|on[- ]site|working|not available|needed)|\b(?:provider|doneeo).{0,25}\b(?:bring|supply).{0,25}\b(?:mower|tools?)\b/i.test(text));
    add({ id: "yard_disposal", label: "How should clippings, weeds or garden waste be handled?", type: "choice", options: ["Leave bagged onsite", "Use municipal collection", "Provider removes it"], required: true }, /\b(?:bag|leave|remove|haul|municipal|compost).{0,30}\b(?:clippings|weeds|garden waste)|\b(?:clippings|weeds|garden waste).{0,30}\b(?:bagged|onsite|removed|municipal|compost)\b/i.test(text));
  }
  if (domains.includes("mounting")) {
    add({ id: "mounted_item", label: "What are the item’s size, weight and model?", help: "For a TV, include screen size and bracket model if known.", type: "text", required: true }, /\b\d{2,3}[ -]?(?:inch|in\b|")|\b\d+\s*(?:kg|lb)/i.test(text));
    add({ id: "wall_type", label: "What is the wall material at the mounting location?", type: "choice", options: ["Drywall with studs", "Concrete or brick", "Plaster", "Tile", "Not sure"], required: true });
    add({ id: "mount_hardware_status", label: "Is the correct bracket and surface-compatible hardware available?", type: "choice", options: ["All available", "Bracket only", "Nothing purchased", "Not sure"], required: true });
    add({ id: "concealed_services", label: "Are there known pipes, wires or other services behind the fixing area?", type: "choice", options: ["No known services", "Known services nearby", "Not sure"], required: true });
  }
  if (domains.includes("furniture_assembly")) {
    add({ id: "furniture_models", label: "What furniture models and quantities must be assembled?", type: "text", required: true }, /\b(?:one|two|three|four|five|six|\d+)\s+(?:desk|chair|bed|wardrobe|cabinet|bookcase)/i.test(text));
    add({ id: "parts_complete", label: "Are all packages, parts and instructions onsite and undamaged?", type: "choice", options: ["Yes — checked", "Delivered but not checked", "Something is missing or damaged"], required: true });
    add({ id: "furniture_anchoring", label: "Does any item require wall anchoring or anti-tip hardware?", type: "choice", options: ["Yes", "No", "Not sure"], required: true });
    add({ id: "packaging_removal", label: "Should the executor remove the packaging after assembly?", type: "boolean", required: true }, /remove.+packaging|take.+boxes/i.test(text));
  }
  if (domains.includes("general_maintenance")) {
    add({ id: "maintenance_item", label: "What exact item, model and outcome are involved?", type: "text", required: true });
    add({ id: "maintenance_condition", label: "What is its current condition, and is there visible damage around it?", type: "text", required: true });
  }
  return [...questionsForRecognizedItems(text), ...questions]
    .filter((question, index, all) => all.findIndex(candidate => candidate.id === question.id) === index);
}

function phasesFor(analysis: PlannerAnalysis, domains: WorkDomain[]): TaskPrimitive[] {
  const confirmedAnswerText = Object.values(analysis.extractedAnswers || {}).filter(value => typeof value === "string").join(" ").toLowerCase();
  const text = `${analysis.sourceText.toLowerCase()} ${confirmedAnswerText}`.trim();
  const phases: TaskPrimitive[] = [];
  const lastStop = Math.max(0, analysis.routeNodes.length - 1);
  // The task item must come from the customer's original request. Access
  // answers such as "normal-width door" describe the route; they must not
  // turn the door itself into a second bulky item.
  const recognizedItems = recognizeHouseholdItems(analysis.sourceText);
  const refrigerator = recognizedItems.some(item => item.id === "refrigerator");
  const routeActionOccurrences = new Map<string, number>();
  const routeHandlingTargets = analysis.routeNodes.flatMap((node, locationIndex) => node.actions.flatMap(action => {
    const workAction = /^pick\s*up\b/i.test(action) ? "pickup" as const : /^(?:deliver|transport)\b/i.test(action) ? "delivery" as const : null;
    if (!workAction) return [];
    const item = recognizeHouseholdItems(action)[0];
    if (!item) return [];
    const occurrenceKey = `${workAction}:${item.id}`;
    const occurrence = (routeActionOccurrences.get(occurrenceKey) || 0) + 1;
    routeActionOccurrences.set(occurrenceKey, occurrence);
    return [{ workAction, item, occurrence, locationIndex }];
  }));
  const repeatedRouteHandling = routeHandlingTargets.filter(target => target.workAction === "pickup").length > 1;
  const add = (item: PhaseInput) => { if (!phases.some(existing => existing.id === item.id)) phases.push(phase(item)); };

  if (domains.includes("transport_handling")) {
    const boxes = numberFor(text, /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty[- ]five)\s+box(?:es)?\b/, 0);
    const boxLocations = internalBoxLocations(text);
    const bulky = /dish\s*washer|washer|dryer|refrigerator|fridge|freezer|couch|sofa|\blarge\b|\bheavy\b|wardrobe|appliance/.test(text)
      || recognizedItems.some(item => item.traits.some(trait => ["bulky", "heavy", "two_person"].includes(trait)));
    if (isRouteTransport(analysis)) {
      if (repeatedRouteHandling) {
        routeHandlingTargets.forEach(target => {
          const itemName = target.item.name.toLowerCase();
          const targetRefrigerator = target.item.id === "refrigerator";
          const targetBulky = target.item.traits.some(trait => ["bulky", "heavy", "two_person"].includes(trait));
          const suffix = `${target.item.id}_${target.occurrence}`;
          if (target.workAction === "pickup") {
            add({ id: `pickup_release_${suffix}`, domain: "transport_handling", label: `Confirm ${itemName} pickup and release readiness`, low: 10, likely: 20, high: 35, minimumCrew: 1, dependencies: ["pickup readiness", "release details"], locationIndex: target.locationIndex, workAction: "pickup", itemId: target.item.id, occurrence: target.occurrence });
            add({ id: `load_protect_secure_${suffix}`, domain: "transport_handling", label: targetRefrigerator ? "Protect and load refrigerator upright" : `Load, protect and secure ${itemName}`, low: targetBulky ? 20 : 12, likely: targetBulky ? 30 : 18, high: targetBulky ? 50 : 30, minimumCrew: targetBulky ? 2 : 1, recommendedCrew: targetBulky ? 2 : 1, dependencies: targetRefrigerator ? ["upright-capable cargo vehicle", "appliance dolly", "straps", "blankets", "manufacturer handling instructions"] : ["correct vehicle", "dolly", "straps", "blankets"], locationIndex: target.locationIndex, workAction: "pickup", itemId: target.item.id, occurrence: target.occurrence });
          } else {
            add({ id: `unload_place_${suffix}`, domain: "transport_handling", label: targetRefrigerator ? "Unload, carry and place refrigerator" : `Unload, carry and place ${itemName}`, low: targetBulky ? 20 : 12, likely: targetBulky ? 35 : 20, high: targetBulky ? 65 : 35, minimumCrew: targetBulky ? 2 : 1, recommendedCrew: targetBulky ? 2 : 1, dependencies: targetRefrigerator ? ["doorway and elevator fit", "floor", "parking distance", "final placement", "manufacturer settling time"] : ["floor", "elevator", "parking distance"], locationIndex: target.locationIndex, workAction: "delivery", itemId: target.item.id, occurrence: target.occurrence });
          }
        });
      } else {
        const routeItem = routeHandlingTargets[0]?.item;
        add({ id: "pickup_release", domain: "transport_handling", label: refrigerator ? "Confirm refrigerator order release, packaging and condition" : "Confirm pickup and release item", low: 10, likely: 20, high: 35, minimumCrew: 1, dependencies: refrigerator ? ["retailer release readiness", "order holder or authorized pickup contact", "condition evidence"] : ["pickup readiness", "release details"], locationIndex: 0, workAction: "pickup", itemId: routeItem?.id, occurrence: 1 });
        add({ id: "load_protect_secure", domain: "transport_handling", label: refrigerator ? "Protect and load refrigerator upright" : "Load, protect and secure item", low: bulky ? 20 : 12, likely: bulky ? 30 : 18, high: bulky ? 50 : 30, minimumCrew: bulky ? 2 : 1, recommendedCrew: bulky ? 2 : 1, dependencies: refrigerator ? ["upright-capable cargo vehicle", "appliance dolly", "straps", "blankets", "manufacturer handling instructions"] : ["correct vehicle", "dolly", "straps", "blankets"], locationIndex: 0, workAction: "pickup", itemId: routeItem?.id, occurrence: 1 });
        add({ id: "unload_place", domain: "transport_handling", label: refrigerator ? "Unload, carry and place refrigerator" : "Unload, carry and place item", low: bulky ? 20 : 12, likely: bulky ? 35 : 20, high: bulky ? 65 : 35, minimumCrew: bulky ? 2 : 1, recommendedCrew: bulky ? 2 : 1, dependencies: refrigerator ? ["doorway and elevator fit", "floor", "parking distance", "final placement", "manufacturer settling time"] : ["floor", "elevator", "parking distance"], locationIndex: lastStop, workAction: "delivery", itemId: routeItem?.id, occurrence: 1 });
      }
      // A mixed outside/inside order retains the later on-property move as its
      // own execution segment instead of folding the boxes into delivery.
      if (boxes && hasInternalBoxMove(analysis.sourceText)) {
        add({ id: "onsite_box_assess", domain: "transport_handling", label: `Inspect boxes and clear the ${boxLocations.origin}-to-${boxLocations.destination} path`, low: 10, likely: 15, high: 30, minimumCrew: 1, dependencies: ["origin", "destination access", "final placement"], locationIndex: lastStop });
        add({ id: "onsite_box_move", domain: "transport_handling", label: `Carry ${boxes} boxes from the ${boxLocations.origin} to the ${boxLocations.destination}`, low: Math.max(20, boxes * 2), likely: Math.max(35, boxes * 3), high: Math.max(60, boxes * 6), minimumCrew: 1, recommendedCrew: boxes >= 10 ? 2 : 1, parallelizable: true, dependencies: ["box weight", "elevator or stairs", "clear path"], locationIndex: lastStop });
        add({ id: "onsite_box_finish", domain: "transport_handling", label: `Verify ${boxLocations.destination} placement and leave the path clear`, low: 5, likely: 10, high: 20, dependencies: ["customer placement approval"], locationIndex: lastStop });
      }
    } else {
      const weightKg = Number(text.match(/\b(\d+(?:\.\d+)?)\s*kg\b/)?.[1] || 0);
      const weightLb = Number(text.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/)?.[1] || 0);
      const heavyIndividualItem = weightKg >= 23 || weightLb >= 50;
      const difficultInternalPath = /\b(?:two|three|[2-9])\s+flights?\b|narrow|tight turn|steep/.test(text);
      const easyInternalPath = /\bno stairs?\b|ground floor only|same floor|clear wide path/.test(text);
      const specialHandling = /fragile|valuable|unusually heavy|liquid|sharp|mixed or not sure/.test(text);
      const workloadFactor = (difficultInternalPath ? 1.3 : easyInternalPath ? 0.8 : 1) * (heavyIndividualItem ? 1.2 : 1) * (specialHandling ? 1.12 : 1);
      const boxCrew = boxes >= 10 || /basement|stairs?/.test(text) || heavyIndividualItem || specialHandling ? 2 : 1;
      const crewEfficiency = boxCrew === 1 ? 1 : 1.7;
      const onePersonLow = Math.ceil((boxes ? Math.max(20, boxes * 2) : bulky ? 25 : 15) * workloadFactor);
      const onePersonLikely = Math.ceil((boxes ? Math.max(35, boxes * 4) : bulky ? 45 : 30) * workloadFactor);
      const onePersonHigh = Math.ceil((boxes ? Math.max(60, boxes * 7) : bulky ? 90 : 60) * workloadFactor);
      add({ id: "onsite_handling_assess", domain: "transport_handling", label: "Inspect items and clear the carrying path", low: 10, likely: 20, high: 35, minimumCrew: 1, dependencies: ["origin", "placement", "stairs and doorway widths"] });
      add({ id: "onsite_handling_move", domain: "transport_handling", label: boxes ? `Lift and reposition ${boxes} boxes` : "Lift, carry and reposition the confirmed items", low: Math.max(15, Math.ceil(onePersonLow / crewEfficiency)), likely: Math.max(25, Math.ceil(onePersonLikely / crewEfficiency)), high: Math.max(40, Math.ceil(onePersonHigh / crewEfficiency)), minimumCrew: bulky || heavyIndividualItem ? 2 : 1, recommendedCrew: bulky ? 2 : boxCrew, parallelizable: boxes > 1, dependencies: ["confirmed weight", "safe path", "final placement"] });
      add({ id: "onsite_handling_finish", domain: "transport_handling", label: "Verify placement and leave the path clear", low: 5, likely: 10, high: 20, dependencies: ["customer placement approval"] });
    }
  }

  if (domains.includes("organization")) {
    add({ id: "organization_walkthrough", domain: "organization", label: "Review area and agree sorting rules", low: 15, likely: 25, high: 40, dependencies: ["customer decisions", "protected items"] });
    add({ id: "organization_sort", domain: "organization", label: "Sort, group and declutter contents", low: 90, likely: 180, high: 360, recommendedCrew: 2, parallelizable: true, dependencies: ["area volume", "keep/donate/discard rules"] });
    add({ id: "organization_store", domain: "organization", label: "Arrange, label and return kept items", low: 45, likely: 90, high: 180, recommendedCrew: 2, parallelizable: true, dependencies: ["bins", "shelving capacity"] });
    add({ id: "organization_outgoing", domain: "organization", label: "Stage approved donations, recycling and disposal", low: 20, likely: 45, high: 120, recommendedCrew: 2, parallelizable: true, dependencies: ["approved removal scope"] });
  }

  if (domains.includes("appliance_installation")) {
    const installationOccurrences = new Map<string, number>();
    const routeInstallationTargets = analysis.routeNodes.flatMap((node, locationIndex) => node.actions.flatMap(action => {
      if (!/^install\b/i.test(action)) return [];
      const item = recognizeHouseholdItems(action).find(candidate => candidate.family === "major_appliance");
      if (!item) return [];
      const occurrence = (installationOccurrences.get(item.id) || 0) + 1;
      installationOccurrences.set(item.id, occurrence);
      return [{ item, occurrence, locationIndex }];
    }));
    const fallbackInstallationTargets = recognizedItems
      .filter(item => item.family === "major_appliance")
      .map((item, index) => ({ item, occurrence: 1, locationIndex: lastStop + index }));
    const installationTargets = routeInstallationTargets.length ? routeInstallationTargets : fallbackInstallationTargets;
    const repeatedInstallations = installationTargets.length > 1;

    installationTargets.forEach(target => {
      const dishwasher = target.item.id === "dishwasher";
      const range = target.item.id === "range";
      const refrigeratorTarget = target.item.id === "refrigerator";
      const itemName = target.item.name.toLowerCase();
      const oldInstalled = dishwasher && analysis.extractedAnswers.old_dishwasher === true;
      const connectionScope = String(dishwasher
        ? analysis.extractedAnswers.dishwasher_connection_scope || analysis.extractedAnswers.plumbing_modification || ""
        : range ? analysis.extractedAnswers.range_connection_scope || "" : "");
      const rangeEnergy = String(analysis.extractedAnswers.range_energy_source || "");
      const modifiedConnections = /new|modified/i.test(connectionScope);
      const licensedConnection = modifiedConnections
        || (range && /gas|dual fuel/i.test(`${rangeEnergy} ${connectionScope}`))
        || ((range || dishwasher) && analysis.rulesGate?.providerClass === "licensed_professional");
      const partsMissing = /no|needed|purchase/i.test(String(dishwasher
        ? analysis.extractedAnswers.dishwasher_parts || analysis.extractedAnswers.plumbing_parts_status || ""
        : range ? analysis.extractedAnswers.range_parts || "" : ""));
      const suffix = repeatedInstallations ? `_${target.item.id}_${target.occurrence}` : "";
      const metadata = { workAction: "installation" as const, itemId: target.item.id, occurrence: target.occurrence };

      if (oldInstalled) add({ id: `disconnect_old_appliance${suffix}`, domain: "appliance_installation", label: "Disconnect and remove existing dishwasher", low: 30, likely: 50, high: 90, qualification: "skilled_executor", dependencies: ["safe isolation", "removal plan"], locationIndex: target.locationIndex, ...metadata });
      add({ id: `inspect_appliance_fit${suffix}`, domain: "appliance_installation", label: dishwasher ? "Inspect opening, model, services and required parts" : range ? "Verify stove model, clearances, energy supply and anti-tip requirements" : refrigeratorTarget ? "Verify refrigerator model, fit, power and requested water connection" : `Inspect ${itemName} location and required connections`, low: 15, likely: 25, high: 45, qualification: "skilled_executor", dependencies: ["model", "dimensions", "connection scope"], locationIndex: target.locationIndex, ...metadata });
      if (partsMissing) add({ id: `source_appliance_parts${suffix}`, domain: "appliance_installation", label: `Source and verify model-compatible ${itemName} installation parts`, low: 20, likely: 40, high: 90, qualification: "skilled_executor", dependencies: ["model", "approved purchase"], locationIndex: target.locationIndex, ...metadata });
      add({ id: `position_level_appliance${suffix}`, domain: "appliance_installation", label: `Position and level ${itemName}`, low: 15, likely: 25, high: 45, minimumCrew: 2, recommendedCrew: 2, qualification: "skilled_executor", dependencies: ["clear opening", "floor protection"], locationIndex: target.locationIndex, ...metadata });
      add({ id: `connect_appliance${suffix}`, domain: "appliance_installation", label: licensedConnection ? `Complete eligible ${itemName} connection work` : dishwasher ? "Connect water, drain and approved electrical supply" : range ? "Complete the approved stove power or gas connection" : refrigeratorTarget ? "Connect approved refrigerator power and requested existing water line" : `Complete approved ${itemName} connections`, low: modifiedConnections ? 90 : 50, likely: modifiedConnections ? 150 : 80, high: modifiedConnections ? 300 : 135, qualification: licensedConnection ? "licensed_professional" : "skilled_executor", dependencies: [licensedConnection ? "licensed scope approval" : "existing approved connections", "model-compatible parts"], locationIndex: target.locationIndex, ...metadata });
      add({ id: `secure_test_appliance${suffix}`, domain: "appliance_installation", label: range ? "Install anti-tip device, test burners, oven and controls, then clean the work area" : refrigeratorTarget ? "Secure, commission and verify refrigerator operation" : `Secure, commission, test and clean the ${itemName} work area`, low: 25, likely: 40, high: 65, qualification: "skilled_executor", dependencies: range ? ["manufacturer anti-tip device", "approved energy connection", "commissioning procedure"] : ["water and power available", "test procedure"], locationIndex: target.locationIndex, ...metadata });
    });
  }

  if (domains.includes("plumbing") && !domains.includes("appliance_installation")) {
    add({ id: "plumbing_diagnosis", domain: "plumbing", label: "Diagnose plumbing condition and protect area", low: 20, likely: 35, high: 60, qualification: "licensed_professional", dependencies: ["symptom", "access", "shutoff"] });
    add({ id: "plumbing_repair", domain: "plumbing", label: "Complete the approved plumbing repair or installation", low: 45, likely: 90, high: 180, qualification: "licensed_professional", dependencies: ["defined scope", "approved parts"] });
    add({ id: "plumbing_test", domain: "plumbing", label: "Restore service, test and check for leaks", low: 20, likely: 30, high: 50, qualification: "licensed_professional", dependencies: ["safe restoration"] });
  }

  if (domains.includes("electrical")) {
    const simpleBulb = /(?:change|replace).{0,20}(?:bulb|plug.in lamp)|lamp bulb/.test(text) && !/hardwire|fixture|switch|outlet|circuit|wiring/.test(text);
    add({ id: "electrical_assessment", domain: "electrical", label: simpleBulb ? "Confirm lamp, bulb type and safe access" : "Assess electrical scope and verify safe isolation", low: 10, likely: simpleBulb ? 15 : 30, high: simpleBulb ? 25 : 60, qualification: simpleBulb ? "general_helper" : "licensed_professional", dependencies: ["scope", "working height"] });
    add({ id: "electrical_work", domain: "electrical", label: simpleBulb ? "Replace bulb and verify operation" : "Complete approved electrical work", low: simpleBulb ? 10 : 45, likely: simpleBulb ? 15 : 90, high: simpleBulb ? 25 : 180, qualification: simpleBulb ? "general_helper" : "licensed_professional", dependencies: ["compatible component", "eligibility"] });
    if (!simpleBulb) add({ id: "electrical_test", domain: "electrical", label: "Test, document and restore the work area", low: 15, likely: 25, high: 45, qualification: "licensed_professional", dependencies: ["approved test procedure"] });
  }

  if (domains.includes("painting")) {
    const rooms = numberFor(text, /\b(\d+|one|two|three|four|five|six)\s+rooms?/, 1);
    const coats = analysis.extractedAnswers.paint_coats === "One coat" ? 1 : 2;
    add({ id: "paint_protect", domain: "painting", label: "Move/protect contents and mask work area", low: rooms * 25, likely: rooms * 40, high: rooms * 70, recommendedCrew: rooms > 2 ? 2 : 1, parallelizable: true, qualification: "skilled_executor", dependencies: ["room access", "protection materials"] });
    add({ id: "paint_prepare", domain: "painting", label: "Clean, patch, sand and prime surfaces as required", low: rooms * 30, likely: rooms * 60, high: rooms * 150, recommendedCrew: rooms > 2 ? 2 : 1, parallelizable: true, qualification: "skilled_executor", dependencies: ["surface condition", "drying needs"] });
    add({ id: "paint_apply", domain: "painting", label: `Apply ${coats} coat${coats > 1 ? "s" : ""} to confirmed surfaces`, low: rooms * coats * 45, likely: rooms * coats * 75, high: rooms * coats * 120, recommendedCrew: rooms > 1 ? 2 : 1, parallelizable: true, qualification: "skilled_executor", dependencies: ["paint quantity", "finish", "drying time"] });
    add({ id: "paint_finish", domain: "painting", label: "Detail, unmask and clean work area", low: rooms * 20, likely: rooms * 35, high: rooms * 60, recommendedCrew: rooms > 2 ? 2 : 1, parallelizable: true, qualification: "skilled_executor" });
  }

  if (domains.includes("yard_garden")) {
    const planting = /plant|garden bed|mulch/.test(text);
    add({ id: "yard_setup", domain: "yard_garden", label: "Inspect yard, confirm boundaries and prepare equipment", low: 10, likely: 20, high: 35, dependencies: ["size", "condition", "weather"] });
    add({ id: "yard_core", domain: "yard_garden", label: planting ? "Prepare soil and complete planting plan" : "Mow lawn and trim edges", low: 35, likely: 75, high: 180, recommendedCrew: /large|overgrown/.test(text) ? 2 : 1, parallelizable: true, dependencies: ["area", "equipment", "obstacles"] });
    add({ id: "yard_cleanup", domain: "yard_garden", label: "Collect or stage yard waste and complete final check", low: 15, likely: 30, high: 60, parallelizable: true, dependencies: ["waste plan"] });
  }

  if (domains.includes("mounting")) {
    const tv = /tv|television/.test(text);
    const largeTv = /(?:6[5-9]|[7-9]\d)[ -]?(?:inch|in\b|")/.test(text) || /large tv/.test(text);
    add({ id: "mount_assess", domain: "mounting", label: "Confirm item, bracket, wall and fixing area", low: 15, likely: 25, high: 45, qualification: "skilled_executor", dependencies: ["wall type", "concealed services", "hardware"] });
    add({ id: "mount_measure", domain: "mounting", label: "Measure, mark and prepare fixing points", low: 15, likely: 25, high: 45, qualification: "skilled_executor", dependencies: ["approved placement"] });
    add({ id: "mount_install", domain: "mounting", label: tv ? "Install bracket and mount television" : "Install hardware and mount item", low: 30, likely: 50, high: 90, minimumCrew: tv && largeTv ? 2 : 1, recommendedCrew: tv ? 2 : 1, qualification: "skilled_executor", dependencies: ["surface-compatible fixings"] });
    add({ id: "mount_finish", domain: "mounting", label: "Level, test and clean mounting area", low: 10, likely: 20, high: 35, qualification: "skilled_executor" });
  }

  if (domains.includes("furniture_assembly")) {
    const count = numberFor(text, /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:pieces? of )?(?:furniture|desks?|chairs?|beds?|wardrobes?|cabinets?|bookcases?)/, 1);
    const complex = /wardrobe|bed|cabinet|desk|large|wall unit/.test(text);
    add({ id: "assembly_inventory", domain: "furniture_assembly", label: "Inventory packages, parts and instructions", low: 10, likely: Math.max(15, count * 5), high: Math.max(30, count * 10), qualification: "skilled_executor", dependencies: ["model", "parts onsite"] });
    add({ id: "assembly_build", domain: "furniture_assembly", label: `Assemble ${count} confirmed furniture item${count > 1 ? "s" : ""}`, low: count * (complex ? 35 : 15), likely: count * (complex ? 60 : 30), high: count * (complex ? 105 : 60), recommendedCrew: complex || count > 4 ? 2 : 1, parallelizable: count > 1, qualification: "skilled_executor", dependencies: ["complete parts", "instructions"] });
    add({ id: "assembly_anchor", domain: "furniture_assembly", label: "Position, adjust and anchor items where required", low: 15, likely: 30, high: 60, minimumCrew: complex ? 2 : 1, recommendedCrew: complex ? 2 : 1, qualification: "skilled_executor", dependencies: ["wall type", "anti-tip requirements"] });
    add({ id: "assembly_cleanup", domain: "furniture_assembly", label: "Quality check and packaging cleanup", low: 15, likely: 25, high: 50, parallelizable: true, qualification: "skilled_executor", dependencies: ["approved packaging destination"] });
  }

  if (domains.includes("cleaning")) {
    const bedrooms = numberFor(text, /\b(\d+|one|two|three|four|five|six)\s+bedrooms?/, 1);
    const bathrooms = numberFor(text, /\b(\d+|one|two|three|four)\s+bathrooms?/, /bathroom/.test(text) ? 1 : 0);
    add({ id: "cleaning_setup", domain: "cleaning", label: "Prepare products, equipment and room sequence", low: 10, likely: 20, high: 30, dependencies: ["surface restrictions", "product availability"] });
    if (bedrooms) add({ id: "clean_bedrooms", domain: "cleaning", label: `Clean ${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}`, low: bedrooms * 20, likely: bedrooms * 30, high: bedrooms * 50, recommendedCrew: bedrooms > 3 ? 2 : 1, parallelizable: true });
    if (bathrooms) add({ id: "clean_bathrooms", domain: "cleaning", label: `Clean and sanitize ${bathrooms} bathroom${bathrooms > 1 ? "s" : ""}`, low: bathrooms * 25, likely: bathrooms * 40, high: bathrooms * 65, recommendedCrew: bathrooms > 1 ? 2 : 1, parallelizable: true });
    if (/kitchen/.test(text)) add({ id: "clean_kitchen", domain: "cleaning", label: "Clean kitchen surfaces and floors", low: 30, likely: 50, high: 90, parallelizable: true });
    add({ id: "cleaning_finish", domain: "cleaning", label: "Final walkthrough and visit update", low: 10, likely: 15, high: 25 });
  }

  if (domains.includes("elder_support")) {
    if (/grocer|shop|buy/.test(text)) add({ id: "support_groceries", domain: "elder_support", label: "Purchase or collect groceries", low: 30, likely: 50, high: 80, dependencies: ["list", "payment method"] });
    if (/deliver/.test(text)) add({ id: "support_delivery", domain: "elder_support", label: "Deliver and place groceries", low: 10, likely: 20, high: 35, dependencies: ["home access"] });
    if (/companionship|visit|spend/.test(text)) add({ id: "support_visit", domain: "elder_support", label: "Complete companionship or practical support visit", low: /one hour|1 hour/.test(text) ? 60 : 40, likely: /one hour|1 hour/.test(text) ? 60 : 60, high: /one hour|1 hour/.test(text) ? 75 : 90, qualification: "general_helper" });
    if (/update|report/.test(text)) add({ id: "support_update", domain: "elder_support", label: "Prepare authorized visit update", low: 5, likely: 10, high: 15, dependencies: ["update format", "consent"] });
  }

  if (!phases.length) add({ id: "general_assess", domain: "general_maintenance", label: "Assess and complete confirmed household task", low: 30, likely: 60, high: 150, qualification: "skilled_executor", dependencies: ["exact scope", "condition", "materials"] });
  return phases;
}

function resourceIds(domains: WorkDomain[], analysis: PlannerAnalysis) {
  const ids = new Set<string>(["ppe"]);
  if (domains.includes("transport_handling")) (isRouteTransport(analysis) ? ["vehicle", "straps", "blankets", "dolly"] : ["dolly"]).forEach(id => ids.add(id));
  if (domains.includes("transport_handling") && /fragile|valuable|special handling/i.test(String(analysis.extractedAnswers.handling_contents || ""))) ids.add("blankets");
  if (domains.includes("organization")) ["bins_labels", "disposal_supplies", "dolly"].forEach(id => ids.add(id));
  if (domains.includes("appliance_installation")) {
    const range = recognizeHouseholdItems(analysis.sourceText).some(item => item.id === "range");
    (range ? ["dolly", "appliance_install_tools", "appliance_connection_parts", "anti_tip", "level"] : ["dolly", "plumbing_tools", "plumbing_parts", "leak_protection", "level"]).forEach(id => ids.add(id));
  }
  if (domains.includes("plumbing")) ["plumbing_tools", "plumbing_parts", "leak_protection"].forEach(id => ids.add(id));
  if (domains.includes("electrical")) ["electrical_tools", "electrical_parts", "ladder"].forEach(id => ids.add(id));
  if (domains.includes("painting")) ["painting_tools", "surface_protection", "prep_materials", "paint", "ladder"].forEach(id => ids.add(id));
  if (domains.includes("yard_garden")) ["mower", "trimmer", "garden_tools", "yard_consumables"].forEach(id => ids.add(id));
  if (domains.includes("mounting")) ["drill", "stud_finder", "level", "mounting_hardware", "ladder"].forEach(id => ids.add(id));
  if (domains.includes("furniture_assembly")) ["assembly_tools", "level", "anti_tip"].forEach(id => ids.add(id));
  if (domains.includes("cleaning")) ["cleaning_equipment", "cleaning_products"].forEach(id => ids.add(id));
  const routeTransport = domains.includes("transport_handling") && isRouteTransport(analysis);
  catalogResourceIds(analysis.sourceText)
    .filter(id => routeTransport || !["vehicle", "straps", "ramp"].includes(id))
    .forEach(id => ids.add(id));
  return Array.from(ids);
}

export function buildHouseholdWorkModel(analysis: PlannerAnalysis) {
  analysis = { ...analysis, sourceText: normalizeIntakeForInference(analysis.sourceText) };
  const rawDetected = DOMAIN_DEFINITIONS
    .map((definition, catalogOrder) => ({ definition, catalogOrder, sourceOrder: analysis.sourceText.search(definition.pattern) }))
    .filter(item => item.sourceOrder >= 0)
    .sort((left, right) => left.sourceOrder - right.sourceOrder || left.catalogOrder - right.catalogOrder)
    .map(item => item.definition);
  const elderSupportDetected = rawDetected.some(definition => definition.id === "elder_support");
  const supportErrandLanguage = elderSupportDetected
    && /\b(?:grocer(?:y|ies)?|pharmacy|errand|meal)\b/i.test(analysis.sourceText)
    && !/\b(?:move|moving|carry|lift|unload|\bload\b).{0,50}(?:furniture|appliance|box(?:es)?|heavy|bulky)\b/i.test(analysis.sourceText);
  const contextFiltered = supportErrandLanguage
    ? rawDetected.filter(definition => definition.id !== "transport_handling")
    : rawDetected;
  const applianceDetected = contextFiltered.some(definition => definition.id === "appliance_installation");
  const applianceServiceIntent = /\b(?:install|instal|unstall|connect|hook\s*up|set\s*up|commission|repair|replace|disconnect)\b/i.test(analysis.sourceText);
  const transportOnlyAppliance = applianceDetected && isRouteTransport(analysis) && !applianceServiceIntent;
  const standalonePlumbing = /faucet|\btap\b|toilet|sink|\bpipe\b|clog|blocked drain|water heater|plumbing repair/i.test(analysis.sourceText);
  const standaloneElectrical = /outlet|socket|switch|breaker|circuit|panel|new wiring|light fixture|ceiling light|\blamp\b|\bbulb\b/i.test(analysis.sourceText);
  const applianceScoped = transportOnlyAppliance ? contextFiltered.filter(definition => definition.id !== "appliance_installation") : contextFiltered;
  const scopeDetected = applianceDetected ? applianceScoped.filter(definition => definition.id !== "plumbing" || standalonePlumbing).filter(definition => definition.id !== "electrical" || standaloneElectrical) : applianceScoped;
  const detected = scopeDetected.some(definition => definition.id !== "general_maintenance")
    ? scopeDetected.filter(definition => definition.id !== "general_maintenance")
    : scopeDetected;
  const domains = detected.length ? detected.map(item => item.id) : ["general_maintenance" as const];
  const primitives = phasesFor(analysis, domains);
  const equipment = resourceIds(domains, analysis).map(id => RESOURCE_CATALOG[id]).filter(Boolean);
  const questions = questionsForDomains(domains, analysis.sourceText);
  const minimumCrew = Math.max(1, ...primitives.map(item => item.minimumCrew || 1));
  const recommendedCrew = Math.max(minimumCrew, ...primitives.map(item => item.recommendedCrew || 1));
  const qualifications = Array.from(new Set(primitives.map(item => item.qualification || "general_helper")));
  const qualificationRank: Record<Qualification, number> = { general_helper: 1, skilled_executor: 2, licensed_professional: 3, regulated_care_provider: 4, specialist_only: 5 };
  const phaseDomains = Array.from(new Set(primitives.map(item => item.domain || "general_maintenance")));
  const domainDetails = phaseDomains.map(id => {
    const definition = DOMAIN_DEFINITIONS.find(item => item.id === id);
    const domainPhases = primitives.filter(item => (item.domain || "general_maintenance") === id);
    const qualification = domainPhases.map(item => item.qualification || "general_helper").sort((left, right) => qualificationRank[right] - qualificationRank[left])[0] || definition?.qualification || "skilled_executor";
    return { id, label: definition?.label || "Custom household work", qualification, phaseCount: domainPhases.length };
  });
  return {
    domains,
    domainDetails,
    primitives,
    equipment,
    questions,
    minimumCrew,
    recommendedCrew,
    qualifications,
  };
}

export function augmentWithHouseholdKnowledge(analysis: PlannerAnalysis): PlannerAnalysis {
  const source = normalizeIntakeForInference(analysis.sourceText).toLowerCase();
  const inferenceAnalysis = { ...analysis, sourceText: source };
  const derivedAnswers = { ...analysis.extractedAnswers };
  const suppliedSchedule = extractScheduleWindow(source);
  if (suppliedSchedule?.arrivalTime) derivedAnswers.schedule = suppliedSchedule.arrivalLabel;
  if (suppliedSchedule?.deadlineTime && suppliedSchedule.deadlineLabel) derivedAnswers.deadline = suppliedSchedule.deadlineLabel;
  if (/\bpaint.{0,45}\b(?:not purchased|needs? purchase|must be purchased)\b/i.test(source)) derivedAnswers.paint_status = "Doneeo should calculate and purchase it";
  else if (/\bpaint.{0,45}\b(?:ready|available|onsite|on[- ]site|already purchased)\b/i.test(source)) derivedAnswers.paint_status = "Paint is ready";
  if (/\b(?:one|1)\s+coat\b/i.test(source)) derivedAnswers.paint_coats = "One coat";
  else if (/\b(?:two|2)\s+coats\b/i.test(source)) derivedAnswers.paint_coats = "Two coats";
  else if (/\bprimer\s+(?:and|plus|\+)\s+(?:two|2)\s+coats\b/i.test(source)) derivedAnswers.paint_coats = "Primer plus two coats";
  if (/\bbag(?:ged|ging)?\b.{0,25}\bclippings\b|\bclippings\b.{0,25}\bbag(?:ged|ging)?\b/i.test(source)) derivedAnswers.yard_disposal = "Leave bagged onsite";
  analysis = { ...analysis, extractedAnswers: derivedAnswers };
  const model = buildHouseholdWorkModel(analysis);
  const recognizedItems = recognizeHouseholdItems(source);
  const transportDetected = model.domains.includes("transport_handling");
  const routeTransport = transportDetected && isRouteTransport(inferenceAnalysis);
  const recurring = explicitRecurrence(source);
  const compatibleBaseEquipment = analysis.equipment.filter(item => {
    if (!routeTransport && ["vehicle", "straps", "blankets"].includes(item.id)) return false;
    if (model.domains.includes("mounting") && item.id !== "mounting_hardware" && /anchor|fastener|mounting hardware/i.test(`${item.id} ${item.name}`)) return false;
    return true;
  });
  const equipment = [...model.equipment, ...compatibleBaseEquipment]
    .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)
    .map(item => {
      if (recognizedItems.some(candidate => candidate.id === "refrigerator")) {
        if (item.id === "vehicle") return { ...item, name: "Upright-capable cargo van or box truck", purpose: "Transport the refrigerator upright and secured between route nodes" };
        if (item.id === "dolly") return { ...item, name: "Appliance dolly with securing strap", purpose: "Move the refrigerator without unsafe lifting or uncontrolled tilting" };
        if (item.id === "straps") return { ...item, name: "Appliance-rated load straps", purpose: "Secure the refrigerator upright without damaging doors or refrigerant lines" };
      }
      if (recognizedItems.some(candidate => candidate.id === "range")) {
        if (item.id === "vehicle") return { ...item, name: "Appliance-capable cargo van or box truck", purpose: "Transport the stove upright, protected and secured between route nodes" };
        if (item.id === "dolly") return { ...item, name: "Appliance dolly with securing strap", purpose: "Move the stove safely through the verified access path" };
        if (item.id === "anti_tip") return { ...item, name: "Manufacturer-compatible stove anti-tip device", purpose: "Secure the stove against tipping before commissioning" };
      }
      return item;
    });
  const compatibleBaseQuestions = analysis.questions.filter(question => {
    const concept = `${question.id} ${question.label}`.toLowerCase();
    const hasSpecificDomain = model.domains.some(domain => domain !== "general_maintenance");
    if (question.required === false) return false;
    if (!model.domains.includes("furniture_assembly") && (["furniture_models", "parts_complete", "furniture_anchoring", "packaging_removal"].includes(question.id)
      || /furniture|assemble|assembly instructions|wall anchoring|packaging after assembly/.test(concept))) return false;
    if (hasSpecificDomain && ["task_details", "tools", "regulated", "item", "materials", "utilities", "mounting"].includes(question.id)) return false;
    if (hasSpecificDomain && question.id === "instructions" && !model.domains.some(domain => ["furniture_assembly", "appliance_installation"].includes(domain))) return false;
    if (question.id === "packaging_destination" && !model.domains.includes("furniture_assembly") && !/remove|dispose|discard|packaging|cleanup/i.test(analysis.sourceText)) return false;
    if (hasSpecificDomain && question.id === "site_access" && !model.domains.some(domain => ["furniture_assembly", "appliance_installation", "transport_handling"].includes(domain))) return false;
    if (transportDetected && !routeTransport && (["pickup_address", "service_address", "delivery_address", "item", "pickup_contact_help", "customer_help", "floor", "elevator", "vehicle", "straps"].includes(question.id)
      || /^stop_\d+_(?:floor|elevator|vehicle_access)$/.test(question.id)
      || /pickup|final delivery|delivery address|loading area|vehicle|elevator/.test(concept))) return false;
    if (routeTransport && recognizedItems.some(item => item.traits.includes("two_person")) && ["handling_destination", "handling_access", "handling_size_weight", "pickup_contact_help", "customer_help"].includes(question.id)) return false;
    if (!recurring && /frequency|how often|recurr|repeat|same provider each|preferred provider/.test(concept)) return false;
    if (!/shel/i.test(analysis.sourceText) && question.id === "fasteners") return false;
    return true;
  });
  const questions = [...model.questions, ...compatibleBaseQuestions]
    .filter(question => {
      const concept = `${question.id} ${question.label}`.toLowerCase();
      if (suppliedSchedule?.arrivalTime && /when|schedule|date|time|arrival|start/.test(concept)) return false;
      if (suppliedSchedule?.deadlineTime && /deadline|finish|complete by/.test(concept)) return false;
      return true;
    })
    .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)
    .map(question => question.id === "service_address" && /office installation/i.test(question.label) ? { ...question, label: "Where will this work be performed?", help: "Required for nearby provider matching and travel estimation." } : question);
  const steps = model.primitives.map(item => item.label);
  const category = analysis.category === "moving" && !routeTransport ? "general" : analysis.category;
  const domainTitle = model.domainDetails.length === 1 ? model.domainDetails[0].label : model.domainDetails.map(domain => domain.label).join(" + ");
  const onsiteBoxCount = numberFor(source, /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty[- ]five)\s+box(?:es)?\b/, 0);
  const primaryItemName = recognizedItems.find(item => item.id !== "boxes")?.name.toLowerCase();
  const recognizedAppliances = recognizedItems.filter(item => item.family === "major_appliance");
  const routeApplianceName = recognizedAppliances.length === 1 ? recognizedAppliances[0].name.toLowerCase() : undefined;
  const oneRecognizedRouteItem = recognizedItems.filter(item => item.id !== "boxes").length === 1 ? primaryItemName : undefined;
  const routeNodes = routeTransport ? analysis.routeNodes.map((node, index, nodes) => oneRecognizedRouteItem
    ? { ...node, actions: index === 0 ? [`Pick up ${oneRecognizedRouteItem}`] : index === nodes.length - 1 ? [`Deliver ${oneRecognizedRouteItem}`] : node.actions }
    : node) : [];
  const stops = routeTransport ? routeNodes.map(node => node.location) : [];
  const taskForDomain = (domain: string) => {
    if (domain === "transport_handling") return onsiteBoxCount && !routeTransport
      ? `Carry and place ${onsiteBoxCount} boxes within the property`
      : primaryItemName ? `Pick up, transport and place the ${primaryItemName}` : "Pick up, transport and place the confirmed items";
    if (domain === "mounting") return /\btv\b|television/i.test(source)
      ? "Wall-mount the television, level it and verify the finished installation"
      : "Mount and verify the requested wall item";
    if (domain === "furniture_assembly") return "Assemble and verify the requested furniture";
    if (domain === "appliance_installation") return primaryItemName ? `Install, connect and test the ${primaryItemName}` : "Install, connect and test the appliance";
    if (domain === "plumbing") return "Complete and test the requested plumbing work";
    if (domain === "electrical") return "Complete and verify the requested electrical or lighting work";
    if (domain === "painting") return "Prepare, paint and inspect the requested surfaces";
    if (domain === "yard_garden") return "Complete and inspect the requested yard or garden work";
    if (domain === "organization") return "Organize the requested area and confirm final placement";
    if (domain === "cleaning") return "Clean and inspect the requested areas";
    if (domain === "elder_support") return "Complete the requested practical home-support visit";
    return analysis.tasks[0] || "Complete the requested household work";
  };
  const detectedTasks = model.domains.map(taskForDomain)
    .filter((task, index, all) => all.findIndex(candidate => candidate.toLowerCase() === task.toLowerCase()) === index);
  const boxLocations = internalBoxLocations(source);
  const mountLocation = requestedMountLocation(source);
  const externalAppliance = hasExternalAppliancePickup(source) && Boolean(routeApplianceName) && routeNodes.length >= 2;
  const coordinatedCompositeTasks = externalAppliance ? [
    `Pick up the ${routeApplianceName} at ${routeNodes[0].location}`,
    `Transport and deliver the ${routeApplianceName} to ${routeNodes.at(-1)!.location}`,
    ...(hasApplianceInstallationIntent(source) ? [`Install, connect and test the ${routeApplianceName} in the ${requestedApplianceLocation(source)}`] : []),
    ...(model.domains.includes("mounting") ? [`Wall-mount the television in the ${mountLocation}, level it and verify the finished installation`] : []),
    ...(onsiteBoxCount && hasInternalBoxMove(source) ? [`Carry ${onsiteBoxCount} boxes from the ${boxLocations.origin} to the ${boxLocations.destination}`] : []),
  ] : [];
  const recognizedRouteTasks = routeTransport && oneRecognizedRouteItem && routeNodes.length >= 2 ? [
    `Pick up the ${oneRecognizedRouteItem} at ${routeNodes[0].location}`,
    `Transport and deliver the ${oneRecognizedRouteItem} to ${routeNodes.at(-1)!.location}`,
  ] : [];
  const routeTasks = routeTransport && routeNodes.length
    ? routeNodes.flatMap(node => node.actions)
    : [];
  const canonicalRouteTasks = routeTransport && routeNodes.length ? routeNodes.flatMap(node => node.actions.map(action => {
    const item = recognizeHouseholdItems(action)[0];
    if (!item) return action;
    const old = /\b(?:old|used|existing)\b/i.test(action) ? "old " : "";
    const itemName = `${old}${item.name.toLowerCase()}`;
    if (/^pick\s*up\b/i.test(action)) return `Pick up the ${itemName} at ${node.location}`;
    if (/^(?:deliver|transport)\b/i.test(action)) return `Transport and deliver the ${itemName} to ${node.location}`;
    if (/^install\b/i.test(action)) return `Install, connect and test the ${itemName} at ${node.location}`;
    return action;
  })) : [];
  const routePickupCount = routeNodes.reduce((count, node) => count + node.actions.filter(action => /^pick\s*up\b/i.test(action)).length, 0);
  const multiWorkflowRoute = routePickupCount > 1 || new Set(routeNodes.flatMap(node => node.actions.flatMap(action => recognizeHouseholdItems(action).map(item => item.id)))).size > 1;
  const representedRouteDomains = new Set<string>([
    ...(canonicalRouteTasks.some(task => /pick\s*up|transport|deliver/i.test(task)) ? ["transport_handling"] : []),
    ...(canonicalRouteTasks.some(task => /install|connect|commission/i.test(task)) ? ["appliance_installation"] : []),
  ]);
  const supplementalMultiTasks = model.domains
    .filter(domain => !representedRouteDomains.has(domain))
    .map(taskForDomain)
    .filter(task => !(onsiteBoxCount && /pick up, transport and place/i.test(task)));
  if (onsiteBoxCount && hasInternalBoxMove(source)) supplementalMultiTasks.push(`Carry ${onsiteBoxCount} boxes from the ${boxLocations.origin} to the ${boxLocations.destination}`);
  const genericMultiTasks = multiWorkflowRoute ? [...canonicalRouteTasks, ...supplementalMultiTasks] : [];
  const tasks = genericMultiTasks.length ? genericMultiTasks : coordinatedCompositeTasks.length ? coordinatedCompositeTasks : recognizedRouteTasks.length ? recognizedRouteTasks : routeTasks.length ? routeTasks : detectedTasks.length ? detectedTasks : analysis.tasks;
  const compatibleBaseSkills = analysis.skillRequirements.filter(skill => {
    if (transportDetected && !routeTransport && /route|handoff|driver|vehicle|load securement|product assembly/i.test(skill)) return false;
    if (!model.domains.includes("furniture_assembly") && /furniture|product assembly/i.test(skill)) return false;
    return true;
  });
  const explicitCrew = numberFor(source, /\b([1-4]|one|two|three|four)\s+(?:people|helpers|workers|executors)\b/, 0);
  const catalogCrew = Math.max(1, ...recognizedItems.map(item => item.defaultCrew));
  const recommendedTeamSize = Math.max(model.minimumCrew, catalogCrew, explicitCrew || model.recommendedCrew);
  return {
    ...analysis,
    category,
    title: model.domainDetails.length ? domainTitle : analysis.title,
    summary: tasks.length > 1
      ? `Doneeo identified ${tasks.length} ordered tasks in one customer work order. It may coordinate different executors internally, but the customer receives one plan, one price and one managed completion flow.`
      : transportDetected && !routeTransport ? "Doneeo identified one on-site handling job within a single property. It will calculate the carrying work and access conditions without inventing a driving route." : analysis.summary,
    questions,
    items: [...analysis.items, ...recognizedItems.map(item => item.name.toLowerCase())]
      .filter((item, index, all) => all.findIndex(candidate => candidate.toLowerCase() === item.toLowerCase()) === index),
    equipment,
    tasks,
    stops,
    routeNodes,
    skillRequirements: [...compatibleBaseSkills, ...model.domainDetails.map(domain => `${domain.label} · ${domain.qualification.replaceAll("_", " ")}`)]
      .filter((item, index, all) => all.findIndex(candidate => candidate.toLowerCase() === item.toLowerCase()) === index),
    executionSteps: steps,
    understoodFacts: [...analysis.understoodFacts, ...catalogKnowledgeFacts(source)]
      .filter((fact, index, all) => all.findIndex(candidate => candidate.toLowerCase() === fact.toLowerCase()) === index)
      .slice(0, 24),
    recurrence: recurring ? analysis.recurrence : { recurring: false, frequency: "One-time" },
    recommendedTeamSize,
    estimate: { ...analysis.estimate, travelMinutes: routeTransport ? analysis.estimate.travelMinutes : 0, people: recommendedTeamSize, recurringVisits: recurring ? analysis.recurrence.frequency : "One-time", materialsSummary: equipment.map(item => item.name).join(", ") },
  };
}
