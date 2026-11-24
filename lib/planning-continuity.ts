import { extractScheduleWindow, type PlannerAnalysis, type PlannerQuestion } from "./planner";

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
type QuestionRef = Pick<PlannerQuestion, "id" | "label">;

const aliases: Record<string, string> = {
  standard_or_deep_clean: "cleaning_depth",
  cleaning_type: "cleaning_depth",
  clean_type: "cleaning_depth",
  cleaning_access: "home_access",
  entry_method: "home_access",
  pet_presence: "pets",
  pets_present: "pets",
  cleaning_supply_owner: "cleaning_supplies",
  cleaning_product_restrictions: "surface_notes",
  customer_assistance: "customer_help",
  can_customer_help: "customer_help",
};

function words(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function topic(question: QuestionRef, analysis: PlannerAnalysis): string | undefined {
  const id = question.id.toLowerCase();
  const label = words(question.label);
  if (/^(?:stop_\d+_|pickup_|delivery_)/.test(id) || /\b(?:stop \d+|at pickup|at delivery|at the destination|at the pickup)\b/.test(label)) return undefined;
  const known = aliases[id] || id;
  if (["schedule", "deadline", "pets", "customer_help", "cleaning_depth", "cleaning_supplies", "surface_notes", "home_access"].includes(known)) return known;
  if (/\b(?:can|could|will) (?:you|the customer) (?:safely )?(?:help|assist)\b/.test(label)) return "customer_help";
  if (analysis.category !== "cleaning") return undefined;
  if (/\b(?:standard|regular|routine)\b.*\bdeep\b|\bdeep\b.*\b(?:standard|regular|routine)\b|^cleaning (?:depth|type)\b/.test(label)) return "cleaning_depth";
  if (/\b(?:pets?|animals?)\b/.test(label) && /\b(?:any|present|on site|there|do you have)\b/.test(label) && !/\b(?:behave|secure|crate|allerg|friendly|kind|type|number)\b/.test(label)) return "pets";
  if (/\b(?:how|who)\b.*\b(?:enter|let .* in|access the (?:home|house|property))\b/.test(label) && analysis.routeNodes.length < 2) return "home_access";
  if (/\b(?:provide|supplied|provided|bring|have)\b.*\bcleaning (?:supplies|products)\b|\bcleaning (?:supplies|products)\b.*\b(?:provide|supplied|provided|bring)\b/.test(label)) return "cleaning_supplies";
  return undefined;
}

function requestFacts(analysis: PlannerAnalysis, includeTiming = true): Record<string, Answer> {
  const text = analysis.sourceText.replace(/’/g, "'");
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
  const restriction = text.match(/\b(?:do not use|don't use|avoid|no)\s+(?:chlorine\s+)?bleach\b|\bno (?:cleaning )?(?:product restrictions|allergies or delicate surfaces)\b/i);
  if (restriction) facts.surface_notes = restriction[0];
  const depth = text.match(/\b(?:regular|standard|routine|deep) clean(?:ing)?\b/i);
  if (depth) facts.cleaning_depth = depth[0];
  return facts;
}

const supplied = (value: unknown): value is Answer => typeof value === "boolean" || (typeof value === "string" && value.trim().length > 0);

// Keep the question's wording alongside its ID so a later model turn can
// recognise an answered detail even if it gives the question a new ID.
export function rememberClarifications(previous: PlannerAnalysis | null, answers: Record<string, Answer>): QuestionRef[] {
  const questions = new Map<string, QuestionRef>();
  for (const question of [...(previous?.answeredQuestions || []), ...(previous?.questions || [])]) {
    if (supplied(answers[question.id])) questions.set(question.id, { id: question.id, label: question.label });
  }
  return [...questions.values()].slice(-40);
}

export function retainKnownIntakeFacts(analysis: PlannerAnalysis, answers: Record<string, Answer>, history: QuestionRef[]) {
  const facts = requestFacts(analysis);
  const replies = Object.values(answers).filter((value): value is string => typeof value === "string");
  const replyFacts = requestFacts({ ...analysis, sourceText: replies.join("\n") }, false);
  const known = { ...analysis.extractedAnswers, ...facts, ...replyFacts, ...answers };
  const prompts = new Set(history.map(question => words(question.label)));
  for (const question of history) {
    const key = topic(question, analysis);
    if (key) known[key] = answers[question.id];
  }
  for (const [key, value] of Object.entries(answers)) {
    if (aliases[key]) known[aliases[key]] = value;
  }
  const visible = new Map<string, PlannerQuestion>();
  for (const question of analysis.questions) {
    const normalized = words(question.label);
    const key = topic(question, analysis);
    if (supplied(known[question.id]) || prompts.has(normalized) || (key && supplied(known[key]))) continue;
    const identity = key || normalized;
    const duplicate = visible.get(identity);
    if (!duplicate || (question.required && !duplicate.required)) visible.set(identity, question);
  }
  return {
    ...analysis,
    questions: [...visible.values()],
    extractedAnswers: known,
    answeredQuestions: history,
    customerCanHelp: typeof known.customer_help === "boolean" ? known.customer_help : analysis.customerCanHelp,
  };
}

export function canContinueIntake(analysis: PlannerAnalysis, previous: PlannerAnalysis | null, changes: Record<string, Answer>) {
  const replies = Object.entries(changes);
  return previous !== null && replies.length > 0
    && replies.every(([id, value]) => previous.questions.some(question => question.id === id)
      && !(typeof value === "string" && /\b(?:actually|instead|also need|forget that|in addition|one more thing|change (?:the|my))\b/i.test(value)))
    && analysis.rulesGate?.status === "needs_information"
    && analysis.rulesGate.riskLevel !== "high";
}
