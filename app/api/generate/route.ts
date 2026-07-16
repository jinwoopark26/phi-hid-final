import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = (await req.json()) as { prompt: string };
    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system:
        "You write short, natural business emails in English (3-4 sentences, one paragraph). " +
        "Return ONLY the email body as plain text. No greeting line, no signature, no quotes, no markdown.",
      messages: [{ role: "user", content: `Write a short email for: "${prompt}"` }],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    if (!text) return NextResponse.json({ error: "empty result" }, { status: 502 });
    return NextResponse.json({ text });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
