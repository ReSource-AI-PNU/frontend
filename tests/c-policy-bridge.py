"""Policy-only test adapter: no FastAPI settings, dotenv, or Azure are loaded."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.agents.pp_questions import (  # noqa: E402
    ReviewState, Selection, evaluate, record_display, resolve_question,
    InputField, FormField, QuantityField, ContaminationField,
)

request = json.load(sys.stdin)
body = request["body"]
state = ReviewState.model_validate(body["state"])
op = request["operation"]
if op == "evaluate":
    result = evaluate(state)
elif op == "select":
    evaluation = evaluate(state)
    selected = [Selection(id=c.id, text=c.text, why=c.why, kind=c.kind, options=c.options) for c in evaluation.candidates[:3]]
    result = {"evaluation": evaluation, "selected": selected, "snapshotId": evaluation.snapshot_id, "source": "rule_fallback"}
elif op == "display":
    state = record_display(state, body["batchId"], tuple(Selection.model_validate(s) for s in body["selected"]), body["snapshotId"])
    result = {"state": state, "evaluation": evaluate(state)}
else:
    question_id = body["questionId"]
    cls = {"quantity": QuantityField, "contamination": ContaminationField, "form": FormField}.get(question_id, InputField)
    answer = cls.model_validate(body["answer"]) if body["answer"] is not None else None
    state = resolve_question(state, body["batchId"], question_id, answer, skip=body["skip"])
    result = {"state": state, "evaluation": evaluate(state)}

def encode(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", by_alias=True)
    raise TypeError(type(value).__name__)

print(json.dumps(result, default=encode, ensure_ascii=False))
