import type { PlannerAnalysis } from "../planner";
import type { RequirementContractApplicationResult } from "./requirement-contract-service";
import { RequirementContractService } from "./requirement-contract-service";
import { buildTaskAcceptanceProjections } from "./requirement-contract-projection";
import { WorkCaseService } from "./work-case-service";

export type IntelligenceControlResult = {
  workCaseId: string;
  jobOrderId: string;
  state: string;
  stateVersion: number;
  requirementReady: boolean;
  requirementContract: RequirementContractApplicationResult | null;
};

/**
 * Application coordinator for the Intelligence -> Requirement Contract boundary.
 * It contains no deep task reasoning: it persists identities/pointers and invokes
 * the Intelligence-owned projection and Requirement Contract services.
 */
export class IntelligenceControlService {
  constructor(
    private readonly workCases: WorkCaseService,
    private readonly requirements: RequirementContractService,
  ) {}

  async acceptAnalysis(input: {
    workCaseId: string;
    expectedWorkCaseVersion: number;
    analysis: PlannerAnalysis;
    confirmedAnswers?: Readonly<Record<string, string | boolean>>;
    correlationId: string;
    commandKey: string;
    now: string;
  }): Promise<IntelligenceControlResult> {
    const intelligence = input.analysis.intelligence;
    if (!intelligence) throw new Error("Job Intelligence is required before control-plane persistence");

    const recorded = await this.workCases.recordArchitecture({
      commandKey: `${input.commandKey}:architecture`,
      workCaseId: input.workCaseId,
      expectedVersion: input.expectedWorkCaseVersion,
      taskCandidates: intelligence.workstreams.map(stream => ({ title: stream.title, domain: stream.domain, ordinal: stream.sequence })),
      confirmedAnswers: input.confirmedAnswers,
      latestAnalysis: input.analysis,
      correlationId: input.correlationId,
      now: input.now,
    });

    const isReady = intelligence.estimate.ready && intelligence.unresolved.length === 0 && input.analysis.rulesGate?.status === "cleared";
    if (!isReady) {
      return {
        workCaseId: recorded.workCase.workCaseId,
        jobOrderId: recorded.workCase.jobOrderId,
        state: recorded.workCase.state,
        stateVersion: recorded.workCase.stateVersion,
        requirementReady: false,
        requirementContract: null,
      };
    }

    const projections = buildTaskAcceptanceProjections(input.analysis, recorded.tasks);
    const requirement = await this.tryPublishOrSupersede({
      jobOrderId: recorded.workCase.jobOrderId,
      content: intelligence,
      taskBlocks: projections,
      correlationId: input.correlationId,
      commandKey: `${input.commandKey}:requirement`,
      now: input.now,
    });

    const ready = await this.workCases.requirementReady({
      commandKey: `${input.commandKey}:ready`,
      workCaseId: recorded.workCase.workCaseId,
      expectedVersion: recorded.workCase.stateVersion,
      requirementContractRef: requirement.reference,
      correlationId: input.correlationId,
      now: input.now,
    });

    return {
      workCaseId: ready.workCase.workCaseId,
      jobOrderId: ready.workCase.jobOrderId,
      state: ready.workCase.state,
      stateVersion: ready.workCase.stateVersion,
      requirementReady: true,
      requirementContract: requirement,
    };
  }

  private async tryPublishOrSupersede(input: {
    jobOrderId: string;
    content: NonNullable<PlannerAnalysis["intelligence"]>;
    taskBlocks: ReturnType<typeof buildTaskAcceptanceProjections>;
    correlationId: string;
    commandKey: string;
    now: string;
  }): Promise<RequirementContractApplicationResult> {
    return this.requirements.publishOrSupersede({
      commandKey: input.commandKey,
      contractId: input.jobOrderId,
      content: input.content,
      correlationId: input.correlationId,
      taskBlocks: input.taskBlocks,
      reason: "controlled Intelligence reanalysis",
      publishedAt: input.now,
    });
  }
}
