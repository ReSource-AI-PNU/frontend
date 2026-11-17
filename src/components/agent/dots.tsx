/** AI가 일하는 동안 깜박이는 점 세 개(rs-dot). 움직임을 줄이는 설정이면 점만 남는다(globals.css) */
export function Dots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex shrink-0 items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="size-1.5 rounded-full bg-ink [animation:rs-dot_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}
