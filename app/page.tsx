"use client";

import { useState, useRef, useEffect } from "react";

const T = {
  bg: "#FAF9F6", surface: "#FFFFFF", sidebar: "#F4F2EC",
  border: "#E6E2DA", ink: "#1A1917", inkSoft: "#6B655C", inkFaint: "#A8A197",
  accent: "#2A2926", accentInk: "#FFFFFF",
  green: "#1E7A4D", greenBg: "#E9F4EE",
  blue: "#2B6CB0", red: "#B23A36",
  sel: "rgba(43,108,176,0.16)",
  r1: 8, r2: 12, r3: 16, s1: 6, s2: 10, s3: 14, s4: 18, s5: 24,
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

type Edit = { id: number; start: number; end: number; prevText: string };
type Convo = { id: number; prompt: string; text: string; edits: Edit[] };

export default function Page() {
  const [stage, setStage] = useState<"ask" | "generating" | "ready">("ask");
  const [request, setRequest] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [convos, setConvos] = useState<Convo[]>([]);      // 저장된 대화들
  const [activeId, setActiveId] = useState<number | null>(null);

  const [text, setText] = useState("");
  const [typed, setTyped] = useState(0);
  const [fullDraft, setFullDraft] = useState("");
  const [edits, setEdits] = useState<Edit[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [intent, setIntent] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const askRef = useRef<HTMLInputElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (stage === "ask" && askRef.current) askRef.current.focus(); }, [stage]);
  useEffect(() => { if (selection && intentRef.current) intentRef.current.focus(); }, [selection]);

  // typewriter
  useEffect(() => {
    if (stage !== "generating" || !fullDraft) return;
    if (typed >= fullDraft.length) {
      const t = setTimeout(() => { setText(fullDraft); setStage("ready"); }, 300);
      return () => clearTimeout(t);
    }
    const id = setTimeout(() => setTyped((n) => Math.min(n + 2, fullDraft.length)), 22);
    return () => clearTimeout(id);
  }, [stage, fullDraft, typed]);

  // 현재 대화 상태를 convos에 저장(활성 대화 갱신)
  useEffect(() => {
    if (activeId == null || stage !== "ready") return;
    setConvos((prev) => prev.map((c) => c.id === activeId ? { ...c, text, edits } : c));
  }, [text, edits, activeId, stage]);

  async function submitRequest() {
    const q = request.trim();
    if (!q) return;
    const id = Date.now();
    setUserMsg(q);
    setActiveId(id);
    setConvos((prev) => [{ id, prompt: q, text: "", edits: [] }, ...prev]);
    setRequest("");
    setError("");
    setTyped(0);
    setFullDraft("");
    setEdits([]);
    setSelection(null);
    setStage("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setFullDraft(data.text);
      setConvos((prev) => prev.map((c) => c.id === id ? { ...c, text: data.text } : c));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다");
      setStage("ready");
      setText("");
    }
  }

  // 최근 대화 클릭 → 복원
  function openConvo(c: Convo) {
    setActiveId(c.id);
    setUserMsg(c.prompt);
    setText(c.text);
    setEdits(c.edits);
    setFullDraft(c.text);
    setTyped(c.text.length);
    setSelection(null);
    setIntent("");
    setError("");
    setStage("ready");
  }

  function handleMouseUp() {
    if (editing || stage !== "ready") return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !bodyRef.current) return;
    const range = sel.getRangeAt(0);
    if (!bodyRef.current.contains(range.commonAncestorContainer)) return;
    const pre = document.createRange();
    pre.selectNodeContents(bodyRef.current);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const selText = sel.toString();
    if (selText.trim().length === 0) return;
    setSelection({ start, end: start + selText.length, text: selText });
  }

  async function runEdit() {
    if (!selection) return;
    setEditing(true);
    setError("");
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullText: text, start: selection.start, end: selection.end, intent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      setText(data.newText);
      setEdits((e) => [...e, { id: Date.now(), start: data.newStart, end: data.newEnd, prevText: data.from }]);
      setSelection(null);
      setIntent("");
      const s = window.getSelection(); if (s) s.removeAllRanges();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setEditing(false);
    }
  }

  function undoLast() {
    const last = edits[edits.length - 1];
    if (!last) return;
    setText(text.slice(0, last.start) + last.prevText + text.slice(last.end));
    setEdits((e) => e.slice(0, -1));
  }

  // 새 대화 → 완전히 첫 화면으로
  function newChat() {
    setStage("ask");
    setActiveId(null);
    setUserMsg(""); setText(""); setFullDraft(""); setTyped(0);
    setEdits([]); setSelection(null); setIntent(""); setError(""); setRequest("");
  }

  function renderBody() {
    // 편집 중인 구간은 로딩 표시
    const parts: React.ReactNode[] = [];
    const sorted = [...edits].sort((a, b) => a.start - b.start);
    let cursor = 0;
    sorted.forEach((e, idx) => {
      if (e.start > cursor) parts.push(<span key={`p${idx}`}>{text.slice(cursor, e.start)}</span>);
      parts.push(
        <span key={`e${idx}`} style={{ color: T.green, textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 3 }}>
          {text.slice(e.start, e.end)}
        </span>
      );
      cursor = e.end;
    });
    if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);

    // 수정 중이면 선택 구간을 로딩 표시로 덮어쓰기
    if (editing && selection) {
      const before = text.slice(0, selection.start);
      const after = text.slice(selection.end);
      return (
        <>
          <span>{before}</span>
          <span style={{ background: T.sel, borderRadius: 4, padding: "1px 6px", display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
            <span style={dot(0)} /><span style={dot(160)} /><span style={dot(320)} />
          </span>
          <span>{after}</span>
        </>
      );
    }
    return edits.length === 0 ? text : parts;
  }

  if (stage === "ask") {
    return (
      <div style={sx.askWrap}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>
          <h1 style={sx.askTitle}>무엇을 도와드릴까요?</h1>
          <div style={sx.askBar}>
            <input ref={askRef} value={request} onChange={(e) => setRequest(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitRequest(); }}
              placeholder="메시지를 입력하세요" style={sx.askInput} />
            <button onClick={submitRequest} style={sx.primaryBtn}>보내기</button>
          </div>
          <div style={{ marginTop: T.s3, display: "flex", gap: T.s2, justifyContent: "center", flexWrap: "wrap" }}>
            {["거래처에 지연 사과 메일 써줘", "회의 일정 조율 메일 써줘"].map((ex) => (
              <button key={ex} onClick={() => setRequest(ex)} style={sx.chip}>{ex}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={sx.appWrap}>
      <style>{css}</style>
      <aside style={sx.sidebar}>
        <button onClick={newChat} style={sx.newChatBtn}><span style={{ fontSize: 15 }}>＋</span> 새 대화</button>
        <div style={sx.recentLabel}>최근</div>
        {convos.map((c) => (
          <button key={c.id} onClick={() => openConvo(c)}
            style={{ ...sx.recentItem, ...(c.id === activeId ? sx.recentActive : {}) }}>
            {c.prompt}
          </button>
        ))}
      </aside>

      <div style={sx.main}>
        <div style={{ width: "100%", maxWidth: 640 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: T.s3 }}>
            {userMsg && <div style={sx.userBubble}>{userMsg}</div>}

            {stage === "generating" && (
              <div style={{ alignSelf: "flex-start", width: "100%" }}>
                <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: T.s1 }}>작성 중…</div>
                <div style={sx.answerBubble}>
                  {fullDraft.slice(0, typed)}
                  <span style={sx.caret} />
                </div>
              </div>
            )}

            {stage === "ready" && text && (
              <div style={{ alignSelf: "flex-start", width: "100%" }}>
                <div ref={bodyRef} onMouseUp={handleMouseUp} style={sx.answerBubble}>{renderBody()}</div>
                {edits.length === 0 ? (
                  <div style={sx.hint}>고치고 싶은 부분을 <b style={{ color: T.ink }}>드래그</b>해서 선택하세요.</div>
                ) : (
                  <div style={sx.guardCard}>
                    <div style={sx.guardRow}>
                      <span style={sx.guardCheck}>✓</span>
                      <span>선택한 <b>{edits.length}곳</b>만 바뀌었고, <b>나머지 전체는 글자 그대로</b> 보존됐어요.</span>
                    </div>
                    <div style={sx.guardSub}>AI가 다시 쓰는 동안에도, 선택 밖은 인터페이스가 원본으로 지킵니다.</div>
                  </div>
                )}
              </div>
            )}

            {error && <div style={sx.errorBox}>{error}</div>}
          </div>

          <div style={sx.inputPanel}>
            {selection ? (
              <>
                <div style={sx.selInfo}>선택한 부분: <span style={sx.selText}>“{trunc(selection.text, 40)}”</span></div>
                <div style={{ display: "flex", gap: T.s2 }}>
                  <input ref={intentRef} value={intent} onChange={(e) => setIntent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runEdit(); }}
                    placeholder="이 부분을 어떻게 바꿀까요? (예: 더 부드럽게)" style={sx.textInput} disabled={editing} />
                  <button onClick={runEdit} disabled={editing} style={editing ? sx.primaryBtnOff : sx.primaryBtn}>
                    {editing ? "고치는 중…" : "이 부분만 수정"}
                  </button>
                </div>
                {!editing && (
                  <button onClick={() => { setSelection(null); const s = window.getSelection(); if (s) s.removeAllRanges(); }}
                    style={sx.cancelLink}>선택 취소</button>
                )}
              </>
            ) : (
              <div style={{ display: "flex", gap: T.s2 }}>
                <input value={request} onChange={(e) => setRequest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitRequest(); }}
                  placeholder="이어서 메시지를 입력하세요" style={sx.textInput} />
                <button onClick={submitRequest} style={sx.primaryBtn}>보내기</button>
              </div>
            )}
          </div>

          {stage === "ready" && edits.length > 0 && !selection && (
            <div style={sx.footer}>
              <button onClick={undoLast} style={sx.undoBtn}>↺ 마지막 수정 취소</button>
              <span style={sx.editCount}>수정 {edits.length}회</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n) + "…" : s; }
function dot(delay: number): React.CSSProperties {
  return { width: 6, height: 6, borderRadius: "50%", background: T.blue, display: "inline-block",
    animation: `leb 1.2s ${delay}ms infinite ease-in-out both` };
}

const css = `
  @keyframes leBlink{50%{opacity:0}}
  @keyframes leb{0%,80%,100%{transform:scale(0.5);opacity:0.4}40%{transform:scale(1);opacity:1}}
  ::selection{background:${T.sel}}
`;

const sx: Record<string, React.CSSProperties> = {
  askWrap: { minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: T.font, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", boxSizing: "border-box" },
  askTitle: { fontSize: 27, fontWeight: 600, margin: "0 0 28px", letterSpacing: "-0.02em" },
  askBar: { display: "flex", gap: T.s2, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r3, padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  askInput: { flex: 1, fontSize: 15, fontFamily: "inherit", color: T.ink, padding: 8, border: "none", outline: "none", background: "transparent" },
  chip: { fontSize: 12.5, color: T.inkSoft, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 20, padding: "6px 13px", cursor: "pointer" },
  appWrap: { minHeight: "100vh", display: "flex", background: T.bg, color: T.ink, fontFamily: T.font },
  sidebar: { width: 240, flexShrink: 0, background: T.sidebar, borderRight: `1px solid ${T.border}`, padding: "16px 12px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 4 },
  newChatBtn: { display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", fontSize: 13.5, fontWeight: 500, color: T.ink, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r1, padding: "9px 12px", cursor: "pointer", marginBottom: 10 },
  recentLabel: { fontSize: 11, color: T.inkFaint, padding: "4px 8px", letterSpacing: "0.03em" },
  recentItem: { display: "block", width: "100%", textAlign: "left", fontSize: 13, color: T.inkSoft, background: "transparent", border: "none", borderRadius: T.r1, padding: "8px 10px", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  recentActive: { color: T.ink, background: T.border },
  main: { flex: 1, display: "flex", justifyContent: "center", padding: "40px 24px", boxSizing: "border-box", overflowY: "auto" },
  userBubble: { alignSelf: "flex-end", maxWidth: "80%", background: T.accent, color: T.accentInk, padding: "11px 15px", borderRadius: "14px 14px 4px 14px", fontSize: 14.5, lineHeight: 1.5 },
  answerBubble: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: `${T.r1}px ${T.r3}px ${T.r3}px ${T.r3}px`, padding: "18px 20px", fontSize: 16, lineHeight: 2.05, color: T.ink, cursor: "text", minHeight: 30 },
  caret: { display: "inline-block", width: 2, height: 18, background: T.accent, marginLeft: 1, verticalAlign: "-3px", animation: "leBlink 1s step-start infinite" },
  hint: { marginTop: T.s2, fontSize: 12.5, color: T.inkFaint, paddingLeft: 4 },
  guardCard: { marginTop: T.s3, background: T.greenBg, borderRadius: T.r2, padding: "12px 15px" },
  guardRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: T.green },
  guardCheck: { width: 18, height: 18, borderRadius: "50%", background: T.green, color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  guardSub: { marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(30,122,77,0.15)", fontSize: 12, color: T.inkSoft, lineHeight: 1.6 },
  inputPanel: { marginTop: T.s5, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r3, padding: "14px 16px" },
  selInfo: { fontSize: 13, color: T.inkSoft, marginBottom: T.s2 },
  selText: { color: T.blue, fontWeight: 500 },
  textInput: { flex: 1, fontSize: 14, fontFamily: "inherit", color: T.ink, padding: "10px 12px", borderRadius: T.r1, border: `1px solid ${T.border}`, outline: "none", background: "transparent" },
  primaryBtn: { fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: T.r1, border: "none", background: T.accent, color: T.accentInk, cursor: "pointer", whiteSpace: "nowrap" },
  primaryBtnOff: { fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: T.r1, border: "none", background: T.inkFaint, color: "#fff", cursor: "default", whiteSpace: "nowrap" },
  cancelLink: { marginTop: 8, background: "transparent", border: "none", color: T.inkFaint, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 },
  errorBox: { alignSelf: "flex-start", background: "#FBEEED", color: T.red, borderRadius: T.r2, padding: "10px 14px", fontSize: 13 },
  footer: { marginTop: T.s3, display: "flex", alignItems: "center", justifyContent: "space-between" },
  undoBtn: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.inkSoft, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r1, padding: "8px 13px", cursor: "pointer" },
  editCount: { fontSize: 12, color: T.inkFaint },
};
