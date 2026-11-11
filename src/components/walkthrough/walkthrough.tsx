"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { startWalkSession } from "@/lib/server/session-actions";
import { applyUtterance, demoTimeline, emptyWalk, type WalkDraft, type WalkLine, type WalkState } from "@/lib/walkthrough";
import { SampleIllustration } from "../session/sample-photo";
import { buttonClass } from "../ui/button";

/** 브라우저 음성 인식(Chrome의 webkitSpeechRecognition). 타입이 표준 라이브러리에 없어 필요한 만큼만 적는다 */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 한 줄에서 뽑은 낱말(흐름 이름·공정·양)에 형광펜 밑줄을 긋는다(AI가 뽑은 것) */
function Marked({ line }: { line: WalkLine }) {
  if (!line.marks?.length) return <>{line.text}</>;
  const parts: { t: string; m: boolean }[] = [];
  let rest = line.text;
  while (rest) {
    const hits = line.marks.map((mk) => ({ mk, i: rest.indexOf(mk) })).filter((h) => h.i >= 0).sort((a, b) => a.i - b.i);
    if (!hits.length) {
      parts.push({ t: rest, m: false });
      break;
    }
    const { mk, i } = hits[0];
    if (i > 0) parts.push({ t: rest.slice(0, i), m: false });
    parts.push({ t: mk, m: true });
    rest = rest.slice(i + mk.length);
  }
  return (
    <>
      {parts.map((p, i) =>
        p.m ? (
          <mark key={i} className="bg-transparent text-ink underline decoration-marker decoration-[5px] underline-offset-[1px] [text-decoration-skip-ink:none]">
            {p.t}
          </mark>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

function SubmitWalk({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || count === 0} className={buttonClass("primary")}>
      {pending ? "진단 준비 중…" : `흐름 ${count}개로 진단 시작`}
    </button>
  );
}

/**
 * 걸으며 진단. 왼쪽은 지금 보고 있는 현장과 받아쓴 말(뽑은 낱말은 형광펜), 오른쪽은 말에서 만든 흐름 카드.
 * 시연 워크스루는 대본을 한 줄씩 재생하고, 직접 말하기는 브라우저 마이크(지원하지 않으면 글로 입력)로 같은 규칙을 돌린다.
 * 에이전트가 되묻는 말은 소리로도 읽어 준다(끌 수 있음).
 */
export function Walkthrough({ error }: { error?: string }) {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const timeline = useMemo(() => demoTimeline(), []);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [typed, setTyped] = useState(0);
  const [voice, setVoice] = useState(true);
  const [live, setLive] = useState<WalkState>(emptyWalk);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const spokenRef = useRef(0);

  const state: WalkState = mode === "demo" ? (step >= 0 ? timeline[step] : emptyWalk()) : live;
  const lastPerson = [...state.lines].reverse().find((l) => l.who === "person");
  const current = state.drafts.at(-1);

  // 시연 재생: 한 줄을 타자 치듯 보여 준 뒤 다음 줄로 넘어간다
  useEffect(() => {
    if (mode !== "demo" || !playing) return;
    const text = lastPerson?.text ?? "";
    if (step >= 0 && typed < text.length) {
      const t = window.setTimeout(() => setTyped((n) => Math.min(text.length, n + 2)), 28);
      return () => window.clearTimeout(t);
    }
    if (step >= timeline.length - 1) {
      const t = window.setTimeout(() => setPlaying(false), 0);
      return () => window.clearTimeout(t);
    }
    const asked = timeline[Math.max(step, 0)]?.asking;
    const t = window.setTimeout(() => {
      setStep((s) => s + 1);
      setTyped(0);
    }, step < 0 ? 200 : asked ? 2600 : 1200);
    return () => window.clearTimeout(t);
  }, [mode, playing, step, typed, lastPerson?.text, timeline]);

  // 에이전트가 새로 되물으면 소리로 읽는다
  useEffect(() => {
    const agentLines = state.lines.filter((l) => l.who === "agent");
    if (agentLines.length > spokenRef.current) {
      spokenRef.current = agentLines.length;
      if (voice) speak(agentLines.at(-1)!.text);
    }
  }, [state.lines, voice]);

  const play = () => {
    spokenRef.current = 0;
    if (reducedMotion()) {
      setStep(timeline.length - 1);
      setTyped(Number.MAX_SAFE_INTEGER);
      return;
    }
    setStep(-1);
    setTyped(0);
    setPlaying(true);
  };
  const skip = () => {
    setPlaying(false);
    setStep(timeline.length - 1);
    setTyped(Number.MAX_SAFE_INTEGER);
  };

  const say = (text: string) => setLive((s) => applyUtterance(s, text.trim()));
  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setMicError("이 브라우저는 음성 받아쓰기를 지원하지 않습니다. Chrome에서 열거나 아래에 글로 입력해 주세요.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) say(r[0].transcript);
        else partial += r[0].transcript;
      }
      setInterim(partial);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = (e) => setMicError(e.error === "not-allowed" ? "마이크 사용을 허용해 주세요." : `음성 인식 오류: ${e.error}`);
    recRef.current = rec;
    setMicError(null);
    rec.start();
    setListening(true);
  };
  useEffect(() => () => recRef.current?.stop(), []);

  const ready: WalkDraft[] = state.drafts.filter((d) => d.monthlyKg);
  const payload = JSON.stringify(
    ready.map((d) => ({ name: d.name, process: d.process, monthlyKg: d.monthlyKg, kgBasis: d.kgBasis, origin: d.origin, originSource: d.originSource })),
  );
  const shownText = mode === "demo" && lastPerson ? lastPerson.text.slice(0, typed) : (lastPerson?.text ?? "");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md bg-sunken p-[3px]" role="group" aria-label="워크스루 방식">
          {(
            [
              ["demo", "시연 워크스루"],
              ["live", "직접 말하기"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setPlaying(false);
                spokenRef.current = 0;
                recRef.current?.stop();
              }}
              className="h-9 rounded-sm px-3.5 text-[13px] text-muted aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-ink aria-pressed:shadow-[0_1px_0_var(--color-line-strong)]"
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
          되묻는 말을 소리로 읽기
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="walk-field" className="grid content-start gap-4 lg:col-span-7">
          <h2 id="walk-field" className="sr-only">
            현장 화면과 받아쓴 말
          </h2>
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#1c1c1f]">
            {current ? (
              <div className="absolute inset-0">
                <SampleIllustration variant={current.frame} label={current.name} />
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center px-8 text-center text-[15px] text-white/70">
                {mode === "demo" ? "시연 워크스루를 재생하면 녹산 (주)한빛정밀을 한 바퀴 돕니다." : "마이크를 켜고 흐름 앞에서 이름·공정·양을 말해 주세요."}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pt-10 pb-4 text-white">
              <p className="num text-[11.5px] text-white/60">
                {listening ? "● 듣는 중" : playing ? "● 재생 중" : "정지"} · 정지점 {state.drafts.length}곳
              </p>
              <p aria-live="polite" className="mt-1 min-h-[3em] text-[17px] leading-snug font-semibold">
                {interim || shownText || " "}
              </p>
            </div>
          </div>

          {mode === "demo" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={play} disabled={playing} className={buttonClass("secondary")}>
                {playing ? "재생 중…" : step >= 0 ? "처음부터 다시 재생" : "시연 워크스루 재생"}
              </button>
              {playing ? (
                <button type="button" onClick={skip} className={buttonClass("ghost", "sm")}>
                  끝까지 건너뛰기
                </button>
              ) : null}
              <p className="text-[12.5px] text-muted">시연 대본입니다. 실제로는 휴대폰으로 영상을 찍으며 말하면 Azure AI Speech가 받아씁니다.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={toggleMic} className={buttonClass("secondary")}>
                  {listening ? "마이크 끄기" : "마이크 켜고 말하기"}
                </button>
                <button type="button" onClick={() => setLive(emptyWalk())} className={buttonClass("ghost", "sm")}>
                  처음부터
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("utterance") as HTMLInputElement;
                  if (input.value.trim()) say(input.value);
                  input.value = "";
                }}
                className="flex gap-2"
              >
                <input
                  name="utterance"
                  autoComplete="off"
                  aria-label="말 대신 글로 입력"
                  placeholder="말 대신 글로 입력: 예) 사출 2라인 스프루, 하루에 이십 킬로"
                  className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-[14px] placeholder:text-muted focus:border-ink focus:outline-none"
                />
                <button type="submit" className={buttonClass("ghost", "sm", "h-11")}>
                  넣기
                </button>
              </form>
              {micError ? (
                <p role="alert" className="text-[13px] text-loss">
                  {micError}
                </p>
              ) : (
                <p className="text-[12.5px] text-muted">브라우저 음성 인식(Chrome)을 씁니다. 실제 서비스에서는 Azure AI Speech로 받아씁니다.</p>
              )}
            </div>
          )}

          <ol className="grid max-h-[320px] gap-2 overflow-y-auto border-t border-line pt-3" aria-label="받아쓴 말과 되묻기">
            {state.lines.map((l, i) => (
              <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 text-[14px] leading-relaxed">
                <span className={`text-[12px] ${l.who === "agent" ? "font-semibold text-ink" : "text-muted"}`}>
                  <span aria-hidden="true" className={`mr-1.5 inline-block size-2 rounded-full ${l.who === "agent" ? "bg-marker shadow-[0_0_0_1px_var(--color-ink)]" : "bg-ink"}`} />
                  {l.who === "agent" ? "에이전트" : "담당자"}
                </span>
                <span className={l.who === "agent" ? "font-semibold text-warn" : "text-ink"}>
                  {mode === "demo" && l === lastPerson && typed < l.text.length ? l.text.slice(0, typed) : <Marked line={l} />}
                </span>
              </li>
            ))}
            {state.lines.length === 0 ? <li className="text-[13px] text-muted">아직 받아쓴 말이 없습니다.</li> : null}
          </ol>
        </section>

        <section aria-labelledby="walk-cards" className="grid content-start gap-3 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="walk-cards" className="text-h2">
              말에서 만든 흐름
            </h2>
            <span className="num text-[13px] text-muted">{state.drafts.length}개</span>
          </div>
          {state.drafts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-[13.5px] text-muted">흐름 이름이 나오면 카드가 생기고, 공정·양·출처가 차례로 채워집니다.</p>
          ) : (
            <ul className="grid gap-2.5">
              {state.drafts.map((d) => (
                <li key={d.id} className={`grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border px-3 py-3 ${d === current ? "border-ink" : "border-line"}`}>
                  <div className="relative size-14 overflow-hidden rounded-md bg-[#1c1c1f]">
                    <SampleIllustration variant={d.frame} label={d.name} />
                  </div>
                  <div className="min-w-0 text-[13px]">
                    <p className="text-[15px] font-semibold">{d.name}</p>
                    <p className="text-ink-2">{d.process || <span className="text-muted">공정 미확인</span>}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {d.monthlyKg ? (
                        <span>
                          월 <b className="num font-semibold">{d.monthlyKg.toLocaleString("ko-KR")}kg</b>
                          <span className="ml-1 text-[12px] text-muted">{d.kgBasis}</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-marker px-2 text-[12px] font-semibold text-marker-ink">양 되묻는 중</span>
                      )}
                      {d.origin ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2 text-[12px] text-ink-2">
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${d.originSource === "human" ? "bg-ink" : "bg-marker shadow-[0_0_0_1px_var(--color-ink)]"}`} />
                          {d.origin === "PIR" ? "공정 부산물 · PIR" : "사용 후 포장재 · PCR"}
                          <span className="text-muted">{d.originSource === "human" ? "말로 확인" : "추정"}</span>
                        </span>
                      ) : d.film ? (
                        <span className="rounded-full bg-marker px-2 text-[12px] font-semibold text-marker-ink">출처 되묻는 중</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form action={startWalkSession} className="grid gap-2 border-t border-line pt-4">
            <input type="hidden" name="drafts" value={payload} />
            <input type="hidden" name="mode" value={mode} />
            <SubmitWalk count={ready.length} />
            <p className="text-[12.5px] text-muted">
              양을 말한 흐름만 진단에 넣습니다. 말로 확인한 월 발생량은 확정값으로, 말로 확인한 출처는 사람 확인으로 넘어갑니다. 사진은 시연용 일러스트를 씁니다.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-loss">
                {error}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
