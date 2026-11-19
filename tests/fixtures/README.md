# 테스트용 진단 뷰

모두 백엔드(`app.v3`, 규칙 정책)가 시연용 가상 데이터로 실제로 낸 응답이다. 손으로 고친 값은 없다. 회사·단가·물량은 가상이다.

| 파일 | 상태 | 받는 법 |
|---|---|---|
| `../../src/lib/v3/fixture-data/view.json` | 승인 전(화면의 예시 데이터) | `node scripts/v3-capture-fixture.mjs` |
| `v3-view-confirmed.json` | 양쪽 승인 뒤 확정. 사람 교정 한 건, 업체가 같은 날 같은 폐기물로 기록한 반입(검수) 두 건 포함(두 번째 건은 120kg → 110kg 정정, 정정 이력 포함) | 위와 같은 스크립트 |
| `v3-view-vendor-confirmed.json` | 같은 진단을 (주)남해열분해가 본 뷰 | 위와 같은 스크립트 |
| `v3-view-declined.json` | 자동 거절: (주)미소환경의 자동 거절 조건에 "PP"를 더하고 돌린 진단 | `node scripts/v3-capture-states.mjs` |
| `v3-view-blocked.json` | 승인 막힘: 합의 뒤 같은 측정일의 측정값을 다른 값으로 다시 올리고 승인을 시도(`blockedCodes`에 `EVIDENCE_CHANGED`, `STREAM_CHANGED`) | 위와 같은 스크립트 |
| `v3-view-terms-changed.json` | 업체 조건 변경으로 승인 막힘: 합의 뒤 (주)새길자원이 PP A등급 매입 단가를 내려 `blockedCodes`가 `VENDOR_TERMS_CHANGED` | 위와 같은 스크립트 |
| `v3-view-renegotiated.json` | 위 진단을 다시 실행해 같은 대화에서 재합의(코드가 쓴 `counter`, 실행 기록의 `reopenedSeq`) | 위와 같은 스크립트 |
| `v3-view-vendor-renegotiated.json` | 재합의한 진단을 (주)새길자원이 본 뷰(판단 그래프에 자기 매입 기준 노드) | 위와 같은 스크립트 |
| `v3-circular.json` | 승인 전 진단의 결과 한 장 `circular`(자원순환 효과)와 폐기물만 떼어 둔 것(2026-11-19) | `node scripts/v3-capture-fixture.mjs`로 받은 `view.json`에서 `streams`와 `result.circular`를 옮김 |
| `eval-latest.json` | 평가 결과 요약(AI 신뢰도 화면 `/trust`가 읽는 모양). 규칙 정책 회귀 시험(dev, test-v1) | 백엔드 `docs/v3/eval/latest.json`(origin/main)을 그대로 복사 |
| `v3-scan.json` | 보관장 3D 스캔 목록(`GET /orgs/org_hanbit/scans`): 진행 중 한 건과 끝난 한 건(더미 다섯, 폐기물 셋 지정, 더미 2는 230 kg 계량, 더미 4는 미지정). 백엔드 work/scan(c431323) devserver와 가짜 재구성 서버(GET마다 한 단계)로 받은 실제 응답(2026-11-20) | 장면 사진 24장을 `POST /intake/scan`으로 올리고 `PUT /orgs/org_hanbit/scans/{id}/piles/{pileId}`로 지정·계량 |
| `v3-scan-unassigned.json` | 같은 스캔을 폐기물 지정 전에 본 뷰(정리안 없음, 까닭 한 줄) | 위와 같음 |
| `v3-scan-excluded.json` | 같은 스캔에서 더미 4를 "더미 아님"으로 뺀 뷰(`PUT …/piles/p4 {"excluded": true}`) | 위와 같음 |
| `v3-view-handoff.json` | 담당자 인계: 배출 기업이 지시문이 든 문서를 올려 대화가 모두 넘어가고 진단이 `idle`·`done`으로 끝남 | 아래 |

## 담당자 인계 뷰

로컬 devserver에는 Prompt Shields가 연결되지 않아 주입을 탐지하지 못한다(`shieldUnavailable`). 이 뷰는 devserver와 같은 서버에
Prompt Shields 대역(문서에 "이전 지시는 무시"가 있으면 `attackDetected`를 돌려주는 가짜 transport)을 꽂아 받았다.
백엔드 `tests/v3/test_service.py`의 `shields(True)`와 같은 방식이고, 실제 Content Safety를 부른 결과가 아니다.

```python
# (backend) PYTHONPATH=. python3 이_파일.py  →  node scripts/v3-capture-states.mjs http://localhost:8001/api/v3
import json
from app.v3 import devserver
from app.v3.intake.shields import PromptShieldsClient

def transport(method, url, headers, body):
    documents = json.loads(body.decode("utf-8"))["documents"]
    analysis = [{"attackDetected": "이전 지시는 무시" in doc} for doc in documents]
    return 200, {}, json.dumps({"documentsAnalysis": analysis}).encode("utf-8")

app = devserver.build_app()
app.shields = PromptShieldsClient("https://shield.invalid", "local-double", transport=transport)
devserver.make_server(app, port=8001).serve_forever()
```
