"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { answerCQuestion, compareCEvidence, displayCQuestions, generateCResourceSpec, getCQuestionState, initializeCQuestionState, selectCQuestions } from "@/lib/server/c-questions/actions";
import type { RecordView } from "@/lib/server/c-questions/core";
import type { EvidenceComparison } from "@/lib/server/c-questions/evidence";

type FieldName = "material" | "materialBasis" | "form" | "contamination" | "separation" | "process" | "sorting" | "color" | "tradeStage" | "region" | "quantity";
type Draft = { mode: "unanswered" | "value" | "unknown"; value: string; description: string; amount: string; unit: string; period: string; basis: "measured" | "estimated" | "unknown" };
type Drafts = Record<string, Draft>;
type Pending = { op: "initialize" | "select" | "display" | "answer"; command: Record<string, unknown>; input?: Record<string, unknown> };
type Selection = { id: string; text: string; why: string; kind: string; options: string[] };
type Question = { selection: Selection; revision: number; outcome: "pending" | "answered" | "skipped" };
type Batch = { id: string; questions: Question[] };
const fields: { name: FieldName; label: string; hint?: string }[] = [
  {name:"material",label:"재질"}, {name:"materialBasis",label:"재질 판단 근거"},
  {name:"form",label:"현재 형태",hint:"가공 전: 발생 그대로 · 압축: 부피를 줄인 상태 · 세척·파쇄: 씻거나 잘게 부순 상태 · 펠렛: 알갱이"},
  {name:"contamination",label:"다른 재질·금속 혼입"}, {name:"separation",label:"혼입물 분리·보관"},
  {name:"process",label:"발생 과정"}, {name:"sorting",label:"선별 상태"}, {name:"color",label:"색상"},
  {name:"tradeStage",label:"판매·인도 단계"}, {name:"region",label:"발생 지역"}, {name:"quantity",label:"발생 물량"},
];
const idToName: Record<string, FieldName> = {material:"material",material_basis:"materialBasis",form:"form",contamination:"contamination",separation:"separation",process:"process",sorting:"sorting",color:"color",trade_stage:"tradeStage",region:"region",quantity:"quantity"};
const labelFor = (id: string) => fields.find(f => f.name === (idToName[id] ?? id))?.label ?? id;
const blank = (): Draft => ({mode:"unanswered",value:"",description:"",amount:"",unit:"kg",period:"월",basis:"unknown"});
const inputClass = "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-ink";
const buttonClass = "rounded-md bg-ink px-4 py-2 font-semibold text-on-ink disabled:opacity-50";
const secondary = "rounded-md border border-line-strong px-4 py-2 font-semibold disabled:opacity-50";

function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

function ComparisonDetails({comparisons}: {comparisons: EvidenceComparison["comparisons"]}) {
  if (!comparisons.length) return null;
  const labels = {match: "일치", different: "차이 있음", unconfirmed: "미확인"} as const;
  return <div className="mt-4 grid gap-3">
    {comparisons.map(({evidence, ...findings}) => {
      const items = [["재질", findings.material], ["형태", findings.form], ["지역", findings.region], ["품질", findings.quality], ["거래 단계", findings.tradeStage]] as const;
      const sources = [["조사 기준", evidence.criteria], ["가격표", evidence.priceTable], ["일반 기준", evidence.generalCriteria], ["세부 기준", evidence.detailedCriteria], ["FAQ", evidence.faq]] as const;
      return <details key={evidence.id} className="rounded-md border border-line p-4">
        <summary className="cursor-pointer font-semibold">{evidence.form} · 기준월 {evidence.referenceMonth}</summary>
        <dl className="mt-4 grid gap-3 text-sm">{items.map(([label, finding]) => <div key={label}>
          <dt className="font-semibold">{label} {labels[finding.status]}</dt><dd className="mt-1">{finding.reason}</dd>
        </div>)}</dl>
        <div className="mt-4 text-sm"><h5 className="font-semibold">출처</h5><ul className="mt-2 grid gap-2">
          {sources.map(([label, source]) => {
            const url = safeSourceUrl(source.url);
            return <li key={label}><span className="font-semibold">{label}: </span>{source.document} · PDF {source.pdfPage}쪽 · 인쇄 {source.printedPage}쪽
              {url && <> · <a className="underline" href={url} target="_blank" rel="noopener noreferrer">원문 보기<span className="sr-only"> (새 창)</span></a></>}
            </li>;
          })}
        </ul></div>
      </details>;
    })}
  </div>;
}

function fieldValue(name: FieldName, draft: Draft, revision?: number): Record<string, unknown> {
  const extra = revision === undefined ? {} : {revision};
  if (draft.mode !== "value") return {status: draft.mode, value: null, ...extra};
  if (name === "quantity") {
    const amount = Number(draft.amount);
    if (!draft.amount.trim() || !Number.isFinite(amount) || amount < 0 || !draft.unit.trim() || !draft.period.trim()) throw new Error("물량의 값, 단위, 기간을 확인해 주세요.");
    return {status:"value",value:{amount,unit:draft.unit.trim(),period:draft.period.trim(),basis:draft.basis},...extra};
  }
  if (!draft.value.trim()) throw new Error(`${labelFor(name)} 값을 입력하거나 모름을 선택해 주세요.`);
  if (name === "contamination") return {status:"value",value:draft.value,description:draft.description.trim() || null,...extra};
  return {status:"value",value:draft.value.trim(),...extra};
}

function FieldEditor({name, draft, onChange, initial, selection}: {name:FieldName; draft:Draft; onChange:(d:Draft)=>void; initial?:boolean; selection?:Selection}) {
  const set = (values:Partial<Draft>) => onChange({...draft,...values});
  const options = selection?.options.filter(x => x !== "모름") ?? (name === "form" ? ["가공 전","압축","세척·파쇄","펠렛"] : name === "contamination" ? ["없음으로 파악","있음"] : []);
  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-3 text-sm">
      {initial && <label><input type="radio" checked={draft.mode === "unanswered"} onChange={()=>set({mode:"unanswered"})}/> 미응답</label>}
      <label><input type="radio" checked={draft.mode === "value"} onChange={()=>set({mode:"value"})}/> 입력</label>
      <label><input type="radio" checked={draft.mode === "unknown"} onChange={()=>set({mode:"unknown"})}/> 모름</label>
    </div>
    {draft.mode === "value" && (name === "quantity" ? <div className="grid gap-2 sm:grid-cols-2">
      <label>물량 값<input aria-label="물량 값" type="number" min="0" step="any" className={inputClass} value={draft.amount} onChange={e=>set({amount:e.target.value})}/></label>
      <label>단위<input aria-label="물량 단위" className={inputClass} value={draft.unit} onChange={e=>set({unit:e.target.value})}/></label>
      <label>기간<input aria-label="물량 기간" className={inputClass} value={draft.period} onChange={e=>set({period:e.target.value})}/></label>
      <label>측정 기준<select aria-label="물량 측정 기준" className={inputClass} value={draft.basis} onChange={e=>set({basis:e.target.value as Draft["basis"]})}><option value="unknown">모름</option><option value="measured">측정</option><option value="estimated">추정</option></select></label>
    </div> : options.length ? <><select aria-label={`${labelFor(name)} 값`} className={inputClass} value={draft.value} onChange={e=>set({value:e.target.value})}>
      <option value="">선택하세요</option>{options.map(option=><option key={option} value={name === "contamination" ? (option === "있음" ? "present" : "absent") : option}>{option}</option>)}
    </select>{name === "contamination" && <label>혼입 설명 (선택)<input className={inputClass} value={draft.description} onChange={e=>set({description:e.target.value})}/></label>}</> :
      <input aria-label={`${labelFor(name)} 값`} className={inputClass} value={draft.value} onChange={e=>set({value:e.target.value})}/>) }
  </div>;
}

export function CQuestions({sessionId}:{sessionId:string}) {
  const [view,setView] = useState<RecordView | null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [available,setAvailable] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [pending,setPending] = useState<Pending | null>(null);
  const [review,setReview] = useState(false);
  const [drafts,setDrafts] = useState<Drafts>({material:{...blank(),mode:"value",value:"PP"}});
  const [answers,setAnswers] = useState<Drafts>({});
  const [comparison,setComparison] = useState<EvidenceComparison | null>(null);
  const [comparisonError,setComparisonError] = useState(false);
  const [comparing,setComparing] = useState(false);
  const [resourceSpec,setResourceSpec] = useState<string | null>(null);
  const [resourceSpecError,setResourceSpecError] = useState(false);
  const [generatingSpec,setGeneratingSpec] = useState(false);
  const comparisonInFlight = useRef(false);
  const specInFlight = useRef(false);
  const inFlight = useRef(false);
  const key = `c-ui:${sessionId}`;
  const apply = useCallback((next:RecordView) => setView(current => !current || next.version >= current.version ? next : current),[]);
  const refresh = useCallback(async () => {
    const result = await getCQuestionState(sessionId);
    if (result.ok) apply(result.data);
    else if (result.code !== "not_found") throw new Error(result.message);
    setAvailable(true);
    return result;
  },[sessionId,apply]);
  useEffect(()=>{
    void Promise.resolve().then(() => {
      try { const saved = sessionStorage.getItem(key); if (saved) { const data = JSON.parse(saved); if (data.drafts) setDrafts(data.drafts); if (data.answers) setAnswers(data.answers); if (data.pending) setPending(data.pending); } } catch { setError("임시 입력을 복원하지 못했습니다. 서버 상태를 확인해 주세요."); }
      return refresh();
    }).catch(()=>setError("서버 상태를 불러오지 못했습니다. 백엔드와 저장소를 확인한 뒤 다시 시도해 주세요.")).finally(()=>setLoading(false));
  },[key,refresh]);
  const persist = (d:Drafts,a:Drafts,p:Pending|null) => { try { sessionStorage.setItem(key,JSON.stringify({drafts:d,answers:a,pending:p})); return true; } catch { setError("브라우저 임시 저장에 실패했습니다. 저장을 허용한 뒤 다시 시도해 주세요."); return false; } };
  const saveDraft = (name:string,d:Draft,answer=false) => { if(answer) { const a={...answers,[name]:d}; setAnswers(a); persist(drafts,a,pending); } else { const ds={...drafts,[name]:d}; setDrafts(ds); persist(ds,answers,pending); } };
  const execute = async (request:Pending) => {
    if (inFlight.current) return;
    setError(""); setNotice("");
    if (!persist(drafts,answers,request)) return;
    inFlight.current = true; setBusy(true); setPending(request);
    try {
      const result = request.op === "initialize" ? await initializeCQuestionState(sessionId,request.command,request.input) : request.op === "select" ? await selectCQuestions(sessionId,request.command) : request.op === "display" ? await displayCQuestions(sessionId,request.command) : await answerCQuestion(sessionId,request.command);
      if (!result.ok) {
        if (result.code === "conflict") { await refresh(); setError("다른 탭에서 상태가 변경됐습니다. 최신 상태를 확인하고 입력을 검토해 다시 제출해 주세요. 입력 중인 내용은 보존했습니다."); }
        else setError(`요청을 처리하지 못했습니다: ${result.message}`);
        setPending(null); persist(drafts,answers,null); return;
      }
      apply(result.data);
      await refresh();
      setPending(null); persist(drafts,answers,null); setReview(false);
      setNotice("서버에 저장된 최신 상태를 확인했습니다.");
    } catch {
      setError("요청의 완료 여부를 확인하지 못했습니다. 백엔드와 저장소를 확인한 뒤 같은 요청 재시도를 누르세요. 입력은 유지됩니다.");
    } finally { setBusy(false); inFlight.current = false; }
  };
  const command = (version:number) => ({expectedVersion:version,requestId:crypto.randomUUID()});
  const start = () => { try { const input:Record<string,unknown>={}; for(const f of fields) { const d=drafts[f.name] ?? blank(); if(d.mode !== "unanswered") input[f.name]=fieldValue(f.name,d); } void execute({op:"initialize",command:command(0),input}); } catch(e) {setError(e instanceof Error ? e.message : "입력을 확인해 주세요.");} };
  const answer = (batch:Batch,q:Question,skip:boolean) => { if (!view) return; try { const name=idToName[q.selection.id]; if(!name) throw new Error("지원하지 않는 질문입니다."); const d=answers[q.selection.id] ?? blank(); if(!skip && d.mode === "unanswered") throw new Error("답을 입력하거나 모름을 선택해 주세요."); const cmd:Record<string,unknown>={...command(view.version),batchId:batch.id,questionId:q.selection.id,skip}; if(!skip) cmd.answer=fieldValue(name,d,q.revision); void execute({op:"answer",command:cmd}); } catch(e) {setError(e instanceof Error ? e.message : "답변을 확인해 주세요.");} };
  const compare = async () => {
    if (comparisonInFlight.current) return;
    comparisonInFlight.current = true; setComparing(true); setComparisonError(false); setComparison(null);
    try {
      const result = await compareCEvidence(sessionId);
      if (!result.ok) throw new Error("Comparison unavailable");
      setComparison(result.data);
    } catch { setComparisonError(true); }
    finally { comparisonInFlight.current = false; setComparing(false); }
  };
  const generateSpec = async () => {
    if (specInFlight.current) return;
    specInFlight.current = true; setGeneratingSpec(true); setResourceSpecError(false); setResourceSpec(null);
    try {
      const result = await generateCResourceSpec(sessionId);
      if (!result.ok) throw new Error("Resource spec unavailable");
      setResourceSpec(result.data.markdown);
    } catch { setResourceSpecError(true); }
    finally { specInFlight.current = false; setGeneratingSpec(false); }
  };
  const batches = (view?.state.batches ?? []) as Batch[];
  const status = view?.evaluation.status as string | undefined;
  const unconfirmed = (view?.evaluation.unconfirmed ?? []) as string[];
  return <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-10 sm:px-8">
    <header><p className="text-sm font-semibold text-muted">C 질문 · {sessionId}</p><h1 className="mt-2 text-h1 font-bold">PP 정보 직접 입력</h1><p className="mt-2 text-sm text-ink-2">사진·문서 없이 입력합니다. 확정 후 입력을 수정하는 기능은 아직 제공되지 않습니다.</p></header>
    <p className="rounded-md bg-sunken p-4 text-sm">질문 종료는 사실 검증이나 자원화 적합성 확정이 아닙니다.</p>
    {error && <div role="alert" className="rounded-md border border-loss p-4 text-sm text-loss">{error}</div>}
    {notice && <p role="status" className="text-sm text-gain">{notice}</p>}
    {pending && !busy && <div className="grid gap-2 rounded-md border border-line-strong p-4"><p>이전 요청의 결과가 불확실합니다. 같은 요청을 재시도하면 확정 여부를 복구합니다.</p><button className={secondary} disabled={busy} onClick={()=>void execute(pending)}>같은 요청 재시도</button></div>}
    {loading ? <p role="status">저장된 상태를 불러오는 중…</p> : <>
      <div><button className={secondary} disabled={busy} onClick={()=>{setError(""); void refresh().then(()=>setNotice("최신 상태를 불러왔습니다.")).catch(()=>setError("상태를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요."));}}>최신 상태 새로고침</button></div>
      {!available ? <p>서버 상태를 확인해야 입력을 계속할 수 있습니다.</p> : !view ? <section className="grid gap-5"><h2 className="text-h2 font-semibold">최초 입력</h2><p className="text-sm text-muted">입력하지 않은 항목과 모름은 구분됩니다. 물량은 비워도 진행할 수 있습니다.</p>
        {fields.map(f=><div key={f.name} className="grid gap-2 rounded-md border border-line p-4"><h3 className="font-semibold">{f.label}</h3>{f.hint && <p className="text-sm text-muted">{f.hint}</p>}<fieldset disabled={busy || !!pending} aria-label={f.label}><FieldEditor name={f.name} draft={drafts[f.name] ?? blank()} onChange={d=>saveDraft(f.name,d)} initial/></fieldset></div>)}
        {!review ? <button className={buttonClass} disabled={busy || !!pending} onClick={()=>{try { for(const f of fields) if((drafts[f.name] ?? blank()).mode !== "unanswered") fieldValue(f.name,drafts[f.name]); setError("");setReview(true); } catch(e) {setError(e instanceof Error ? e.message : "입력을 확인해 주세요.");}}}>입력 검토</button> : <div className="grid gap-3 rounded-md border border-line-strong p-4"><h3 className="font-semibold">확정할 입력 확인</h3><ul className="grid gap-1 text-sm">{fields.map(f=>{const d=drafts[f.name] ?? blank(); return <li key={f.name}>{f.label}: {d.mode === "unanswered" ? "미응답" : d.mode === "unknown" ? "모름" : f.name === "quantity" ? `${d.amount} ${d.unit}/${d.period} (${d.basis === "measured" ? "측정" : d.basis === "estimated" ? "추정" : "기준 모름"})` : f.name === "contamination" ? `${d.value === "present" ? "있음" : "없음으로 파악"} ${d.description}` : d.value}</li>;})}</ul><p className="text-sm">확정 후에는 이 화면에서 최초 입력을 수정할 수 없습니다.</p><div className="flex flex-wrap gap-2"><button className={secondary} onClick={()=>setReview(false)}>입력으로 돌아가기</button><button className={buttonClass} disabled={busy || !!pending} onClick={start}>입력 확정</button></div></div>}
      </section> : <section className="grid gap-5"><h2 className="text-h2 font-semibold">질문 진행</h2><p className="text-sm text-muted">확정 상태 버전 {view.version} · 표시된 질문 묶음 {batches.length}/2</p>
        <details className="rounded-md border border-line p-4"><summary className="cursor-pointer font-semibold">확정 입력 및 현재 값 보기</summary><dl className="mt-3 grid gap-1 text-sm">{fields.map(f=>{const field=view.state[f.name]; const v=field?.value; return <div key={f.name}><dt className="inline font-semibold">{f.label}: </dt><dd className="inline">{field?.status === "unanswered" ? "미응답" : field?.status === "unknown" ? "모름" : typeof v === "object" && v ? `${v.amount} ${v.unit}/${v.period} (${v.basis === "measured" ? "측정" : v.basis === "estimated" ? "추정" : "기준 모름"})` : f.name === "contamination" ? `${v === "present" ? "있음" : "없음으로 파악"}${field?.description ? ` · ${field.description}` : ""}` : v ?? "미확인"}</dd></div>;})}</dl></details>
        {view.pendingSelection && <div className="rounded-md border border-line-strong p-4"><p className="font-semibold">표시할 질문이 준비됐습니다.</p><p className="mt-1 text-sm text-muted">표시 확정을 누르면 질문 묶음이 저장됩니다. 새로 생성하지 않습니다.</p><button className={`${buttonClass} mt-3`} disabled={busy || !!pending} onClick={()=>void execute({op:"display",command:{...command(view.version),selectionId:view.pendingSelection!.id,batchId:crypto.randomUUID()}})}>질문 표시 확정</button></div>}
        {batches.map((batch,index)=><section key={batch.id} className="grid gap-3"><h3 className="font-semibold">질문 묶음 {index+1}</h3>{batch.questions.map(q=><article key={q.selection.id} className="grid gap-3 rounded-md border border-line p-4"><div><p className="font-semibold">{q.selection.text}</p><p className="mt-1 text-sm text-muted">{q.selection.why}</p></div>{q.outcome === "pending" ? <><fieldset disabled={busy || !!pending} aria-label={q.selection.text}><FieldEditor name={idToName[q.selection.id]} selection={q.selection} draft={answers[q.selection.id] ?? blank()} onChange={d=>saveDraft(q.selection.id,d,true)}/></fieldset><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy || !!pending} onClick={()=>answer(batch,q,false)}>답변 저장</button><button className={secondary} disabled={busy || !!pending} onClick={()=>answer(batch,q,true)}>건너뛰기</button></div></> : <p className="text-sm text-muted">{q.outcome === "skipped" ? "건너뜀" : view.state[idToName[q.selection.id]]?.status === "unknown" ? "답변: 모름" : "답변 완료"}</p>}</article>)}</section>)}
        {status === "questions" && !view.pendingSelection && <button className={buttonClass} disabled={busy || !!pending} onClick={()=>void execute({op:"select",command:command(view.version)})}>{batches.length ? "다음 질문 생성" : "질문 생성"}</button>}
        {status === "awaiting_answers" && <p className="text-sm">현재 묶음의 모든 질문에 답하거나 건너뛴 뒤 다음 묶음으로 진행합니다.</p>}
        {["complete","limit_reached","unsupported"].includes(status ?? "") && <div className="rounded-md bg-sunken p-4"><h3 className="font-semibold">{status === "complete" ? "질문 완료" : status === "limit_reached" ? "두 묶음 한도 도달" : "PP 지원 범위 밖"}</h3><p className="mt-2 text-sm">{status === "unsupported" ? "현재 질문은 PP를 대상으로 합니다." : "남은 미확인 항목은 추가 확인이 필요합니다."}</p><p className="mt-2 text-sm">미확인 항목: {unconfirmed.length ? unconfirmed.map(labelFor).join(", ") : "없음"}</p>
          {(status === "complete" || status === "limit_reached") && <div className="mt-4 grid justify-items-start gap-2">
            <button className={buttonClass} disabled={comparing} onClick={()=>void compare()}>{comparing ? "비교 중…" : comparisonError ? "다시 시도" : "공식 자료와 비교"}</button>
            {comparison && <section aria-labelledby="comparison-title" className="w-full rounded-md border border-line bg-surface p-4">
              <h4 id="comparison-title" className="font-semibold">공식 자료 비교</h4>
              <p role="status" className="mt-2 text-sm">{comparison.status === "compared" ? "입력 정보와 공식 자료의 조건을 비교했습니다." : comparison.status === "insufficient_information" ? "정보가 부족해 확인하지 못한 항목이 있습니다." : "현재 지원하는 PP 비교 범위 밖입니다."}</p>
              {comparison.limitations.length > 0 && <div className="mt-4 text-sm"><h5 className="font-semibold">비교 시 유의사항</h5><ul className="mt-2 list-disc space-y-1 pl-5">{comparison.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {comparison.followUp.length > 0 && <div className="mt-4 text-sm"><h5 className="font-semibold">추가로 확인할 사항</h5><ul className="mt-2 list-disc space-y-1 pl-5">{comparison.followUp.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              <ComparisonDetails comparisons={comparison.comparisons}/>
            </section>}
            {comparisonError && <p role="alert" className="text-sm text-loss">비교 결과를 불러오지 못했습니다. 다시 시도해 주세요.</p>}
          </div>}
          <div className="mt-4 grid min-w-0 justify-items-start gap-2">
            <button className={buttonClass} disabled={generatingSpec} onClick={()=>void generateSpec()}>{generatingSpec ? "초안 생성 중…" : resourceSpecError ? "초안 생성 다시 시도" : "자원 명세 초안 생성"}</button>
            {resourceSpecError && <p role="alert" className="text-sm text-loss">자원 명세 초안을 생성하지 못했습니다. 다시 시도해 주세요.</p>}
            {resourceSpec !== null && <section className="w-full min-w-0 rounded-md border border-line bg-surface p-4" aria-labelledby="resource-spec-title">
              <h4 id="resource-spec-title" className="font-semibold">자원 명세 초안</h4>
              <pre className="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{resourceSpec}</pre>
            </section>}
          </div>
        </div>}
      </section>}
    </>}
    {busy && <p role="status">요청을 처리하고 있습니다…</p>}
  </div>;
}
