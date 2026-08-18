// Extracted from app/page.tsx — behavior unchanged.
import type { PlannerAnalysis } from "../../lib/planner";
import type { PlanKey } from "./plan-types";

export const EXECUTOR_PORTRAITS: Record<string, string> = {
  "Alex M.": "/brand/team/alex.png",
  "Samir K.": "/brand/team/samir.png",
  "Maya T.": "/brand/team/maya.png",
  "Julie R.": "/brand/team/julie.png",
  "Nadia B.": "/brand/team/nadia.png",
};

export const executorPool = [
  { name: "Nadia B.", expertise: "Residential cleaning", rating: "4.9 ★ · 184 jobs", assets: ["toolkit", "ppe", "transport", "vacuum", "mop", "microfiber"] },
  { name: "Alex M.", expertise: "Moving lead & driver", rating: "4.8 ★ · 126 jobs", assets: ["vehicle", "straps", "blankets"] },
  { name: "Samir K.", expertise: "Heavy-item handling", rating: "4.9 ★ · 97 jobs", assets: ["straps", "dolly", "ppe"] },
  { name: "Julie R.", expertise: "Assembly & wall mounting", rating: "4.9 ★ · 168 jobs", assets: ["drill", "level", "stud_finder"] },
  { name: "Omar T.", expertise: "Licensed plumbing professional", rating: "4.9 ★ · 142 jobs", assets: ["plumbing_tools", "leak_protection", "ppe"] },
  { name: "Sophie L.", expertise: "Licensed electrical professional", rating: "4.9 ★ · 119 jobs", assets: ["electrical_tools", "ladder", "ppe"] },
  { name: "Malik D.", expertise: "Painting & wall mounting", rating: "4.8 ★ · 156 jobs", assets: ["painting_tools", "drill", "stud_finder", "level", "ladder"] },
  { name: "Claire P.", expertise: "Organization & practical support", rating: "4.9 ★ · 203 jobs", assets: ["bins_labels", "transport", "ppe"] },
  { name: "André G.", expertise: "Lawn & garden care", rating: "4.8 ★ · 177 jobs", assets: ["mower", "trimmer", "garden_tools", "ppe"] },
];

export function formExecutorTeam(analysis: PlannerAnalysis, plan: PlanKey) {
  const safetyMinimum = analysis.intelligence?.manpower.minimum || (analysis.category === "moving" && analysis.recommendedTeamSize > 1 ? 2 : 1);
  const baseSize = plan === "budget" ? safetyMinimum : plan === "recommended" ? Math.max(safetyMinimum, Math.min(3, analysis.recommendedTeamSize)) : Math.max(safetyMinimum, Math.min(4, analysis.recommendedTeamSize + (analysis.recommendedTeamSize < 4 ? 1 : 0)));
  const coordinatedSpecialists = analysis.intelligence?.fulfillment.mode === "coordinated_specialists";
  const size = coordinatedSpecialists ? Math.max(baseSize, plan === "complete" ? 4 : 3) : baseSize;
  const domains = analysis.intelligence?.domains?.map(domain => domain.id) || [];
  const drivingTransport = domains.includes("transport_handling") && analysis.routeNodes.length > 1;
  const providerClass = analysis.rulesGate?.providerClass;
  const categoryMatches = domains.includes("plumbing") || providerClass === "licensed_professional" && /plumb|water|drain/i.test(analysis.sourceText) ? [executorPool[4], executorPool[1], executorPool[2], executorPool[3]]
    : domains.includes("electrical") && providerClass === "licensed_professional" ? [executorPool[5], executorPool[3], executorPool[2], executorPool[1]]
    : domains.includes("electrical") ? [executorPool[3], executorPool[7], executorPool[2], executorPool[1]]
    : domains.includes("transport_handling") && domains.includes("appliance_installation") ? [executorPool[1], executorPool[3], executorPool[2], executorPool[4]]
    : domains.includes("transport_handling") && domains.includes("mounting") ? [executorPool[3], executorPool[2], executorPool[6], executorPool[1]]
    : drivingTransport ? [executorPool[1], executorPool[2], executorPool[3], executorPool[0]]
    : domains.includes("transport_handling") ? [executorPool[2], executorPool[7], executorPool[3], executorPool[1]]
    : domains.includes("painting") || domains.includes("mounting") ? [executorPool[6], executorPool[3], executorPool[2], executorPool[1]]
    : domains.includes("yard_garden") ? [executorPool[8], executorPool[2], executorPool[7], executorPool[1]]
    : domains.includes("organization") || domains.includes("elder_support") ? [executorPool[7], executorPool[0], executorPool[2], executorPool[1]]
    : analysis.category === "moving" ? [executorPool[1], executorPool[2], executorPool[3], executorPool[0]]
    : /clean/i.test(`${analysis.title} ${analysis.tasks.join(" ")}`) ? [executorPool[0], executorPool[3], executorPool[2], executorPool[1]]
    : [executorPool[3], executorPool[0], executorPool[2], executorPool[1]];
  const members = categoryMatches.slice(0, size).map((person, index) => ({ name: person.name, role: index === 0 ? `Lead · ${person.expertise}` : `${person.expertise} · Support ${index + 1}`, rating: person.rating, assets: person.assets }));
  return { members, formationType: size === 1 ? "Solo executor" as const : plan === "complete" ? "Existing team" as const : "Doneeo assembled team" as const };
}
