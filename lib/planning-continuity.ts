import { extractScheduleWindow, intakeCleaningDepth, normalizeIntakeForInference, type PlannerAnalysis, type PlannerQuestion } from "./planner";

// A provider outage must not replace an established WorkCase with a new,
// less-informed interpretation of the original request.
export function savedPlanningFallback(
  snapshot: unknown,
  originalRequest: string,
): PlannerAnalysis | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const prior = snapshot as Partial<PlannerAnalysis>;
  if (
    !Array.isArray(prior.tasks) || !prior.tasks.length ||
    !Array.isArray(prior.questions) || !Array.isArray(prior.routeNodes) ||
    !Array.isArray(prior.understoodFacts) || !prior.extractedAnswers ||
    !prior.estimate || !prior.audit
  ) return null;
  return {
    ...structuredClone(prior as PlannerAnalysis),
    sourceText: originalRequest,
    audit: {
      ...structuredClone(prior.audit),
      status: "deterministic",
    },
  };
}

type Answer = string | boolean;
type QuestionRef = Pick<PlannerQuestion, "id" | "label" | "taskBlockId">;

const aliases: Record<string, string> = {
  standard_or_deep_clean: "cleaning_depth",
  cleaning_type: "cleaning_depth",
  clean_type: "cleaning_depth",
  cleaning_access: "home_access",
  entry_method: "home_access",
  pet_presence: "pets",
  pets_present: "pets",
  cleaning_supply_owner: "cleaning_supplies",
  customer_assistance: "customer_help",
  can_customer_help: "customer_help",
};

function words(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function scopedDetail(label: string) {
  return /\b(?:kitchen|bathroom|bedroom|basement|garage|balcony|upstairs|downstairs|side entrance|side door|loading dock|separate entrance)\b/.test(label);
}

function asksAnotherQuestion(label: string) {
  return /\b(?:and|also|plus)\s+(?:how|where|when|who|what|whether|which|can|will|do)\b/.test(label);
}

function questionLabelKey(question: QuestionRef) {
  const stop = question.id.match(/^(?:stop_\d+|pickup|delivery)_/i);
  return (stop?.[0] || "") + words(question.label);
}

function topic(question: QuestionRef, analysis: Pick<PlannerAnalysis, "category" | "routeNodes">): string | undefined {
  const id = question.id.toLowerCase();
  const label = words(question.label);
  if (/^(?:stop_\d+_|pickup_|delivery_)/.test(id) || /\b(?:stop \d+|at pickup|at delivery|at the destination|at the pickup)\b/.test(label)) return undefined;
  if (scopedDetail(label)) return undefined;
  if (asksAnotherQuestion(label)) return undefined;
  const known = aliases[id] || id;
  if (["schedule", "deadline"].includes(known)) return known;
  if (!/\b(?:load|unload|deliver|carry down|carry up)\b/.test(label)
    && (known === "customer_help" || /\b(?:can|could|will) (?:you|the customer) (?:safely )?(?:help|assist)\b/.test(label))) return "customer_help";
  if (analysis.category !== "cleaning") return undefined;
  if (/\b(?:standard|regular|routine)\b.*\bdeep\b|\bdeep\b.*\b(?:standard|regular|routine)\b|^cleaning (?:depth|type)\b/.test(label)) return "cleaning_depth";
  if (!/\b(?:behave|secure|crate|allerg\w*|friendly|kind|type|number|how many)\b/.test(label)
    && (known === "pets" || (/\b(?:pets?|animals?)\b/.test(label) && /\b(?:any|present|on site|there|do you have)\b/.test(label)))) return "pets";
  if (analysis.routeNodes.length < 2 && !/\b(?:parking|codes?|keys?|gate|stairs|elevator|lockbox|instructions)\b/.test(label)
    && (known === "home_access" || /\b(?:how|who)\b.*\b(?:enter|let .* in|access the (?:home|house|property))\b/.test(label))) return "home_access";
  if (!/\b(?:specific|which|what|brands?|ingredients?|available quantities)\b/.test(label)
    && (known === "cleaning_supplies" || /\b(?:provide|supplied|provided|bring|have)\b.*\bcleaning (?:supplies|products)\b|\bcleaning (?:supplies|products)\b.*\b(?:provide|supplied|provided|bring)\b/.test(label))) return "cleaning_supplies";
  if (known === "cleaning_depth" && /\b(?:level|depth)\b/.test(label)) return known;
  return undefined;
}

const safetyTopics = {
  cleaning_delicate_surfaces: "delicate surfaces",
  cleaning_allergies: "allergies",
  cleaning_product_restrictions: "products to avoid",
} as const;
type SafetyTopic = keyof typeof safetyTopics;

function cleaningSafetyTopics(question: QuestionRef): SafetyTopic[] {
  const label = words(question.label);
  if (scopedDetail(label) || asksAnotherQuestion(label)) return [];
  const topics: SafetyTopic[] = [];
  if (/\b(?:delicate|sensitive|fragile) surfaces\b/.test(label)) topics.push("cleaning_delicate_surfaces");
  if (/\ballerg(?:y|ies)\b/.test(label)) topics.push("cleaning_allergies");
  if (/\bproduct restrictions\b|\bproducts?\b.{0,36}\b(?:avoid(?:ed)?|restrictions?)\b/.test(label)) topics.push("cleaning_product_restrictions");
  const id = question.id as SafetyTopic;
  if (Object.hasOwn(safetyTopics, id) && !topics.includes(id)) topics.push(id);
  return topics;
}

function cleaningSafetyFacts(text: string) {
  const generalNotes = text.split(/[.!?;\n]+/).filter(line => !scopedDetail(words(line))).join("\n");
  const product = generalNotes.match(/\bno (?:other |cleaning )?product restrictions\b|\b(?:do not use|don't use|avoid|no)\s+(?:(?:chlorine|scented|fragranced|harsh|abrasive|strong)\s+)?(?:bleach|ammonia|vinegar|fragrances?|solvents?|chemicals?|(?:cleaning )?products?|detergents?|cleaners?)\b/i);
  const allergies = generalNotes.match(/\bno (?:known )?allergies\b|\bno (?:delicate|sensitive|fragile) surfaces (?:or|and) allergies\b|\ballergic to\s+[^.!?\n]+/i);
  const surfaces = generalNotes.match(/\bno (?:delicate|sensitive|fragile) surfaces\b|\bno (?:known )?allergies (?:or|and) (?:delicate|sensitive|fragile) surfaces\b/i);
  const facts: Partial<Record<SafetyTopic, Answer>> = {};
  if (product) facts.cleaning_product_restrictions = product[0];
  if (allergies) facts.cleaning_allergies = allergies[0];
  if (surfaces) facts.cleaning_delicate_surfaces = surfaces[0];
  return facts;
}

function requestFacts(analysis: PlannerAnalysis, includeTiming = true): Record<string, Answer> {
  const text = normalizeIntakeForInference(analysis.sourceText).replace(/’/g, "'");
  const facts: Record<string, Answer> = {};
  const timing = includeTiming ? extractScheduleWindow(text) : null;
  if (timing?.arrivalTime) facts.schedule = timing.arrivalLabel;
  if (timing?.deadlineTime) facts.deadline = timing.deadlineLabel || timing.deadlineTime;
  if (/\b(?:i|we)\s+(?:can(?:not|'t)|won't|will not|am unable to|are unable to)\s+(?:safely\s+)?(?:help|lift|carry|assist)\b/i.test(text)) facts.customer_help = false;
  if (analysis.category !== "cleaning") return facts;

  if (/\b(?:no pets|(?:don't|do not) have (?:any )?pets|pets? (?:will not|won't) be (?:home|present|on site|there))\b/i.test(text)) facts.pets = false;
  const entry = text.match(/\b(?:i|we)(?:\s+will|'ll)\s+(?:be (?:at )?home to )?let\b[^.!?]{0,70}\bin\b/i);
  if (entry) facts.home_access = entry[0];
  const supplies = text.match(/\b(?:i|we)(?:\s+(?:will|can)|'ll)\s+(?:provide|supply|have)\s+(?:all\s+)?(?:the\s+)?cleaning (?:supplies|products)\b/i);
  if (supplies) facts.cleaning_supplies = supplies[0];
  const depth = intakeCleaningDepth(text);
  if (depth) facts.cleaning_depth = depth;
  return { ...facts, ...cleaningSafetyFacts(text) };
}

const supplied = (value: unknown): value is Answer => typeof value === "boolean" || (typeof value === "string" && value.trim().length > 0);

// Keep the question's wording alongside its ID so a later model turn can
// recognise an answered detail even if it gives the question a new ID.
export function rememberClarifications(previous: PlannerAnalysis | null, answers: Record<string, Answer>): QuestionRef[] {
  const questions = new Map<string, QuestionRef>();
  for (const question of [...(previous?.answeredQuestions || []), ...(previous?.questions || [])]) {
    if (supplied(answers[question.id])) questions.set(question.id, {
      id: question.id,
      label: question.label,
      ...(question.taskBlockId ? { taskBlockId: question.taskBlockId } : {}),
    });
  }
  return [...questions.values()].slice(-40);
}

export function retainKnownIntakeFacts(analysis: PlannerAnalysis, answers: Record<string, Answer>, history: QuestionRef[]) {
  const facts = requestFacts(analysis);
  const replies = Object.values(answers).filter((value): value is string => typeof value === "string");
  const replyFacts = requestFacts({ ...analysis, sourceText: replies.join("\n") }, false);
  const explicit = { ...facts, ...replyFacts, ...answers };
  const known = { ...analysis.extractedAnswers, ...explicit };
  const prompts = new Set(history.map(questionLabelKey));
  const confirmedFacts: string[] = [];
  for (const question of history) {
    const answer = answers[question.id];
    if (!supplied(answer)) continue;
    confirmedFacts.push(`${question.label}: ${typeof answer === "boolean" ? (answer ? "Yes" : "No") : answer}`);
    const key = topic(question, analysis);
    if (key) explicit[key] = known[key] = answer;
  }

  // A saved or model-extracted "surface_notes" value may contain only one
  // restriction. Keep each safety answer separate before deciding what to ask.
  const questions = [...analysis.questions];
  if (analysis.category === "cleaning") {
    if (typeof known.surface_notes === "string" && Object.keys(cleaningSafetyFacts(known.surface_notes.replace(/’/g, "'"))).length
      && !questions.some(question => question.id === "surface_notes" || question.id === "cleaning_safety_followup")) {
      questions.push({
        id: "surface_notes", label: "Are there any delicate surfaces, allergies or products to avoid?", type: "text", required: true,
      });
    }
    for (const question of [...questions, ...history]) {
      const value = known[question.id];
      if (typeof value !== "string" || cleaningSafetyTopics(question).length < 2) continue;
      for (const [key, detail] of Object.entries(cleaningSafetyFacts(value.replace(/’/g, "'")))) {
        if (!supplied(explicit[key])) explicit[key] = known[key] = detail;
      }
    }
    for (const question of history) {
      const topics = cleaningSafetyTopics(question);
      if (!topics.length) continue;
      const answer = answers[question.id];
      if (!supplied(answer)) continue;
      const response = typeof answer === "string" ? cleaningSafetyFacts(answer.replace(/’/g, "'")) : {};
      if (Object.keys(response).length && topics.length > 1) continue;
      for (const key of topics) explicit[key] = known[key] = answer;
    }
  }
  const visible = new Map<string, PlannerQuestion>();
  for (const question of questions) {
    const normalized = questionLabelKey(question);
    const details = analysis.category === "cleaning" ? cleaningSafetyTopics(question) : [];
    const missing = details.filter(key => !supplied(explicit[key]));
    if (details.length > 0 && missing.length === 0) continue;
    if (details.length > 1 && missing.length < details.length) {
      const label = `Are there any ${missing.map(key => safetyTopics[key]).join(" or ")} the cleaner should know about?`;
      const id = supplied(known[question.id])
        ? (missing.length === 1 ? `confirm_${missing[0]}` : "cleaning_safety_followup")
        : question.id;
      const candidate: PlannerQuestion = { ...question, id, label, type: "text", options: undefined };
      const duplicate = visible.get(words(label));
      if (!duplicate || (candidate.required !== false && duplicate.required === false)) visible.set(words(label), candidate);
      continue;
    }
    const key = topic(question, analysis);
    if (supplied(known[question.id]) || prompts.has(normalized) || (key && supplied(explicit[key]))) continue;
    const identity = key || normalized;
    const duplicate = visible.get(identity);
    if (!duplicate || (question.required !== false && duplicate.required === false)) visible.set(identity, question);
  }
  return {
    ...analysis,
    questions: [...visible.values()],
    extractedAnswers: known,
    answeredQuestions: history,
    understoodFacts: [...new Set([...analysis.understoodFacts, ...confirmedFacts])].slice(0, 24),
    customerCanHelp: typeof known.customer_help === "boolean" ? known.customer_help : analysis.customerCanHelp,
  };
}

function isRoutineReply(value: Answer) {
  if (typeof value === "boolean") return true;
  const text = normalizeIntakeForInference(value).replace(/\b(?:[ap]\.m\.|apt\.|st\.|ave\.|rd\.|dr\.|blvd\.)(?=\s|$)/gi, "");
  const changeOrRisk = /\b(?:actually|instead|also|forget that|in addition|one more thing|change (?:the|my)|but|however|broken|cracked|damaged|unstable|hazard\w*|asbestos|mou?ld|flood\w*|smoke|exposed wir(?:e|es|ing)|gas (?:leak|smell))\b/i;
  const multipleStatements = /[.!?]\s+(?=[\p{L}\p{N}])|\n\s*\S/u;
  return !changeOrRisk.test(text) && !multipleStatements.test(text);
}

function routineReplies(previous: PlannerAnalysis | null, changes: Record<string, Answer>) {
  const replies = Object.entries(changes);
  return previous !== null && replies.length > 0
    && replies.every(([id, value]) => previous.questions.some(question => question.id === id) && isRoutineReply(value));
}

export function canContinueIntake(analysis: PlannerAnalysis, previous: PlannerAnalysis | null, changes: Record<string, Answer>) {
  return routineReplies(previous, changes) && analysis.rulesGate?.status === "needs_information"
    && analysis.rulesGate.riskLevel !== "high";
}

export function isReadyForPlanReview(analysis: PlannerAnalysis) {
  return analysis.rulesGate?.status === "cleared" && analysis.intelligence?.estimate.ready === true
    && analysis.intelligence.unresolved.length === 0;
}

// These facts are applied by the deterministic planner to an existing draft.
// An open-ended scope or safety answer still needs the architect.
const deterministicReviewAnswers = new Set([
  "schedule", "arrival_window", "home_access", "cleaning_depth", "pets",
  "handling_access", "handling_size_weight", "handling_contents",
  "retailer_pickup_status", "retailer_release_details", "dishwasher_parts", "dishwasher_access_fit",
  "pickup_address", "service_address", "delivery_address",
]);

export function canReviewSavedPlan(analysis: PlannerAnalysis, previous: PlannerAnalysis | null, changes: Record<string, Answer>) {
  return isReadyForPlanReview(analysis) && analysis.rulesGate?.riskLevel !== "high"
    && routineReplies(previous, changes)
    && Object.keys(changes).every(id => deterministicReviewAnswers.has(id) || /^stop_\d+_(?:floor|elevator|vehicle_access)$/.test(id));
}
