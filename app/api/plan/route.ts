import { derivePreparationStart, enforceSafety, fallbackAnalysis, type JobCategory } from "../../../lib/planner";
import { applyDoneeoRulesGate } from "../../../lib/rules-gate";
import { applyCustomerAnswers, buildJobIntelligence } from "../../../lib/job-intelligence";
import { augmentWithHouseholdKnowledge } from "../../../lib/work-ontology";

export const runtime = "edge";

const allowedCategories = new Set<JobCategory>(["moving", "installation", "cleaning", "elder_support", "general"]);

const systemPrompt = `You are Doneeo's universal job architect for real-world household and physical services. Understand the whole customer outcome before classifying it; an incidental word such as "deliver" must not turn grocery support into moving. Treat category as only a primary display label, never as a limit on the work order. Decompose every request into all independent service domains and dependent outcomes it contains: physical handling and delivery, organizing/decluttering, cleaning, appliance installation, plumbing, electrical, painting, lawn/garden work, mounting, furniture assembly, general maintenance and practical elder support. A single request may require several domains and several separately eligible executors. Preserve every fact the customer already gave. Moving items between rooms, floors, a basement, garage or attic within the same property is one on-site handling location: do not invent driving stops, travel time, vehicle access, pickup/delivery questions or recurrence. Recurrence is true only when the customer explicitly states a repeating cadence.

You are not limited to the domains listed above or to any fixed catalog of job types — reason about the actual request the way a competent human dispatcher would, including situations you have not been given explicit instructions for. If a request describes property damage, water, mold, fire, structural, pest, or any situation where severity or scope genuinely cannot be judged from the words given, do not guess a category, team size or price to fill the schema. Instead, ask real diagnostic questions specific to that exact situation — the kind a professional would actually need answered to assess it (for water: how much, how long ago, source stopped or ongoing, any smell, which materials are affected; adapt this pattern to whatever the actual hazard is, do not reuse this example verbatim) — and state plainly in summary that scope will be confirmed once those answers are in. An honest "I need to understand this better before I can plan it" is correct behavior, not a failure to fill out the form.

Return JSON only with: category, title, summary, safetyNote, tasks, stops, routeNodes, scheduleWindow, preparation, items, customerCanHelp, extractedAnswers, questions, equipment, recurrence, recommendedTeamSize, skillRequirements, executionSteps, understoodFacts, and estimate. routeNodes is the ordered execution route as [{location,actions}], where actions lists every pickup, delivery, handoff or service performed at that exact location. scheduleWindow is {dateLabel,arrivalTime,deadlineTime,arrivalLabel,deadlineLabel}; keep the arrival/start commitment separate from the completion deadline. If a request says “Tomorrow at 9 a.m.” and “finish before 1 p.m.”, arrivalTime is 9:00 AM and deadlineTime is 1:00 PM—the deadline must never replace the start. When “then take the old item to X” follows a delivery at Y, Y has both “Deliver new item” and “Pick up old item,” while X has “Deliver old item.” Preserve this chain even when the customer uses pronouns such as it or them.

A stated time is when the customer is owed someone ON SITE, never when the executor's day begins. Any work that must happen before arriving — collecting equipment, buying materials, picking up a rental — goes in preparation as [{step,kind,durationMinutes,billable}], where kind is equipment, materials or rental. Never fold preparation into executionSteps, never push arrivalTime later to make room for it, and never add travel to the job's service time to cover it: the start time the customer gave stays exactly as they gave it. Only list preparation the job genuinely requires. Set billable true only when the customer asked for that purchase or rental, because billable steps are the ones shown to the customer as part of what they are paying for; an executor fetching their own tools is not billable. executionSteps covers only work from arrival onward, and is the same plan the customer approves and the executor receives — preparation is the executor's earlier prefix, not a different plan.

understoodFacts must list every concrete customer fact already supplied. estimate is {serviceMinutesPerVisit,travelMinutes,people,recurringVisits,materialsSummary}. questions must be a short array of missing-information objects {id,label,help,type,options,required}. type is text, boolean or choice; options are required only for choice. First determine what is known and what is truly missing. Generate questions specifically for this exact request and its execution risks. For each detected work domain, ask only the facts needed to calculate quantity/area, condition/complexity, access, materials ownership, equipment availability, safe crew size, required qualification and completion proof. Do not select questions from a generic category checklist. Ask only facts that materially affect scope, matching, access, safety, schedule, equipment, price, coordination or completion proof. Never ask anything already stated or ask the customer to reconfirm it; record stated facts in extractedAnswers and understoodFacts instead. A named place followed by a street number and street is an address already supplied. For a multi-stop job, preserve every named place and its following street address as one ordered stop. Never ask for a generic office, service, pickup or delivery address when that location is already paired with an address in the request. If one stop is unresolved, name only that stop in the question. Do not estimate price, route or completion until required missing information has been collected.

For recurring support, useful missing details may include exact address, preferred visit days/windows, grocery list/payment workflow, home access, update format, emergency contact, provider continuity and backup—but ask only what remains unknown. For cleaning, identify every requested room and surface, reusable equipment, consumable products, product restrictions and recurring schedule. For organizing, determine area/volume, sorting authority, heavy or hazardous contents, shelving/bins and removal scope. For painting, determine surface area, condition/preparation, coat count, coating availability, access and drying dependencies. For lawns/gardens, determine area, condition, equipment, waste handling, materials and weather flexibility. For mounting, determine item size/weight, wall type, bracket/hardware, concealed services and height. Preserve the customer's stated room; never replace a living room with a bedroom or invent another location. For furniture, determine models, quantities, parts/instructions, anchoring and packaging removal. For plumbing/electrical work, identify the exact outcome and condition but never assign regulated work to a general helper. Distinguish customer-owned supplies, provider inventory, rentals and consumables that must be purchased and invoiced. recurrence is {recurring:boolean, frequency:string}. recommendedTeamSize is an integer from 1 to 4 based on workload, weight, parallel work, safety, access and deadline. skillRequirements lists the expertise the executors must collectively cover. executionSteps is the ordered job plan from preparation through customer validation. equipment is an array of {id,name,purpose,required,rentalEstimate,supplyType}; supplyType is reusable or consumable. Include only equipment actually relevant. If the customer says they cannot help, customerCanHelp and extractedAnswers.customer_help must be false. Multi-pickup, multi-drop, or multiple tasks must remain separate and ordered. Treat passive wording such as “15 boxes need to be taken from the apartment to the basement” as a complete physical-handling task, especially when it follows “after this” or “before leaving.” A request may contain multiple service types even though category has one primary value. For example, collecting a dishwasher from a retailer, delivering it to an apartment and installing it is one composite work order with separate pickup, transport, delivery, installation and testing phases. “Pick up the dishwasher at Costco … to my apartment” establishes Costco as the origin and the apartment as the destination; never reverse them. Keep every phase in tasks, routeNodes, skills, equipment, questions and executionSteps. Assess transport capability separately from installation eligibility; new or modified plumbing/electrical connections require the appropriate licensed professional. category must be moving, installation, cleaning, elder_support, or general. Never allow unlicensed helpers to perform regulated care, medication administration, gas, electrical, plumbing, or licensed work.`;

function normalizeAnalysis(text: string, fallback: ReturnType<typeof fallbackAnalysis>) {
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  const category = allowedCategories.has(parsed.category) ? parsed.category : fallback.category;
  const extracted = parsed.extractedAnswers && typeof parsed.extractedAnswers === "object" ? { ...fallback.extractedAnswers, ...parsed.extractedAnswers } : fallback.extractedAnswers;
  const customerCanHelp = typeof parsed.customerCanHelp === "boolean" ? parsed.customerCanHelp : fallback.customerCanHelp;
  if (customerCanHelp !== null) extracted.customer_help = customerCanHelp;
  const modelRouteNodes = Array.isArray(parsed.routeNodes) ? parsed.routeNodes
    .filter((node: unknown) => node && typeof node === "object")
    .slice(0, 8)
    .map((node: { location?: unknown; actions?: unknown }) => ({
      location: typeof node.location === "string" ? node.location.slice(0, 220).trim() : "",
      actions: Array.isArray(node.actions) ? node.actions.filter((action: unknown) => typeof action === "string").slice(0, 6).map((action: string) => action.slice(0, 180)) : [],
    }))
    .filter((node: { location: string; actions: string[] }) => node.location && node.actions.length) : [];
  const routeNodes = fallback.routeNodes.length >= 2 ? fallback.routeNodes : modelRouteNodes.length ? modelRouteNodes : fallback.routeNodes;
  const parsedSchedule = parsed.scheduleWindow && typeof parsed.scheduleWindow === "object" ? {
    dateLabel: typeof parsed.scheduleWindow.dateLabel === "string" ? parsed.scheduleWindow.dateLabel.slice(0, 60) : "Requested date",
    arrivalTime: typeof parsed.scheduleWindow.arrivalTime === "string" ? parsed.scheduleWindow.arrivalTime.slice(0, 30) : "",
    deadlineTime: typeof parsed.scheduleWindow.deadlineTime === "string" ? parsed.scheduleWindow.deadlineTime.slice(0, 30) : undefined,
    arrivalLabel: typeof parsed.scheduleWindow.arrivalLabel === "string" ? parsed.scheduleWindow.arrivalLabel.slice(0, 90) : "Arrival time to confirm",
    deadlineLabel: typeof parsed.scheduleWindow.deadlineLabel === "string" ? parsed.scheduleWindow.deadlineLabel.slice(0, 90) : undefined,
  } : null;
  const scheduleWindow = fallback.scheduleWindow?.arrivalTime ? fallback.scheduleWindow : parsedSchedule || fallback.scheduleWindow;
  const preparation = Array.isArray(parsed.preparation) ? parsed.preparation
    .filter((step: unknown) => step && typeof step === "object")
    .slice(0, 6)
    .map((step: { step?: unknown; kind?: unknown; durationMinutes?: unknown; billable?: unknown }) => ({
      step: typeof step.step === "string" ? step.step.slice(0, 180) : "",
      kind: step.kind === "materials" || step.kind === "rental" ? step.kind : "equipment" as const,
      // Bound the duration: an unbounded value would push the derived start
      // time to something nonsensical.
      durationMinutes: Number.isFinite(Number(step.durationMinutes)) ? Math.min(480, Math.max(0, Math.round(Number(step.durationMinutes)))) : 30,
      billable: step.billable === true,
    }))
    .filter((step: { step: string }) => step.step) : [];
  // Arrival is a commitment to the customer. Preparation is scheduled backward
  // from it in code, never left to the model to arrive at by itself.
  const scheduleWithPreparation = derivePreparationStart(scheduleWindow, preparation);
  return enforceSafety({
    category,
    title: typeof parsed.title === "string" ? parsed.title.slice(0, 90) : fallback.title,
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : fallback.summary,
    safetyNote: typeof parsed.safetyNote === "string" ? parsed.safetyNote.slice(0, 400) : fallback.safetyNote,
    questions: Array.isArray(parsed.questions) ? parsed.questions.filter((question: unknown) => question && typeof question === "object").slice(0, 8).map((question: { id?: unknown; label?: unknown; help?: unknown; type?: unknown; options?: unknown; required?: unknown }, index: number) => ({
      id: typeof question.id === "string" ? question.id.replace(/[^a-z0-9_]/gi, "_").slice(0, 48) : `question_${index}`,
      label: typeof question.label === "string" ? question.label.slice(0, 180) : "Additional detail",
      help: typeof question.help === "string" ? question.help.slice(0, 180) : undefined,
      type: question.type === "boolean" || question.type === "choice" ? question.type : "text",
      options: Array.isArray(question.options) ? question.options.filter((option: unknown) => typeof option === "string").slice(0, 5) : undefined,
      required: question.required !== false,
    })) : fallback.questions,
    extractedAnswers: extracted,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((v: unknown) => typeof v === "string").slice(0, 8) : fallback.tasks,
    stops: routeNodes.length ? routeNodes.map((node: { location: string }) => node.location) : Array.isArray(parsed.stops) ? parsed.stops.filter((v: unknown) => typeof v === "string").slice(0, 8) : fallback.stops,
    routeNodes,
    scheduleWindow: scheduleWithPreparation,
    preparation,
    items: Array.isArray(parsed.items) ? parsed.items.filter((v: unknown) => typeof v === "string").slice(0, 8) : fallback.items,
    customerCanHelp,
    equipment: Array.isArray(parsed.equipment) ? parsed.equipment.filter((item: unknown) => item && typeof item === "object").slice(0, 12).map((item: { id?: unknown; name?: unknown; purpose?: unknown; required?: unknown; rentalEstimate?: unknown; supplyType?: unknown }, index: number) => ({
      id: typeof item.id === "string" ? item.id.slice(0, 40) : `equipment_${index}`,
      name: typeof item.name === "string" ? item.name.slice(0, 80) : `Required equipment ${index + 1}`,
      purpose: typeof item.purpose === "string" ? item.purpose.slice(0, 160) : "Required to complete the work order",
      required: item.required !== false,
      rentalEstimate: typeof item.rentalEstimate === "number" ? Math.max(0, Math.min(250, Math.round(item.rentalEstimate))) : 15,
      supplyType: item.supplyType === "consumable" ? "consumable" as const : "reusable" as const,
    })) : fallback.equipment,
    recurrence: parsed.recurrence && typeof parsed.recurrence === "object" ? { recurring: parsed.recurrence.recurring === true, frequency: typeof parsed.recurrence.frequency === "string" ? parsed.recurrence.frequency.slice(0, 80) : fallback.recurrence.frequency } : fallback.recurrence,
    recommendedTeamSize: typeof parsed.recommendedTeamSize === "number" ? Math.max(1, Math.min(4, Math.round(parsed.recommendedTeamSize))) : fallback.recommendedTeamSize,
    skillRequirements: Array.isArray(parsed.skillRequirements) ? parsed.skillRequirements.filter((v: unknown) => typeof v === "string").slice(0, 8) : fallback.skillRequirements,
    executionSteps: Array.isArray(parsed.executionSteps) ? parsed.executionSteps.filter((v: unknown) => typeof v === "string").slice(0, 10) : fallback.executionSteps,
    understoodFacts: Array.isArray(parsed.understoodFacts) ? parsed.understoodFacts.filter((v: unknown) => typeof v === "string").slice(0, 12) : fallback.understoodFacts,
    estimate: parsed.estimate && typeof parsed.estimate === "object" ? { serviceMinutesPerVisit: typeof parsed.estimate.serviceMinutesPerVisit === "number" ? Math.max(15, Math.min(600, Math.round(parsed.estimate.serviceMinutesPerVisit))) : fallback.estimate.serviceMinutesPerVisit, travelMinutes: typeof parsed.estimate.travelMinutes === "number" ? Math.max(0, Math.min(240, Math.round(parsed.estimate.travelMinutes))) : fallback.estimate.travelMinutes, people: typeof parsed.estimate.people === "number" ? Math.max(1, Math.min(4, Math.round(parsed.estimate.people))) : fallback.estimate.people, recurringVisits: typeof parsed.estimate.recurringVisits === "string" ? parsed.estimate.recurringVisits.slice(0, 80) : fallback.estimate.recurringVisits, materialsSummary: typeof parsed.estimate.materialsSummary === "string" ? parsed.estimate.materialsSummary.slice(0, 240) : fallback.estimate.materialsSummary } : fallback.estimate,
    sourceText: fallback.sourceText,
    audit: fallback.audit,
  });
}

function deterministicAudit(analysis: ReturnType<typeof fallbackAnalysis>, pipeline = "RULE-BASED PLANNER → RULES GATE", customerAnswers: Record<string, string | boolean> = {}) {
  const issues: string[] = [...(analysis.audit?.issues || [])];
  if (!analysis.tasks.length) issues.push("No execution tasks were produced");
  if (!analysis.equipment.length && analysis.category !== "elder_support") issues.push("No equipment or materials were identified");
  if (analysis.recommendedTeamSize < 1 || analysis.recommendedTeamSize > 4) issues.push("Team size is outside operating limits");
  const answered = applyCustomerAnswers(augmentWithHouseholdKnowledge(analysis), customerAnswers);
  const normalized = enforceSafety({ ...answered, recommendedTeamSize: Math.max(1, Math.min(4, answered.recommendedTeamSize)) });
  const firstGate = applyDoneeoRulesGate(normalized);
  const finalAnalysis = applyDoneeoRulesGate(enforceSafety(firstGate));
  issues.push(...finalAnalysis.rulesGate!.issues.filter(issue => issue.severity !== "information").map(issue => issue.title));
  return buildJobIntelligence({ ...finalAnalysis, audit: {
    status: analysis.audit?.status || "deterministic" as const,
    issues: Array.from(new Set(issues)),
    checks: Array.from(new Set([...(analysis.audit?.checks || []), "Facts locked", "Questions deduplicated", "Scope preserved", "Locations and access checked", "People and eligibility checked", "Equipment and materials checked", "Safety and licensing checked", "Schedule and capacity checked", "Routing and coordination checked", "Price and protection controlled", "Execution and closeout controlled"])),
    pipeline,
  } });
}

function grokApiKey() {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.Grok;
}

function claudeApiKey() {
  return process.env.ANTHROPIC_API_KEY;
}

const finalCheckPrompt = `You are Doneeo's final quality gate. A job plan has already been drafted and independently validated. You did not write any of it. Your only job is to catch anything the earlier steps missed before this plan reaches a real customer.

Compare the FINAL PLAN against the CUSTOMER'S ORIGINAL WORDS. Check specifically for: any invented driving/vehicle/pickup step for movement that stays inside one property; any recurrence that was never stated; a completion deadline that got swapped in for the arrival/start time or vice versa; any stated customer fact that got dropped, reworded, or reversed (such as origin and destination swapped); regulated work (electrical, gas, plumbing, licensed care) assigned to a general helper; any remaining question whose answer is already in the original request; a route node missing an action the customer described.

Return JSON only as {approved, criticalIssues, notes}. approved is false only if you find at least one issue from the list above that would materially mislead the customer or misassign the work — do not fail the plan over stylistic preferences or minor wording. criticalIssues is a short array of plain-language strings describing only material problems (empty array if none). notes is a short array of minor observations worth a human's attention that do not block approval (empty array if none). Keep every string under 200 characters.`;

function openAIApiKey() {
  return process.env.OPENAI_API_KEY;
}

type FinalCheckResult = { approved: boolean; criticalIssues: string[]; notes: string[] };

function parseFinalCheckJson(text: string): FinalCheckResult {
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  const approved = parsed.approved !== false;
  const criticalIssues = Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues.filter((v: unknown) => typeof v === "string").slice(0, 6).map((v: string) => v.slice(0, 200)) : [];
  const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((v: unknown) => typeof v === "string").slice(0, 6).map((v: string) => v.slice(0, 200)) : [];
  return { approved, criticalIssues, notes };
}

// Every one of the three final-check providers below shares the same shape:
// no key -> null (skipped), any failure -> null (never blocks the customer),
// success -> a plain {approved, criticalIssues, notes} verdict. Keeping them
// symmetric is what makes running them in parallel and merging the results
// straightforward in runIndependentValidation.

async function claudeFinalCheck(userRequest: string, intelligence: ReturnType<typeof buildJobIntelligence>): Promise<FinalCheckResult | null> {
  const apiKey = claudeApiKey();
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
        max_tokens: 1000,
        system: finalCheckPrompt,
        messages: [{ role: "user", content: `CUSTOMER'S ORIGINAL WORDS:\n${userRequest}\n\nFINAL PLAN:\n${JSON.stringify(intelligence)}` }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    const text = data.content?.find(block => block.type === "text")?.text;
    if (!text) return null;
    return parseFinalCheckJson(text);
  } catch {
    return null;
  }
}

function grokText(data: { choices?: Array<{ message?: { content?: unknown } }> }) {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part && typeof part === "object" && "text" in part ? String(part.text || "") : "").join("");
  return "";
}

async function grokFinalCheck(userRequest: string, intelligence: ReturnType<typeof buildJobIntelligence>): Promise<FinalCheckResult | null> {
  const apiKey = grokApiKey();
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-4.5",
        messages: [
          { role: "system", content: finalCheckPrompt },
          { role: "user", content: `CUSTOMER'S ORIGINAL WORDS:\n${userRequest}\n\nFINAL PLAN:\n${JSON.stringify(intelligence)}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 1000,
      }),
    });
    if (!response.ok) return null;
    const text = grokText(await response.json());
    if (!text) return null;
    return parseFinalCheckJson(text);
  } catch {
    return null;
  }
}

async function openAIFinalCheck(userRequest: string, intelligence: ReturnType<typeof buildJobIntelligence>): Promise<FinalCheckResult | null> {
  const apiKey = openAIApiKey();
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          { role: "system", content: finalCheckPrompt },
          { role: "user", content: `CUSTOMER'S ORIGINAL WORDS:\n${userRequest}\n\nFINAL PLAN:\n${JSON.stringify(intelligence)}` },
        ],
        max_output_tokens: 1000,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
      .find((part: { type?: string }) => part.type === "output_text")?.text;
    if (!text) return null;
    return parseFinalCheckJson(text);
  } catch {
    return null;
  }
}

// Runs every configured validator at once — not one after another. Each is
// independent: they all review the same already-gate-checked plan against
// the customer's original words, and none of them rewrites it. If a provider
// has no key, its check is null and simply doesn't count. If any provider
// that DID run flags a real problem, the plan is marked "corrected" so a
// human reviewing it can see something needs a second look; the deterministic
// rules gate upstream is still what actually shapes the plan.
async function runIndependentValidation(userRequest: string, intelligence: ReturnType<typeof buildJobIntelligence>) {
  const [grok, openai, claude] = await Promise.all([
    grokFinalCheck(userRequest, intelligence),
    openAIFinalCheck(userRequest, intelligence),
    claudeFinalCheck(userRequest, intelligence),
  ]);
  const ran: string[] = [];
  const allIssues: string[] = [];
  let anyRejected = false;
  if (grok) { ran.push("GROK"); allIssues.push(...grok.criticalIssues); if (!grok.approved) anyRejected = true; }
  if (openai) { ran.push("OPENAI"); allIssues.push(...openai.criticalIssues); if (!openai.approved) anyRejected = true; }
  if (claude) { ran.push("CLAUDE"); allIssues.push(...claude.criticalIssues); if (!claude.approved) anyRejected = true; }
  if (!ran.length) return intelligence;
  return {
    ...intelligence,
    audit: {
      ...intelligence.audit,
      status: (anyRejected ? "corrected" : intelligence.audit?.status) as typeof intelligence.audit.status,
      issues: Array.from(new Set([...(intelligence.audit?.issues || []), ...allIssues])),
      checks: Array.from(new Set([...(intelligence.audit?.checks || []), `${ran.join(" + ")} final check completed`])),
      pipeline: `${intelligence.audit?.pipeline || ""} → ${ran.join(" + ")} FINAL CHECK`,
    },
    finalChecks: { grok, openai, claude },
  };
}

// Pull the provider's own error text out of a failed response so the reason
// reaches the audit trail instead of a generic "request failed".
async function describeHttpFailure(response: Response) {
  const detail = await response.text().catch(() => "");
  let apiMessage: string | undefined;
  try {
    const parsed = JSON.parse(detail);
    apiMessage = parsed?.error?.message || parsed?.message;
  } catch { /* Non-JSON body; fall back to the status alone. */ }
  return `HTTP ${response.status}${apiMessage ? ` — ${String(apiMessage).slice(0, 160)}` : ""}`;
}

async function analyzeWithGemini(userRequest: string, fallback: ReturnType<typeof fallbackAnalysis>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  // Gemini 3.x thinks by default at HIGH, and thinking tokens are billed
  // against maxOutputTokens. At a low ceiling the reasoning consumes the
  // budget and the JSON comes back truncated mid-string. Give the schema real
  // headroom and cap the reasoning depth. Never send thinkingLevel together
  // with the legacy thinkingBudget — the request is rejected outright.
  const thinkingLevel = process.env.GEMINI_THINKING_LEVEL || "medium";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userRequest }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.1,
        thinkingConfig: { thinkingLevel },
      },
    }),
  });
  if (!response.ok) throw new Error(await describeHttpFailure(response));
  const data = await response.json();
  // A hit ceiling otherwise surfaces as "Unterminated string in JSON", which
  // points at parsing rather than at the actual cause.
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    const thoughts = data.usageMetadata?.thoughtsTokenCount;
    throw new Error(`response hit the token ceiling before the JSON closed${thoughts ? ` (${thoughts} tokens went to thinking)` : ""} — raise maxOutputTokens or lower GEMINI_THINKING_LEVEL`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!text) throw new Error(`returned no analysis${finishReason ? ` (finishReason: ${finishReason})` : ""}`);
  return normalizeAnalysis(text, fallback);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userRequest = typeof body.request === "string" ? body.request.trim().slice(0, 2000) : "";
  if (userRequest.length < 10) return Response.json({ error: "Please describe the job in a little more detail." }, { status: 400 });

  const customerAnswers = body.answers && typeof body.answers === "object"
    ? Object.fromEntries(Object.entries(body.answers).filter(([key, value]) => /^[a-z0-9_]{1,64}$/i.test(key) && (typeof value === "boolean" || (typeof value === "string" && value.trim().length <= 300)))) as Record<string, string | boolean>
    : {};
  const answerLines = Object.entries(customerAnswers).map(([key, value]) => `${key}: ${typeof value === "boolean" ? (value ? "Yes" : "No") : value}`);
  const planningRequest = answerLines.length
    ? `${userRequest}\n\nCUSTOMER ANSWERS COLLECTED AFTER THE ORIGINAL REQUEST:\n${answerLines.join("\n")}\nTreat these as confirmed facts. Do not ask them again. Recalculate the job and ask only the next missing operational details.`
    : userRequest;

  const fallback = fallbackAnalysis(userRequest);

  // Why-not diagnostics. Graceful degradation is correct behaviour, but a
  // fallback that never says why is indistinguishable from a fallback caused
  // by a missing key, a dead model name, or a network failure.
  const architectNotes: string[] = [];
  const noteFailure = (name: string, error: unknown) => {
    architectNotes.push(`${name} unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  };

  // Architect stage: Gemini is the sole drafter. Drafting is deliberately NOT
  // split across model families — a second family drafting the same job would
  // produce a differently-shaped plan for reasons the customer never sees, and
  // the plan's quality would silently depend on which vendor happened to be
  // reachable. When Gemini is unavailable or fails, the deterministic
  // rule-based planner takes over: a narrower plan, but a predictable one.
  // Grok, OpenAI and Claude review the finished plan downstream; they never
  // draft it.
  let analysis: ReturnType<typeof fallbackAnalysis> = fallback;
  let pipeline = "RULE-BASED PLANNER";
  let mode = "safe-fallback";

  if (!process.env.GEMINI_API_KEY) architectNotes.push("Gemini skipped: GEMINI_API_KEY not set");
  try {
    const geminiAnalysis = await analyzeWithGemini(planningRequest, fallback);
    if (geminiAnalysis) { analysis = geminiAnalysis; pipeline = "GEMINI ARCHITECT"; mode = "gemini-architect"; }
  } catch (error) { noteFailure("Gemini", error); }

  // Deterministic rules gate + job intelligence always runs, regardless of
  // which architect drafted the plan. Independent validation (Grok, OpenAI,
  // Claude — whichever have keys configured) always runs once, in parallel,
  // as the last step before the plan is returned.
  const intelligence = deterministicAudit(analysis, `${pipeline} → RULES GATE → JOB INTELLIGENCE`, customerAnswers);
  const finalChecked = await runIndependentValidation(planningRequest, intelligence);
  const withDiagnostics = mode === "safe-fallback" && architectNotes.length
    ? { ...finalChecked, audit: { ...finalChecked.audit, issues: [...(finalChecked.audit?.issues || []), ...architectNotes] } }
    : finalChecked;
  return Response.json({ analysis: withDiagnostics, mode: `${mode}+rules-gate+job-intelligence+independent-validation`, architectNotes });
}
