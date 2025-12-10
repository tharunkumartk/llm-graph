import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Add a system message to ensure proper markdown formatting and math support
    const systemMessage = {
      role: "developer",
      content:
        "You are a helpful assistant. Always use proper markdown formatting in your responses. Use **text** for bold, *text* for italic, and use proper markdown list syntax with dashes (-) or asterisks (*) for bullet points. \n\nFor mathematics, you MUST use LaTeX formatting. \n- Use $...$ for inline math.\n- Use $$...$$ for block math.\n- Do not use \\( ... \\) or \\[ ... \\].\n- Avoid using asterisks (*) for multiplication in math blocks; use \\cdot or \\times instead to prevent formatting conflicts.\n\nFormat your responses clearly with proper spacing between paragraphs and lists.",
    };

    const messagesWithSystem = [systemMessage, ...messages];

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1-chat-latest",
      messages: messagesWithSystem,
    });

    const reply = completion.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Error calling OpenAI:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
