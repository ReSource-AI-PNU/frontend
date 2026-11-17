/**
 * Esc로 닫는 겹친 패널의 차례. 마지막에 연 패널(맨 위)만 닫는다: 근거 패널이 대화 패널 위에 열려 있으면 Esc 한 번에
 * 근거 패널만 닫히고, 한 번 더 누르면 대화 패널이 닫힌다(✕ 단추와 같다).
 * 네트워크도 React도 부르지 않는다(tests/escape-stack.test.ts). 화면은 src/components/use-escape.ts로 쓴다.
 */
export type EscapeStack = {
  /** 닫는 함수를 맨 위에 올린다. 돌려준 함수를 부르면 내린다(패널이 닫히거나 사라질 때) */
  push: (close: () => void) => () => void;
  /** Esc를 눌렀다: 맨 위 하나만 닫는다. 닫을 것이 있었으면 true */
  escape: () => boolean;
  size: () => number;
};

export function createEscapeStack(): EscapeStack {
  const entries: { id: number; close: () => void }[] = [];
  let next = 0;
  return {
    push(close) {
      const id = ++next;
      entries.push({ id, close });
      return () => {
        const index = entries.findIndex((entry) => entry.id === id);
        if (index !== -1) entries.splice(index, 1);
      };
    },
    escape() {
      const top = entries[entries.length - 1];
      if (!top) return false;
      top.close();
      return true;
    },
    size: () => entries.length,
  };
}
