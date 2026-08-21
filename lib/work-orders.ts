export type WorkOrderPayload = {
  public_reference: string;
  work_case_id: string;
  job_order_id: string;
  requirement_contract_ref: string;
  expected_work_case_version: number;
  correlation_id: string;
  source: "mvp";
  status: "draft";
  request_text: string;
  job_category: "moving" | "installation" | "cleaning" | "elder_support" | "general";
  city: "Montréal";
  pickup_address: string;
  delivery_address: string;
  schedule_text: string;
  access_floor: string;
  has_elevator: boolean;
  customer_has_straps: boolean;
  selected_plan: "budget" | "recommended" | "complete";
  team_size: number;
  vehicle_type: string;
  estimated_duration_min: number;
  route_plan: Record<string, unknown>;
  equipment_plan: Record<string, unknown>;
  pricing: Record<string, unknown>;
  work_steps: string[];
  work_plan: {
    tasks: Array<{ sequence: number; title: string; domain: string; qualification: string; resourceIds: string[]; minimumCrew: number; recommendedCrew: number; likelyMinutes: number; rangeLow: number; rangeHigh: number; completionGate: string; serviceGroup: "transport" | "in_home" | "shared"; assignedRole: string; handoffRequired: boolean }>;
    timeline: Array<{ sequence: number; taskSequence: number | null; title: string; description: string; minutes: number; lowMinutes: number; highMinutes: number; qualification: string; isGate: boolean }>;
    skills: string[];
    domains: string[];
    fulfillment: {
      mode: "single_team" | "coordinated_specialists";
      singleCustomerOrder: true;
      rationale: string;
      groups: Array<{ id: string; title: string; executorRole: string; taskSequences: number[]; vehicleRequired: boolean; handoffAfterTask: number | null }>;
    };
  };
};

export function createWorkOrderReference() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  return `DN-${suffix.padStart(8, "0")}`;
}

export type SavedWorkOrder = {
  ok: true;
  reference: string;
  workCaseId?: string;
  jobOrderId?: string;
  control?: {
    state: string;
    stateVersion: number;
    currentLayerId: string;
  } | null;
};

export async function saveWorkOrder(payload: WorkOrderPayload): Promise<SavedWorkOrder> {
  const response = await fetch("/api/operations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "create_work_order", payload }),
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(problem.error || "We couldn't save this work order. Please try again.");
  }
  return response.json() as Promise<SavedWorkOrder>;
}
