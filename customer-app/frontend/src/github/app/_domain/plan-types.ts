// Extracted from app/page.tsx — behavior unchanged.

export type PlanKey = "budget" | "recommended" | "complete";
export type Answers = Record<string, string | boolean>;
export type GoogleRoute = { distanceKm: number; trafficMinutes: number; source: string; legs: Array<{ from: string; to: string; distanceKm: number; trafficMinutes: number }> };
export type ServiceAssignment = { title: string; executors: string; tasks: string; handoff: string; arrival: string; departure: string };

export type PlanOption = {
  key: PlanKey;
  name: string;
  badge: string;
  price: number;
  team: string;
  equipment: string;
  inclusions: string[];
  why: string;
  duration: string;
  match: string;
  breakdown: string[];
  provider: string;
  providerRating: string;
  rentalTotal: number;
  equipmentRows: Array<{ name: string; source: "Customer" | "Provider" | "Rental" | "Purchase"; cost: number; availability: string }>;
  teamFormation: Array<{ name: string; role: string; rating: string }>;
  formationType: "Existing team" | "Doneeo assembled team" | "Solo executor";
  strategy: string;
  credential: string;
  rentalLogistics: string;
  rentalMinutes: number;
  fulfillmentLabel: string;
  serviceAssignments: ServiceAssignment[];
};
