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

    // Add a system message to ensure proper markdown formatting
    const systemMessage = {
      role: "system",
      content:
        "You are a helpful assistant. Always use proper markdown formatting in your responses. Use **text** for bold, *text* for italic, and use proper markdown list syntax with dashes (-) or asterisks (*) for bullet points, not Unicode bullet characters. Format your responses clearly with proper spacing between paragraphs and lists.",
    };

    const messagesWithSystem = [systemMessage, ...messages];

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1-chat-latest",
      messages: messagesWithSystem,
    });

    const reply = completion.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Error calling OpenAI:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
