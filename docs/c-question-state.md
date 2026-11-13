# C 질문 서버 계약 (로컬 시연)

`src/lib/server/c-questions/actions.ts`의 모든 함수는 진단 `sessionId`의 현재 조직 소유를 확인한다. 별도의 `c-questions.json`은 C 상태의 정본이며 기존 규정 질문과 무관하다. UI는 반환된 state를 다시 보내지 않는다. `API_BASE_URL`은 기존 설정을 사용하며 backend #43이 필요하다.

- `initializeCQuestionState(sessionId, {expectedVersion: 0, requestId}, initialInput)`: 최초 입력을 확정한다. initialInput의 키는 `material`, `materialBasis`, `form`, `contamination`, `separation`, `process`, `sorting`, `color`, `tradeStage`, `region`, `quantity`이다. 생략은 미응답이다. 일반 필드는 `{status: "value", value: 문자열}` 또는 `{status: "unknown"}`/`{status: "unanswered"}`이다. 형태 값은 가공 전·압축·세척·파쇄·펠렛이며 `value: "모름"`도 값 없는 unknown으로 변환한다. 혼입 값은 `present`/`absent`, 선택적 `description`; 물량 값은 `{amount, unit, period, basis}`이며 basis는 measured/estimated/unknown이다. backend evaluate로 최종 검증한다.
- `getCQuestionState(sessionId)`는 최신 확정 상태를 조회한다.
- `selectCQuestions(sessionId, {expectedVersion, requestId})`는 질문을 생성해 대기 선택으로 저장한다. 표시 횟수를 소비하지 않는다. 대기 답변 또는 대기 선택이 있으면 새 선택을 거부한다.
- `displayCQuestions(sessionId, {expectedVersion, requestId, selectionId, batchId})`는 서버가 저장한 선택을 표시용으로 확정한다. 브라우저 렌더링 자체의 증명은 아니다.
- `answerCQuestion(sessionId, {expectedVersion, requestId, batchId, questionId, answer?, skip})`는 backend #43의 필드별 답변 객체를 받는다. skip과 answer는 배타적이다. `unknown`은 `value: null`로 보낸다. backend가 revision과 필드 형식을 검증한다.

성공은 `{ok: true, data: {version, state, evaluation, pendingSelection}}`, 충돌은 `{ok: false, code: "conflict", message, latest?}`다. 없는 상태는 `not_found`, 답변/skip 조합 오류는 `invalid`다. 스키마 검증 및 backend 오류/30초 timeout/파일 오류는 예외로 실패한다. 충돌 시 최신 상태를 조회해 사용자의 의도를 확인하고 새 버전과 새 요청 ID를 쓴다. 응답이 유실되면 **같은 요청 ID와 같은 내용**으로 재전송한다.

각 세션에서 요청 ID는 모든 변경 작업에 걸쳐 유일해야 한다. 작업 종류와 정규화된 본문(기대 버전 포함, 요청 ID 제외)의 키를 정렬해 JSON으로 직렬화한 뒤 SHA-256으로 기록한다. 같은 ID의 기록을 버전 검사보다 먼저 확인하여 같은 해시면 최초 확정 응답을 반환하고 다른 해시면 충돌시킨다. 기록은 세션 수명 동안 보존한다. select는 같은 ID의 동시 호출을 프로세스 안에서 합친다. 모델 호출 중 잠금을 풀고 저장 시 버전을 다시 검사한다. 프로세스 종료 후 모델 외부 호출의 정확히 한 번 실행은 보장하지 않는다.

파일 전체를 임시 파일에 쓴 다음 rename한다. 파일이 없는 경우만 빈 저장소로 취급하며 손상과 권한 오류는 실패한다. 상태와 요청 기록은 같은 파일 교체에 포함된다. 단일 장기 실행 프로세스와 영속 로컬 디스크에 한정한다. 다중 프로세스·서버리스, 여러 파일 트랜잭션, 전원 장애 내구성은 보장하지 않는다. 파일 실패나 backend 실패는 성공 응답을 만들지 않는다.

테스트: Node 22.18 이상에서 `npm run test:c-questions`. 동시성 테스트는 backend 응답을 모의한다. 인접한 backend의 `.venv`가 있으면 같은 명령이 Azure 없이 실제 정책 함수와도 통합 검증하며, 없으면 해당 테스트를 건너뛴다. 질문 ID는 `material_basis`, `trade_stage`처럼 backend의 snake_case 식별자를 사용한다.
