import type { EvidenceDetail, Question, Result } from './types';

export type ScenarioOptions = { streamId: string; monthlyKg: number; maxPickupsPerMonth: number | null };
export type ScenarioPreview = {
  token: string; options: ScenarioOptions; result: Result | null; questions: Question[];
  excluded: { vendorOrgId: string; reason: string }[];
  evidence: Record<string, EvidenceDetail>; basis: string;
};
export type AdaptiveState = { change: {
  sessionId: string; sourceSessionId: string; reason: string;
  state: 'queued' | 'running' | 'ready' | 'needs_input' | 'failed'; status: string;
  before: Result | null; after: Result | null;
} | null };
