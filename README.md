# Lock & Edit

AI가 쓴 글에서 **드래그한 부분만** 고치되, 나머지는 인터페이스가 원본으로 강제 보존하는 에디터.

## 핵심
- 글쓰기·부분 수정은 실제 Claude가 한다 (드래그 구간을 앞뒤 문맥과 함께 보내 자연스럽게 다시 씀).
- 보존은 모델에게 부탁하지 않고 **서버(`lib/lock.ts`)가 강제**한다 — `[선택 앞] + [모델이 다시 쓴 구간] + [선택 뒤]`로 재조립하므로, 선택 밖은 모델 성능과 무관하게 100% 원본 유지.

## 흐름
1. 평범한 챗봇처럼 이메일을 요청 → typewriter로 초안이 써짐
2. 고칠 부분을 **드래그** → 의도 입력 → "이 부분만 수정"
3. 그 구간만 앞뒤와 자연스럽게 바뀌고, 나머지는 보존됨

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev
```

## Vercel 배포
1. GitHub에 푸시 (폴더 구조 그대로)
2. Vercel → New Project → 저장소 선택 (Next.js 자동 감지)
3. Settings → Environment Variables에 `ANTHROPIC_API_KEY` 추가
4. Deploy

> API 키는 서버(app/api/*)에서만 사용되어 브라우저에 노출되지 않습니다.
> 사용량만큼 소액 과금됩니다(이메일 한 건당 수 원 수준).

## 구조
```
app/
  page.tsx              메인 (드래그 수정 + typewriter 로딩)
  layout.tsx
  api/generate/route.ts 초안 생성 (서버)
  api/rewrite/route.ts  선택 구간 수정 + 강제 보존 (서버)
lib/lock.ts             assembleWithLock — 재조립/보존 로직
```
