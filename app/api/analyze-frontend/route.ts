import { NextResponse } from "next/server"
import { OpenAI } from "openai"
import { analyzeLevel1Data } from "@/lib/analysis/level1-analysis"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Run analysis
    const results = await analyzeLevel1Data(data, openai)

    // Add mock properties for better frontend display
    const extendedResults = {
      ...results,
      summary: "This is a sample summary of the analysis.",
      nextSteps: [
        "First, focus on the identified niche opportunity.",
        "Then, analyze competitor products and pricing strategies.",
        "Finally, develop a unique value proposition."
      ]
    }

    return NextResponse.json(extendedResults)
  } catch (error) {
    console.error("Error in frontend analysis:", error)
    return NextResponse.json(
      { error: "Failed to analyze data" },
      { status: 500 }
    )
  }
} 