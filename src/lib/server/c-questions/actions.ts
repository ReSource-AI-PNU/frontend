"use server";

import path from "node:path";
import { API_BASE_URL } from "@/lib/config";
import { getSessionForCurrentOrg } from "../sessions";
import { createStore } from "./store";
import { createCService } from "./core";
import { createEvidenceComparison } from "./evidence";

const store = createStore(path.join(process.cwd(), ".mock-db"));
async function backend(operation: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}/c/questions/${operation}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    cache: "no-store", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`C backend ${operation} failed (${response.status})`);
  return response.json();
}
const service = createCService(store, backend);
const compareEvidence = createEvidenceComparison(getSessionForCurrentOrg, service, API_BASE_URL);

// Every entry point checks session ownership; the backend never receives browser state as authority.
export async function getCQuestionState(sessionId: string) {
  await getSessionForCurrentOrg(sessionId); return service.get(sessionId);
}
export async function compareCEvidence(sessionId: string) {
  return compareEvidence(sessionId);
}
export async function initializeCQuestionState(sessionId: string, command: unknown, initialInput: unknown) {
  await getSessionForCurrentOrg(sessionId); return service.initialize(sessionId, command, initialInput);
}
export async function selectCQuestions(sessionId: string, command: unknown) {
  await getSessionForCurrentOrg(sessionId); return service.select(sessionId, command);
}
export async function displayCQuestions(sessionId: string, command: unknown) {
  await getSessionForCurrentOrg(sessionId); return service.display(sessionId, command);
}
export async function answerCQuestion(sessionId: string, command: unknown) {
  await getSessionForCurrentOrg(sessionId); return service.answer(sessionId, command);
}
