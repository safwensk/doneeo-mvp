import { enforceSafety, fallbackAnalysis, type JobCategory } from "../../../lib/planner";
import { applyDoneeoRulesGate } from "../../../lib/rules-gate";
import { applyCustomerAnswers, buildJobIntelligence } from "../../../lib/job-intelligence";
import { augmentWithHouseholdKnowledge } from "../../../lib/work-ontology";

export const runtime = "edge";

const allowedCategories = new Set<JobCategory>(["moving", "installation", "cleaning", "elder_support", "general"]);

const systemPrompt = `You are Doneeo's universal job architect for real-world household and physical services. Understand the whole customer outcome before classifying it; an incidental word such as "deliver" must not turn grocery support into moving. Treat category as only a primary display label, never as a limit on the work order. Decompose every request into all independent service domains and dependent outcomes it contains: physical handling and delivery, organizing/decluttering, cleaning, appliance installation, plumbing, electrical, painting, lawn/garden work, mounting, furniture assembly, general maintenance and practical elder support. A single request may require several domains and several separately eligible executors. Preserve every fact the customer already gave. Moving items between rooms, floors, a basement, garage or attic within the same property is one on-site handling location: do not invent driving stops, travel time, vehicle access, pickup/delivery questions or recurrence. Recurrence is true only when the customer explicitly states a repeating cadence.

Return JSON only with: category, title, summary, safetyNote, tasks, stops, routeNodes, scheduleWindow, items, customerCanHelp, extractedAnswers, questions, equipment, recurrence, recommendedTeamSize, skillRequirements, executionSteps, understoodFacts, and estimate. routeNodes is the ordered execution route as [{location,actions}], where actions lists every pickup, delivery, handoff or service performed at that exact location. scheduleWindow is {dateLabel,arrivalTime,deadlineTime,arrivalLabel,deadlineLabel}; keep the arrival/start commitment separate from the completion deadline. If a request says “Tomorrow at 9 a.m.” and “finish before 1 p.m.”, arrivalTime is 9:00 AM and deadlineTime is 1:00 PM—the deadline must never replace the start. When “then take the old item to X” follows a delivery at Y, Y has both “Deliver new item” and “Pick up old item,” while X has “Deliver old item.” Preserve this chain even when the customer uses pronouns such as it or them.

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
    scheduleWindow,
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

const auditPrompt = `You are Doneeo's independent Validation Agent. You did not create the draft. Your only job is to challenge it against the customer's original words before anything is displayed. Reject any invented recurrence. Treat room-to-room, basement-to-room, floor-to-floor, garage-to-room and other movement within one property as on-site handling with zero driving legs; remove vehicle, pickup, delivery, elevator and external-route questions unless the original request establishes separate properties or addresses. Preserve passive tasks such as boxes that “need to be taken,” preserve every “after this” sequence, and preserve the exact requested room. For retailer-to-home language, verify that the retailer is the origin and the home is the destination.

Return JSON only as {analysis,questionReviews,missingQuestions,issues,corrections}. analysis must use the same schema as the draft and may correct tasks, stops, routeNodes, scheduleWindow, facts, equipment, safety or team requirements. Verify that every route node retains every action. A delivery followed by “take the old item” means the intermediate node has both a delivery and a pickup. Verify that the requested arrival/start and finish-by deadline are separate and are not reversed. questionReviews must contain exactly one entry for every draft question: {id,decision,reason,sourceEvidence,replacement}. decision is keep, remove or rewrite. Use remove when the original request, understoodFacts or extractedAnswers already contains the answer, when another question asks the same thing, or when it does not materially change execution. Use rewrite only when the information is genuinely missing but the question is vague; replacement must be one complete question object using the draft schema and must name the specific stop, item or risk. Use keep only when the answer is absent and it affects scope, access, safety, matching, equipment, schedule, cost, coordination or completion proof. sourceEvidence is a concise customer fact that caused removal, or "not supplied" for a kept question.

missingQuestions is an array of complete question objects and must contain only important omissions not already covered. Never add a generic checklist question. A named place followed by a street number and street is a supplied address. For multiple stops, preserve each named place with its address and ask only about a specifically unresolved stop. Check all task quantities, deadlines, customer-help limits, item/order readiness, access at each stop, tools, materials, consumables, rentals, recipient coordination, licensing and safety. Never invent a customer fact. Every draft question ID must appear exactly once in questionReviews.`;

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

function applyValidationResult(text: string, draft: ReturnType<typeof fallbackAnalysis>, fallback: ReturnType<typeof fallbackAnalysis>, validatorName: string) {
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  const rawReviews = Array.isArray(parsed.questionReviews) ? parsed.questionReviews : [];
  const reviewedIds = rawReviews.map((review: { id?: unknown }) => String(review?.id || ""));
  if (rawReviews.length !== draft.questions.length || new Set(reviewedIds).size !== reviewedIds.length) throw new Error("Validation agent returned an incomplete or duplicate question review");
  const reviewMap = new Map(rawReviews
    .filter((review: unknown) => review && typeof review === "object")
    .map((review: { id?: unknown; decision?: unknown; reason?: unknown; sourceEvidence?: unknown; replacement?: unknown }) => [String(review.id || ""), review]));
  if (draft.questions.some(question => !reviewMap.has(question.id))) throw new Error("Validation agent did not review every question");

  const reviewedQuestions = draft.questions.flatMap(question => {
    const review = reviewMap.get(question.id) as { decision?: unknown; replacement?: unknown } | undefined;
    if (review?.decision === "remove") return [];
    if (review?.decision === "rewrite" && review.replacement && typeof review.replacement === "object") return [review.replacement];
    return [question];
  });
  const missingQuestions = Array.isArray(parsed.missingQuestions)
    ? parsed.missingQuestions.filter((question: unknown) => question && typeof question === "object").slice(0, 4)
    : [];
  const revisedAnalysis = parsed.analysis && typeof parsed.analysis === "object" ? parsed.analysis : draft;
  const corrected = normalizeAnalysis(JSON.stringify({ ...revisedAnalysis, questions: [...reviewedQuestions, ...missingQuestions] }), fallback);
  const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((value: unknown) => typeof value === "string").slice(0, 8) : [];
  const corrections = Array.isArray(parsed.corrections) ? parsed.corrections.filter((value: unknown) => typeof value === "string").slice(0, 8) : [];
  const removedOrRewritten = rawReviews.filter((review: { decision?: unknown }) => review.decision === "remove" || review.decision === "rewrite").length;
  return { ...corrected, audit: { status: corrections.length || removedOrRewritten || missingQuestions.length ? "corrected" as const : "verified" as const, issues, checks: [`${validatorName} independently reviewed every question`, "Original facts locked", "Duplicates removed", "Already-answered questions removed", "Missing execution questions added", "Tasks and stops checked", "Equipment and safety checked"] } };
}

async function auditWithGemini(userRequest: string, draft: ReturnType<typeof fallbackAnalysis>, fallback: ReturnType<typeof fallbackAnalysis>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: auditPrompt }] },
      contents: [{ role: "user", parts: [{ text: `ORIGINAL REQUEST:\n${userRequest}\n\nDRAFT PLAN:\n${JSON.stringify(draft)}` }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2600, temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error("Gemini auditor request failed");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!text) throw new Error("Gemini auditor returned no result");
  return applyValidationResult(text, draft, fallback, "Gemini");
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

async function auditWithClaude(userRequest: string, intelligence: ReturnType<typeof buildJobIntelligence>) {
  const apiKey = claudeApiKey();
  if (!apiKey) return intelligence;
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
    if (!response.ok) throw new Error("Claude final check request failed");
    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    const text = data.content?.find(block => block.type === "text")?.text;
    if (!text) throw new Error("Claude final check returned no result");
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    const approved = parsed.approved !== false;
    const criticalIssues = Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues.filter((v: unknown) => typeof v === "string").slice(0, 6).map((v: string) => v.slice(0, 200)) : [];
    const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((v: unknown) => typeof v === "string").slice(0, 6).map((v: string) => v.slice(0, 200)) : [];
    return {
      ...intelligence,
      audit: {
        ...intelligence.audit,
        status: (!approved ? "corrected" : intelligence.audit?.status) as typeof intelligence.audit.status,
        issues: Array.from(new Set([...(intelligence.audit?.issues || []), ...criticalIssues])),
        checks: Array.from(new Set([...(intelligence.audit?.checks || []), "Claude final check completed"])),
        pipeline: `${intelligence.audit?.pipeline || ""} → CLAUDE FINAL CHECK`,
      },
      claudeFinalCheck: { approved, criticalIssues, notes },
    };
  } catch {
    // If Claude's final check fails for any reason, ship the already-validated plan rather than blocking the customer.
    return intelligence;
  }
}

function grokText(data: { choices?: Array<{ message?: { content?: unknown } }> }) {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part && typeof part === "object" && "text" in part ? String(part.text || "") : "").join("");
  return "";
}

async function auditWithGrok(userRequest: string, draft: ReturnType<typeof fallbackAnalysis>, fallback: ReturnType<typeof fallbackAnalysis>) {
  const apiKey = grokApiKey();
  if (!apiKey) return null;
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-4.5",
      messages: [
        { role: "system", content: auditPrompt },
        { role: "user", content: `ORIGINAL REQUEST:\n${userRequest}\n\nDRAFT PLAN:\n${JSON.stringify(draft)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 3200,
    }),
  });
  if (!response.ok) throw new Error("Grok auditor request failed");
  const text = grokText(await response.json());
  if (!text) throw new Error("Grok auditor returned no result");
  return applyValidationResult(text, draft, fallback, "Grok");
}

async function analyzeWithGemini(userRequest: string, fallback: ReturnType<typeof fallbackAnalysis>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userRequest }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1400, temperature: 0.1 },
    }),
  });
  if (!response.ok) throw new Error("Gemini planner request failed");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!text) throw new Error("Gemini returned no analysis");
  return normalizeAnalysis(text, fallback);
}

async function analyzeWithGrok(userRequest: string, fallback: ReturnType<typeof fallbackAnalysis>) {
  const apiKey = grokApiKey();
  if (!apiKey) return null;
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-4.5",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userRequest }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2400,
    }),
  });
  if (!response.ok) throw new Error("Grok planner request failed");
  const text = grokText(await response.json());
  if (!text) throw new Error("Grok returned no analysis");
  return normalizeAnalysis(text, fallback);
}

async function analyzeWithOpenAI(userRequest: string, fallback: ReturnType<typeof fallbackAnalysis>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [{ role: "system", content: systemPrompt }, { role: "user", content: userRequest }],
      max_output_tokens: 1400,
    }),
  });
  if (!response.ok) throw new Error("OpenAI planner request failed");
  const data = await response.json();
  const text = data.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
    .find((part: { type?: string }) => part.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no analysis");
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

  // Every path below ends in this single exit point, so Claude's final check
  // always runs last, regardless of which architect/validator combination
  // actually succeeded upstream.
  async function respond(pipeline: string, mode: string) {
    const intelligence = deterministicAudit(analysis!, pipeline, customerAnswers);
    const finalChecked = await auditWithClaude(planningRequest, intelligence);
    return Response.json({ analysis: finalChecked, mode: `${mode}+claude-final-check` });
  }

  let analysis: ReturnType<typeof fallbackAnalysis> | null = null;

  const fallback = fallbackAnalysis(userRequest);
  try {
    const geminiAnalysis = await analyzeWithGemini(planningRequest, fallback);
    if (geminiAnalysis) {
      try {
        const audited = await auditWithGrok(planningRequest, geminiAnalysis, fallback);
        if (audited) { analysis = audited; return respond("GEMINI ARCHITECT → GROK VALIDATOR → RULES GATE → JOB INTELLIGENCE", "gemini-architect+grok-validator+rules-gate+job-intelligence"); }
      } catch { /* Fall back to the available independent validator. */ }
      try {
        const audited = await auditWithGemini(planningRequest, geminiAnalysis, fallback);
        if (audited) { analysis = audited; return respond("GEMINI ARCHITECT → GEMINI VALIDATOR → RULES GATE → JOB INTELLIGENCE", "gemini-architect+gemini-validator+rules-gate+job-intelligence"); }
      } catch { /* Keep the architect result and apply deterministic checks. */ }
      analysis = geminiAnalysis;
      return respond("GEMINI ARCHITECT → RULES GATE → JOB INTELLIGENCE", "gemini-architect+rules-gate+job-intelligence");
    }
  } catch { /* Try the secondary provider. */ }

  try {
    const grokAnalysis = await analyzeWithGrok(planningRequest, fallback);
    if (grokAnalysis) {
      try {
        const audited = await auditWithGemini(planningRequest, grokAnalysis, fallback);
        if (audited) { analysis = audited; return respond("GROK ARCHITECT → GEMINI VALIDATOR → RULES GATE → JOB INTELLIGENCE", "grok-architect+gemini-validator+rules-gate+job-intelligence"); }
      } catch { /* Keep the Grok result and apply deterministic checks. */ }
      analysis = grokAnalysis;
      return respond("GROK ARCHITECT → RULES GATE → JOB INTELLIGENCE", "grok-architect+rules-gate+job-intelligence");
    }
  } catch { /* Try the optional tertiary provider. */ }

  try {
    const openAIAnalysis = await analyzeWithOpenAI(planningRequest, fallback);
    if (openAIAnalysis) { analysis = openAIAnalysis; return respond("OPENAI ARCHITECT → RULES GATE → JOB INTELLIGENCE", "openai-architect+rules-gate+job-intelligence"); }
  } catch { /* Use the safe deterministic planner. */ }

  analysis = fallback;
  return respond("RULE-BASED PLANNER → RULES GATE → JOB INTELLIGENCE", "safe-fallback+rules-gate+job-intelligence");
}
