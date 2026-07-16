import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { assembleWithLock } from "@/lib/lock";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { fullText, start, end, intent } = (await req.json()) as {
      fullText: string;
      start: number;
      end: number;
      intent: string;
    };

    if (typeof fullText !== "string" || typeof start !== "number" || typeof end !== "number" || start >= end) {
      return NextResponse.json({ error: "invalid selection" }, { status: 400 });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
    }

    const before = fullText.slice(0, start);
    const selected = fullText.slice(start, end);
    const after = fullText.slice(end);
    const userIntent = (intent || "improve the wording").trim();

    const client = new Anthropic({ apiKey });

    // 앞뒤 문맥을 함께 주되, '선택 구간만' 다시 쓰게 한다.
    // 모델이 앞뒤를 고려해 자연스럽게 이어지는 대체 구간을 생성하도록 유도.
    const system =
      "You revise ONLY the selected span of an email so it reads naturally with the surrounding text. " +
      "You are given BEFORE, SELECTED, and AFTER. Rewrite SELECTED to satisfy the user's intent while " +
      "flowing smoothly into BEFORE and AFTER (match tense, punctuation, spacing, capitalization). " +
      "Return ONLY the replacement text for SELECTED — no quotes, no explanation, no BEFORE/AFTER.";

    const prompt =
      `BEFORE: ${JSON.stringify(before)}\n` +
      `SELECTED: ${JSON.stringify(selected)}\n` +
      `AFTER: ${JSON.stringify(after)}\n\n` +
      `Intent: ${userIntent}\n\n` +
      `Return only the new text that replaces SELECTED, keeping it grammatical with BEFORE and AFTER.`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    let fragment = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    // 모델이 따옴표로 감싸 반환하면 벗기기
    fragment = fragment.replace(/^["'"']|["'"']$/g, "").trim();
    if (!fragment) fragment = selected; // 폴백: 원본 유지

    // ★ 선택 밖은 서버가 강제로 원본 유지하며 재조립
    const { newText } = assembleWithLock(fullText, start, end, fragment);

    return NextResponse.json({
      newText,
      newStart: start,
      newEnd: start + fragment.length,
      from: selected,
      to: fragment,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
