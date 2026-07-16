// 강제 보존의 핵심: 모델이 무엇을 반환하든, 사용자가 선택한 구간 밖은
// 원본 그대로 유지한다. 서버가 [before] + [모델이 다시 쓴 구간] + [after]로
// 재조립하므로, 선택 밖 보존은 모델 성능과 무관하게 100% 보장된다.

export function assembleWithLock(
  fullText: string,
  start: number,
  end: number,
  rewrittenFragment: string
): { newText: string; before: string; after: string } {
  const before = fullText.slice(0, start);
  const after = fullText.slice(end);
  const newText = before + rewrittenFragment + after;
  return { newText, before, after };
}
