import type { TaskIdentity } from "../intelligence-task-identity";
import type { WorkCaseControlState } from "../work-case";
import type { StoredCommand } from "./requirement-contract-store";

export type WorkCaseEvent = {
  streamId: string;
  sequence: number;
  eventType: "WorkCaseReceived" | "WorkCaseArchitecting" | "WorkCaseRequirementReady";
  payload: string;
  correlationId: string;
  causationId: string;
  occurredAt: string;
};

export interface WorkCaseStore {
  get(workCaseId: string): Promise<WorkCaseControlState | null>;
  getRawRequest(workCaseId: string): Promise<string | null>;
  getTasks(workCaseId: string): Promise<TaskIdentity[]>;
  getCommand(commandKey: string): Promise<StoredCommand | null>;
  receiveAtomic(input: { workCase: WorkCaseControlState; rawRequest: string; command: StoredCommand; event: WorkCaseEvent }): Promise<void>;
  saveArchitectureAtomic(input: { previous: WorkCaseControlState; next: WorkCaseControlState; tasks: readonly TaskIdentity[]; command: StoredCommand; event: WorkCaseEvent }): Promise<void>;
  markRequirementReadyAtomic(input: { previous: WorkCaseControlState; next: WorkCaseControlState; command: StoredCommand; event: WorkCaseEvent }): Promise<void>;
}
