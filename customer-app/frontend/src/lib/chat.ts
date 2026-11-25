import { api } from './api';

export interface PlannerQuestion {
  id: string;
  label: string;
  help?: string;
  type: 'text' | 'choice' | 'boolean';
  options?: string[];
}

export interface PlannerAnalysis {
  title: string;
  summary: string;
  understoodFacts: string[];
  tasks: string[];
  executionSteps: string[];
  equipment: Array<{ id: string; name: string; purpose: string }>;
  skillRequirements: string[];
  safetyNote: string;
  recommendedTeamSize: number;
  rulesGate?: { status: string; summary: string };
  intelligence?: {
    estimate: { ready: boolean; rangeLow: number; rangeHigh: number };
    resources: Array<{ id: string; name: string; resolution: string }>;
    workstreams: Array<{ title: string; completionGate: string }>;
  };
}

export interface ChatReply {
  conversationId: string;
  stage: 'CLARIFYING' | 'PLAN_READY' | 'REVIEW_REQUIRED';
  mode: string;
  history: Array<{ side: 'user' | 'agent'; text: string }>;
  nextQuestion: PlannerQuestion | null;
  analysis: PlannerAnalysis;
  control: {
    workCaseId: string;
    jobOrderId: string;
    stateVersion: number;
    requirementReady: boolean;
    requirementContractRef: string;
  };
}

export interface ChatCommand {
  conversationId: string;
  operationId: string;
  message: string;
  questionId?: string;
  answer?: string | boolean;
}

export function sendChat(command: ChatCommand): Promise<ChatReply> {
  return api<ChatReply>('/api/chat', command);
}

export async function latestChat(): Promise<ChatReply | null> {
  return (await api<{ conversation: ChatReply | null }>('/api/chat/latest')).conversation;
}
