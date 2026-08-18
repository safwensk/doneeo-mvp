import type { RequirementContract, TaskBlockLifecycleIdentity } from "../requirement-contract";

export type StoredCommand = {
  commandKey: string;
  commandType: string;
  requestHash: string;
  status: "SUCCEEDED" | "FAILED";
  result: string | null;
  correlationId: string;
};

export type RequirementContractEvent = {
  streamId: string;
  sequence: number;
  eventType: "RequirementContractPublished" | "RequirementContractSuperseded";
  payload: string;
  correlationId: string;
  causationId: string;
  occurredAt: string;
};

export type AtomicPublishWrite = {
  contract: RequirementContract;
  lifecycle: readonly TaskBlockLifecycleIdentity[];
  command: StoredCommand;
  event: RequirementContractEvent;
};

export type AtomicSupersedeWrite = {
  previous: RequirementContract;
  next: RequirementContract;
  lifecycle: readonly TaskBlockLifecycleIdentity[];
  command: StoredCommand;
  event: RequirementContractEvent;
};

/** Persistence port. Implementations MUST make each write method atomic. */
export interface RequirementContractStore {
  getCurrent(contractId: string): Promise<RequirementContract | null>;
  getVersion(contractId: string, version: number): Promise<RequirementContract | null>;
  getLifecycle(contractId: string, version: number): Promise<TaskBlockLifecycleIdentity[]>;
  getCommand(commandKey: string): Promise<StoredCommand | null>;
  publishAtomic(write: AtomicPublishWrite): Promise<void>;
  supersedeAtomic(write: AtomicSupersedeWrite): Promise<void>;
}
