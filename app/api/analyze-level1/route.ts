import { NextResponse } from "next/server"
import { analyzeLevel1DataForClustering } from "@/lib/analysis/ai-clustering"
import { OpenAI } from "openai"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Initialize OpenAI client with gpt-3.5-turbo-1106
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      defaultQuery: { model: "gpt-3.5-turbo-1106" },
      defaultHeaders: { "model": "gpt-3.5-turbo-1106" }
    })

    // Run analysis
    const results = await analyzeLevel1DataForClustering(data, openai)

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error in Level 1 analysis:", error)
    return NextResponse.json(
      { error: "Failed to analyze data" },
      { status: 500 }
    )
  }
} 