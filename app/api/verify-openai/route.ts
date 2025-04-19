import { NextResponse } from "next/server"
import { OpenAI } from "openai"

export async function GET() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Test the connection with a simple completion
    await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [{ role: "user", content: "Test connection" }],
      max_tokens: 5,
    })

    return NextResponse.json({ status: "success" })
  } catch (error) {
    console.error("Error verifying OpenAI connection:", error)
    return NextResponse.json(
      { error: "Failed to connect to OpenAI" },
      { status: 500 }
    )
  }
} 