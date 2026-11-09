"use server";

import { answerQuestion, goToStep } from "@/lib/server/session-actions";

/**
 * 규정 검토 되묻기(성분분석표 유무)에 답한다.
 * answerQuestion은 규정 결과를 비우므로, 곧바로 goToStep으로 다시 계산하고 같은 화면으로 돌아온다.
 */
export async function answerRegulationQuestion(sessionId: string, questionId: string, formData: FormData) {
  await answerQuestion(sessionId, questionId, formData);
  await goToStep(sessionId, "regulation");
}
