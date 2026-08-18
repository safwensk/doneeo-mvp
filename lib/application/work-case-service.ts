import { reconcileTaskIdentities, type TaskIdentityCandidate } from "../intelligence-task-identity";
import { beginArchitecting, createWorkCase, markRequirementReady, type WorkCaseControlState } from "../work-case";
import { sha256Stable } from "./requirement-contract-hashing";
import type { StoredCommand } from "./requirement-contract-store";
import type { WorkCaseStore } from "./work-case-store";

export type WorkCaseIds = { workCaseId: string; jobOrderId: string };

export class WorkCaseService {
  constructor(
    private readonly store: WorkCaseStore,
    private readonly ids: { newWorkCaseId(): string; newJobOrderId(): string; newTaskId(): string },
  ) {}

  async receiveRequest(input: { commandKey: string; rawRequest: string; correlationId: string; now: string }): Promise<{ workCase: WorkCaseControlState; replayed: boolean }> {
    if (input.rawRequest.trim().length < 10) throw new Error("raw request is too short");
    const requestHash = await sha256Stable({ type: "ReceiveWorkCase", rawRequest: input.rawRequest, correlationId: input.correlationId });
    const replay = await this.replay(input.commandKey, requestHash);
    if (replay) return { workCase: replay, replayed: true };

    const workCase = createWorkCase({ workCaseId: this.ids.newWorkCaseId(), jobOrderId: this.ids.newJobOrderId(), now: input.now });
    const command = succeeded(input.commandKey, "ReceiveWorkCase", requestHash, input.correlationId, JSON.stringify({ workCaseId: workCase.workCaseId }));
    try {
      await this.store.receiveAtomic({
        workCase,
        rawRequest: input.rawRequest,
        command,
        event: { streamId: stream(workCase.workCaseId), sequence: workCase.stateVersion, eventType: "WorkCaseReceived", payload: JSON.stringify({ jobOrderId: workCase.jobOrderId }), correlationId: input.correlationId, causationId: input.commandKey, occurredAt: input.now },
      });
    } catch (error) {
      const afterRace = await this.replay(input.commandKey, requestHash);
      if (afterRace) return { workCase: afterRace, replayed: true };
      throw error;
    }
    return { workCase, replayed: false };
  }

  async recordArchitecture(input: { commandKey: string; workCaseId: string; expectedVersion: number; taskCandidates: readonly TaskIdentityCandidate[]; confirmedAnswers?: Readonly<Record<string, string | boolean>>; latestAnalysis?: unknown; correlationId: string; now: string }): Promise<{ workCase: WorkCaseControlState; tasks: ReturnType<typeof reconcileTaskIdentities>; replayed: boolean }> {
    const current = await requiredWorkCase(this.store, input.workCaseId);
    const requestHash = await sha256Stable({ type: "RecordArchitecture", workCaseId: input.workCaseId, expectedVersion: input.expectedVersion, taskCandidates: input.taskCandidates, confirmedAnswers: input.confirmedAnswers ?? {}, correlationId: input.correlationId });
    const replay = await this.replay(input.commandKey, requestHash);
    if (replay) return { workCase: replay, tasks: await this.store.getTasks(input.workCaseId), replayed: true };

    const previousTasks = await this.store.getTasks(input.workCaseId);
    const tasks = reconcileTaskIdentities(previousTasks, input.taskCandidates, () => this.ids.newTaskId());
    const next = beginArchitecting(current, { expectedVersion: input.expectedVersion, now: input.now });
    const command = succeeded(input.commandKey, "RecordArchitecture", requestHash, input.correlationId, JSON.stringify({ workCaseId: next.workCaseId, stateVersion: next.stateVersion }));
    await this.store.saveArchitectureAtomic({
      previous: current,
      next,
      tasks,
      confirmedAnswers: input.confirmedAnswers,
      latestAnalysis: input.latestAnalysis,
      command,
      event: { streamId: stream(next.workCaseId), sequence: next.stateVersion, eventType: "WorkCaseArchitecting", payload: JSON.stringify({ activeTaskIds: tasks.filter(task => task.status === "ACTIVE").map(task => task.taskId) }), correlationId: input.correlationId, causationId: input.commandKey, occurredAt: input.now },
    });
    return { workCase: next, tasks, replayed: false };
  }

  async requirementReady(input: { commandKey: string; workCaseId: string; expectedVersion: number; requirementContractRef: string; correlationId: string; now: string }): Promise<{ workCase: WorkCaseControlState; replayed: boolean }> {
    const current = await requiredWorkCase(this.store, input.workCaseId);
    const requestHash = await sha256Stable({ type: "MarkRequirementReady", workCaseId: input.workCaseId, expectedVersion: input.expectedVersion, requirementContractRef: input.requirementContractRef, correlationId: input.correlationId });
    const replay = await this.replay(input.commandKey, requestHash);
    if (replay) return { workCase: replay, replayed: true };
    const next = markRequirementReady(current, { expectedVersion: input.expectedVersion, requirementContractRef: input.requirementContractRef, now: input.now });
    const command = succeeded(input.commandKey, "MarkRequirementReady", requestHash, input.correlationId, JSON.stringify({ workCaseId: next.workCaseId, stateVersion: next.stateVersion }));
    await this.store.markRequirementReadyAtomic({
      previous: current,
      next,
      command,
      event: { streamId: stream(next.workCaseId), sequence: next.stateVersion, eventType: "WorkCaseRequirementReady", payload: JSON.stringify({ requirementContractRef: input.requirementContractRef }), correlationId: input.correlationId, causationId: input.commandKey, occurredAt: input.now },
    });
    return { workCase: next, replayed: false };
  }

  private async replay(commandKey: string, requestHash: string): Promise<WorkCaseControlState | null> {
    const prior = await this.store.getCommand(commandKey);
    if (!prior) return null;
    if (prior.requestHash !== requestHash) throw new Error(`idempotency key ${commandKey} reused with different WorkCase input`);
    if (!prior.result) return null;
    const result = JSON.parse(prior.result) as { workCaseId?: string };
    return result.workCaseId ? this.store.get(result.workCaseId) : null;
  }
}

async function requiredWorkCase(store: WorkCaseStore, workCaseId: string) {
  const workCase = await store.get(workCaseId);
  if (!workCase) throw new Error(`WorkCase not found: ${workCaseId}`);
  return workCase;
}
function succeeded(commandKey: string, commandType: string, requestHash: string, correlationId: string, result: string): StoredCommand {
  return { commandKey, commandType, requestHash, status: "SUCCEEDED", result, correlationId };
}
function stream(workCaseId: string) { return `work-case:${workCaseId}`; }
