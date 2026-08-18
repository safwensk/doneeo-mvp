// Extracted from app/page.tsx — behavior unchanged.
import type { JobCategory, PlannerAnalysis } from "../../lib/planner";
import { formExecutorTeam } from "./executor-pool";
import type { Answers, PlanKey, PlanOption, ServiceAssignment } from "./plan-types";

export function assignmentCoversTask(assignment: ServiceAssignment, taskSequence: number) {
  const numbers = assignment.tasks.match(/\d+/g)?.map(Number) || [];
  if (numbers.length >= 2 && /[–-]/.test(assignment.tasks)) return taskSequence >= numbers[0] && taskSequence <= numbers[1];
  return numbers.includes(taskSequence);
}

export function serviceForTask(assignments: ServiceAssignment[], taskSequence: number) {
  return assignments.find(assignment => assignmentCoversTask(assignment, taskSequence)) || assignments[0];
}

export function recalculateJob(analysis: PlannerAnalysis, answers: Answers) {
  const hasDrivingRoute = analysis.routeNodes.length > 1;
  const stops = Math.max(analysis.stops.length, analysis.category === "moving" ? 2 : 1);
  let accessMinutes = 0;
  let difficultStops = 0;
  const accessByStop = Array.from({ length: stops }, (_, index) => {
    const number = index + 1;
    const floor = String(answers[`stop_${number}_floor`] || "Not confirmed");
    const elevator = answers[`stop_${number}_elevator`];
    const vehicle = String(answers[`stop_${number}_vehicle_access`] || "Not confirmed");
    const floorDelay = elevator === false ? (floor.includes("4th") ? 25 : floor.includes("3rd") ? 18 : floor.includes("2nd") ? 10 : 4) : elevator === true ? 4 : 0;
    const vehicleDelay = vehicle.includes("remote") ? 15 : vehicle.includes("Limited") ? 8 : vehicle.includes("close") ? 2 : 0;
    const stopDelay = floorDelay + vehicleDelay;
    if (elevator === false && !floor.includes("Ground")) difficultStops += 1;
    if (vehicle.includes("remote") || vehicle.includes("Limited")) difficultStops += 1;
    accessMinutes += stopDelay;
    return { floor, elevator: elevator === true ? "Elevator" : elevator === false ? "Stairs / no elevator" : "Elevator not confirmed", vehicle, minutes: stopDelay };
  });
  const noHelp = analysis.customerCanHelp === false || answers.customer_help === false;
  const heavyMove = /couch|sofa|table|furniture|appliance|dishwasher|large|heavy/i.test(`${analysis.sourceText} ${analysis.items.join(" ")}`) && (analysis.category === "moving" || analysis.intelligence?.domains?.some(domain => domain.id === "transport_handling"));
  const intelligenceMinimum = analysis.intelligence?.manpower.minimum || 1;
  const intelligenceRecommended = analysis.intelligence?.manpower.recommended || analysis.recommendedTeamSize;
  const teamSize = heavyMove || noHelp && analysis.category === "moving" || difficultStops > 0 ? Math.max(2, intelligenceMinimum, intelligenceRecommended) : Math.max(intelligenceMinimum, intelligenceRecommended);
  const routeMinutes = hasDrivingRoute ? (analysis.estimate.travelMinutes || analysis.intelligence?.estimate.routeMinutes || (stops - 1) * 25) : 0;
  const handlingMinutes = analysis.intelligence?.estimate.executionMinutes || analysis.estimate.serviceMinutesPerVisit;
  const changes = [
    ...(accessMinutes ? [`Access conditions add ${accessMinutes} min across ${stops} stops`] : []),
    ...(noHelp && analysis.category === "moving" ? ["Customer assistance removed from the execution plan"] : []),
    ...(teamSize > analysis.recommendedTeamSize ? [`Team increased to ${teamSize} for safe handling`] : []),
    ...(Object.keys(answers).some(key => key.startsWith("equipment_") && answers[key] === false) ? ["Missing equipment is routed to provider inventory, rental or purchase"] : []),
  ];
  return { stops, accessMinutes, accessByStop, teamSize, routeMinutes, handlingMinutes, changes };
}

export function optionsFor(analysis: PlannerAnalysis, answers: Answers): PlanOption[] {
  const recalculated = recalculateJob(analysis, answers);
  const adjustedAnalysis = { ...analysis, recommendedTeamSize: recalculated.teamSize, estimate: { ...analysis.estimate, serviceMinutesPerVisit: recalculated.handlingMinutes, people: recalculated.teamSize, travelMinutes: recalculated.routeMinutes } };
  const category = analysis.category;
  const regulated = analysis.rulesGate?.providerClass === "licensed_professional" || analysis.rulesGate?.providerClass === "regulated_care_provider" || Boolean(answers.personal_care || answers.medication || answers.cognitive || answers.utilities || answers.regulated);
  const stopCount = recalculated.stops;
  const taskCount = Math.max(analysis.tasks.length, 1);
  const noCustomerHelp = answers.customer_help === false || analysis.customerCanHelp === false;
  const complexity = Math.max(0, stopCount - 2) * 30 + Math.max(0, taskCount - 1) * 25 + (noCustomerHelp && category === "moving" ? 35 : 0) + Math.max(0, recalculated.teamSize - 1) * 45 + Math.ceil(recalculated.accessMinutes * 0.8);
  const minutes = 45 + stopCount * 25 + taskCount * 20;
  const duration = `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}–${Math.floor((minutes + 45) / 60)}h${String((minutes + 45) % 60).padStart(2, "0")}`;
  const base: Record<JobCategory, [number, number, number]> = {
    moving: [65, 80, 110],
    installation: [60, 95, 145],
    cleaning: [75, 110, 155],
    elder_support: [40, 70, 120],
    general: [55, 85, 130],
  };
  const [rawBudget, rawRecommended, rawComplete] = base[category];
  const [budget, recommended, complete] = [rawBudget + complexity, rawRecommended + complexity, rawComplete + complexity];
  const providerProfiles: Record<PlanKey, { name: string; rating: string; equipment: string[] }> = category === "moving" ? {
    budget: { name: "Alex · Local mover", rating: "4.7 ★ · 86 jobs", equipment: ["straps", "blankets"] },
    recommended: { name: "Marc & Julie · Moving team", rating: "4.9 ★ · 214 jobs", equipment: ["vehicle", "straps", "blankets", "dolly"] },
    complete: { name: "Nord Move · Managed team", rating: "5.0 ★ · 132 jobs", equipment: ["vehicle", "straps", "blankets", "dolly"] },
  } : category === "installation" ? {
    budget: { name: "David · Assembly helper", rating: "4.7 ★ · 73 jobs", equipment: ["drill", "level"] },
    recommended: { name: "Émile · Experienced installer", rating: "4.9 ★ · 168 jobs", equipment: ["drill", "level", "stud_finder"] },
    complete: { name: "Atelier Pro · Installation team", rating: "4.9 ★ · 241 jobs", equipment: ["drill", "level", "stud_finder", "anchors"] },
  } : category === "cleaning" ? {
    budget: { name: "Nadia · Independent cleaner", rating: "4.9 ★ · 184 jobs", equipment: ["vacuum", "mop", "microfiber"] },
    recommended: { name: "Nadia + Sofia · Cleaning pair", rating: "4.9 ★ · 312 combined jobs", equipment: ["vacuum", "mop", "microfiber", "gloves_bags"] },
    complete: { name: "Montréal HomeCare · Cleaning team", rating: "4.8 ★ · insured provider", equipment: ["vacuum", "mop", "microfiber", "bathroom_cleaner", "kitchen_degreaser", "floor_cleaner", "gloves_bags"] },
  } : {
    budget: { name: "Verified local helper", rating: "4.7 ★ · identity verified", equipment: ["toolkit"] },
    recommended: { name: "Best-fit experienced provider", rating: "4.9 ★ · skills verified", equipment: ["toolkit", "ppe", "transport"] },
    complete: { name: "Doneeo managed provider", rating: "Top match · backup ready", equipment: ["toolkit", "ppe", "transport"] },
  };
  const enrich = (basePlans: Array<Omit<PlanOption, "provider" | "providerRating" | "rentalTotal" | "equipmentRows" | "teamFormation" | "formationType" | "strategy" | "credential" | "rentalLogistics" | "rentalMinutes" | "fulfillmentLabel" | "serviceAssignments">>): PlanOption[] => basePlans.map(plan => {
    const profile = providerProfiles[plan.key];
    const formed = formExecutorTeam(adjustedAnalysis, plan.key);
    const equipmentRows = analysis.equipment.map(item => {
      const customerHas = answers[`equipment_${item.id}`] === true || (item.id === "mounting_hardware" && answers.mount_hardware_status === "All available");
      const providerHas = profile.equipment.includes(item.id) || formed.members.some(member => member.assets.includes(item.id));
      const source = customerHas ? "Customer" as const : providerHas ? "Provider" as const : item.supplyType === "consumable" ? "Purchase" as const : "Rental" as const;
      return { name: item.name, source, cost: customerHas || providerHas ? 0 : item.rentalEstimate, availability: source === "Rental" ? "Available · Montréal equipment partner (simulated)" : source === "Purchase" ? "Available · supply purchase added to invoice (simulated)" : source === "Provider" ? "Verified in provider inventory" : "Confirmed by customer" };
    });
    const rentalCost = equipmentRows.filter(item => item.source === "Rental").reduce((total, item) => total + item.cost, 0);
    const purchaseCost = equipmentRows.filter(item => item.source === "Purchase").reduce((total, item) => total + item.cost, 0);
    const rentalTotal = rentalCost + purchaseCost;
    const hasRental = equipmentRows.some(item => item.source === "Rental");
    const hasPurchase = equipmentRows.some(item => item.source === "Purchase");
    const rentalMinutes = hasRental ? plan.key === "budget" ? 70 : plan.key === "recommended" ? 40 : 10 : hasPurchase ? 15 : 0;
    const rentalLogistics = hasRental ? plan.key === "budget" ? "Executor picks up before the job and returns after completion" : plan.key === "recommended" ? "Doneeo reserves one pickup stop; team lead returns equipment" : "Partner delivery and collection coordinated by Doneeo" : hasPurchase ? "Missing consumable products are purchased before arrival and added to the invoice" : "No rental or supply-purchase trip required";
    const rentalLogisticsCost = hasRental && plan.key === "complete" ? 25 : 0;
    const provider = formed.formationType === "Doneeo assembled team" ? formed.members.map(member => member.name).join(" + ") : formed.formationType === "Solo executor" ? formed.members[0].name : `${formed.members[0].name} · verified ${formed.members.length}-person team`;
    const providerRating = formed.formationType === "Doneeo assembled team" ? `${formed.members.length} compatible solo executors · individually rated` : formed.formationType === "Solo executor" ? formed.members[0].rating : profile.rating;
    const memberCount = formed.members.length;
    const calibratedAlternative = analysis.intelligence?.manpower.alternatives.find(option => option.people === memberCount);
    const workMinutes = Math.ceil((calibratedAlternative?.estimatedMinutes || recalculated.handlingMinutes) / 5) * 5;
    const totalMinutes = workMinutes + recalculated.routeMinutes + (analysis.intelligence?.estimate.bufferMinutes || 0) + 5;
    const duration = `${Math.floor(totalMinutes / 60) ? `${Math.floor(totalMinutes / 60)}h` : ""}${String(totalMinutes % 60).padStart(2, "0")}`;
    const coordinated = analysis.intelligence?.fulfillment.mode === "coordinated_specialists";
    const usesSpecialistHandoff = coordinated && plan.key === "budget";
    const strategy = usesSpecialistHandoff ? "Two specialist services · Doneeo-managed handoff · lowest total cost" : coordinated && plan.key === "recommended" ? `${formed.members.length} cross-qualified executors · same team from pickup to final approval` : plan.key === "budget" ? `${formed.members.length} executor${formed.members.length > 1 ? "s" : ""} · lowest cost · longer completion` : plan.key === "recommended" ? `${formed.members.length} coordinated executors · parallel work · faster finish` : `${formed.members.length}-person specialized company · managed execution`;
    const credential = analysis.rulesGate?.providerClass === "licensed_professional" ? "Applicable professional licence, insurance and task eligibility required" : plan.key === "budget" ? "Identity, task history and ratings verified" : plan.key === "recommended" ? "Domain expertise and equipment verified" : "Commercial provider · insurance and applicable licences checked before booking";
    const laborRate = plan.key === "budget" ? 38 : plan.key === "recommended" ? 48 : 62;
    const laborCost = Math.max(plan.price, Math.ceil(((analysis.intelligence?.estimate.personMinutes || recalculated.handlingMinutes) / 60) * laborRate));
    const routeCost = analysis.routeNodes.length > 1 ? Math.ceil(recalculated.routeMinutes * 0.65) : 0;
    const coordinationCost = usesSpecialistHandoff ? 15 : coordinated && plan.key === "complete" ? 35 : 0;
    const transportMembers = formed.members.filter(member => /moving|driver|handling/i.test(member.role));
    const inHomeMembers = formed.members.filter(member => /assembly|mount|plumb|install/i.test(member.role));
    const supportMember = formed.members.find(member => /handling/i.test(member.role));
    const serviceAssignments: ServiceAssignment[] = usesSpecialistHandoff ? [
      { title: "Service A · Retail pickup and delivery", executors: (transportMembers.length ? transportMembers : formed.members.slice(0, 2)).map(member => member.name).join(" + "), tasks: "Tasks 1–2", handoff: "Doneeo records delivery condition and releases Service B only after approval.", arrival: "Arrives at the retailer for pickup", departure: "Leaves after Task 2 delivery proof is accepted" },
      { title: "Service B · In-home completion", executors: Array.from(new Set([...(inHomeMembers.length ? inHomeMembers : formed.members.slice(1)), ...(supportMember ? [supportMember] : [])].map(member => member.name))).join(" + "), tasks: `Tasks 3–${analysis.tasks.length}`, handoff: "Doneeo schedules this unit against the confirmed delivery window under the same order.", arrival: "Arrives at the apartment for the managed handoff", departure: `Leaves after Task ${analysis.tasks.length} and final customer approval` },
    ] : [{ title: coordinated && plan.key === "complete" ? "Managed company team" : "Continuous execution team", executors: formed.members.map(member => member.name).join(" + "), tasks: `Tasks 1–${analysis.tasks.length}`, handoff: "No executor change or internal customer handoff.", arrival: "The same team starts at the first location", departure: `The same team leaves after Task ${analysis.tasks.length} and final approval` }];
    const fulfillmentLabel = usesSpecialistHandoff ? "One customer order · two specialist services" : coordinated && plan.key === "complete" ? "One customer order · managed company team" : "One customer order · one continuous team";
    return { ...plan, duration, team: `${formed.members.length} executor${formed.members.length > 1 ? "s" : ""}`, provider, providerRating, teamFormation: formed.members, formationType: formed.formationType, strategy, credential, rentalLogistics, rentalMinutes, rentalTotal, equipmentRows, fulfillmentLabel, serviceAssignments, price: laborCost + routeCost + rentalCost + purchaseCost + rentalLogisticsCost + coordinationCost, breakdown: [`Labour & access $${laborCost}`, `Transportation $${routeCost}`, `Equipment rental $${rentalCost}`, `Materials purchase $${purchaseCost}`, `Doneeo coordination $${coordinationCost}`, `Rental delivery & collection $${rentalLogisticsCost}`] };
  });

  if (category === "elder_support") {
    return enrich([
      { key: "budget", name: "Practical visit", badge: "Non-regulated support", price: budget, team: "Verified local helper", equipment: "Transport as requested", inclusions: ["Groceries or errands", "Companionship", "Basic wellness observation", "Visit completion note"], why: "Lowest cost because it excludes personal, clinical and medication-related care.", duration, match: "Verified helper · relevant support experience", breakdown: [`Base service $${rawBudget}`, `Tasks/stops $${complexity}`] },
      { key: "recommended", name: regulated ? "Qualified care option" : "Recommended visit", badge: "Best fit", price: regulated ? recommended + 25 : recommended, team: regulated ? "Qualified care provider" : "Highly rated support helper", equipment: "Task-specific preparation", inclusions: ["Planned support visit", "Family update", "Travel and task coordination", regulated ? "Regulated needs routed appropriately" : "Recurring-ready work order"], why: regulated ? "Costs more because the request contains care needs that cannot be assigned to a general helper." : "Adds stronger screening, coordination and a family update.", duration, match: regulated ? "Qualified care credential required" : "4.8+ rating · support experience", breakdown: [`Base service $${rawRecommended}`, `Tasks/stops $${complexity}`, regulated ? "Qualified care +$25" : "Screening included"] },
      { key: "complete", name: "Managed support", badge: "Doneeo coordinates", price: regulated ? complete + 30 : complete, team: "Lead provider + backup coverage", equipment: "Full visit preparation", inclusions: ["Provider coordination", "Recurring schedule setup", "Backup coverage plan", "Detailed completion record"], why: "Includes recurring coordination, backup planning and a more complete family-facing service record.", duration, match: "Lead provider + verified backup", breakdown: [`Base service $${rawComplete}`, `Tasks/stops $${complexity}`, regulated ? "Qualified care +$30" : "Coordination included"] },
    ]);
  }

  const mountingOnlyCopy = analysis.intelligence?.domains?.some(domain => domain.id === "mounting") && !analysis.intelligence?.domains?.some(domain => domain.id === "furniture_assembly");
  const labels: Record<JobCategory, { budget: string[]; recommended: string[]; complete: string[]; team: string; gear: string }> = {
    moving: { budget: [`${analysis.recommendedTeamSize} executor${analysis.recommendedTeamSize > 1 ? "s" : ""} — calculated from the work`, "All listed stops", "Basic carry"], recommended: [`${analysis.recommendedTeamSize}-person compatible execution team`, "Van or truck", "Blankets and straps"], complete: [`${analysis.recommendedTeamSize}-person managed team`, "All stop coordination", "Protection and final placement"], team: `${analysis.recommendedTeamSize}-person moving team`, gear: "Vehicle, blankets and straps" },
    installation: mountingOnlyCopy
      ? { budget: ["Wall-mount installation labour", "Customer-confirmed bracket and fixings", "Level and final stability check"], recommended: ["Wall-mount specialist", "Stud/service check and tool verification", "Mounting, levelling and customer validation"], complete: ["Pre-visit bracket and wall review", "Materials-gap management", "Mounting, testing and cleanup"], team: "Wall-mount specialist", gear: "Drill, detector, level and ladder" }
      : { budget: ["Assembly labour", "Customer-provided tools/materials", "Basic placement"], recommended: ["Experienced installer", "Tool verification", "Assembly and placement"], complete: ["Pre-visit product review", "Materials-gap management", "Installation and cleanup"], team: regulated ? "Licensed professional" : "Experienced installer", gear: "Verified installation tools" },
    cleaning: { budget: ["One cleaner", "All requested rooms and surfaces", "Customer or invoiced consumables"], recommended: ["Two cleaners working in parallel", "Products and equipment verified", "Visit checklist and completion update"], complete: ["Managed cleaning team", "All products supplied", "Continuity and backup coverage"], team: "Residential cleaning team", gear: "Vacuum, mop, cloths and surface-specific products" },
    general: { budget: ["Prepared eligible executor", "Core task only", "Provider equipment verified"], recommended: ["Best-fit executor", "Tool and skill verification", "Complete task plan"], complete: ["Doneeo coordination", "Equipment-gap management", "Completion verification"], team: regulated ? "Qualified professional" : "Best-fit helper", gear: "Task-specific tools" },
    elder_support: { budget: [], recommended: [], complete: [], team: "", gear: "" },
  };
  const copy = labels[category];
  const mixedFulfillment = analysis.intelligence?.fulfillment.mode === "coordinated_specialists";
  return enrich([
    { key: "budget", name: mixedFulfillment ? "Coordinated specialists" : "Budget", badge: mixedFulfillment ? "Lowest total cost" : "Essential service", price: budget, team: `${analysis.recommendedTeamSize} prepared executor${analysis.recommendedTeamSize > 1 ? "s" : ""}`, equipment: category === "moving" ? "Vehicle sized after item check" : "Customer supplies known materials", inclusions: mixedFulfillment ? ["Transport unit for Tasks 1–2", "In-home unit for the remaining tasks", "Doneeo manages the handoff"] : copy.budget, why: mixedFulfillment ? "Usually costs less because each qualified unit is paid only for the tasks it is needed to perform. The customer still receives one order, price and tracker." : noCustomerHelp && category === "moving" ? `${analysis.recommendedTeamSize} executors are included because the work cannot depend on customer lifting.` : "Lower price with essential execution and limited coordination.", duration, match: category === "moving" ? "Vehicle + lifting capacity + availability" : "Skill + tools + availability", breakdown: [`Base service $${rawBudget}`, `Workload/team/stops $${complexity}`] },
    { key: "recommended", name: mixedFulfillment ? "One team throughout" : "Recommended", badge: mixedFulfillment ? "Smoothest experience" : "Best value", price: regulated ? recommended + 30 : recommended, team: copy.team, equipment: copy.gear, inclusions: mixedFulfillment ? ["Same cross-qualified team for every task", "No executor arrival gap", "One lead responsible through final approval"] : copy.recommended, why: regulated ? "The request may require a licensed professional, which changes eligibility and price." : mixedFulfillment ? "Costs more than a specialist handoff because the same cross-qualified team remains assigned from pickup through the final in-home task." : "Balances preparation, capability and price while respecting every stated constraint.", duration, match: category === "moving" ? "Best-rated compatible team + correct vehicle" : "Best-rated qualified provider", breakdown: [`Base service $${rawRecommended}`, `Stops/tasks $${complexity}`, regulated ? "Licence requirement +$30" : "Matching included"] },
    { key: "complete", name: mixedFulfillment ? "Managed company team" : "Full service", badge: "Doneeo manages all", price: regulated ? complete + 35 : complete, team: `${copy.team} + coordination`, equipment: "All identified equipment gaps managed", inclusions: mixedFulfillment ? ["Established multi-skill company team", "Backup coverage and equipment management", "Same work order through verified completion"] : copy.complete, why: mixedFulfillment ? "Highest price because an established company team, equipment-gap management and backup coverage remain committed to the complete order." : "Includes planning, all-stop coordination, equipment-gap management and completion verification.", duration, match: "Top compatible provider + backup coordination", breakdown: [`Base service $${rawComplete}`, `Stops/tasks $${complexity}`, regulated ? "Licence requirement +$35" : "Full coordination included"] },
  ]);
}
