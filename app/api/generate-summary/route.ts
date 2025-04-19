import { NextResponse, type NextRequest } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clusters } = body

    if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
      return NextResponse.json({ success: false, message: "No cluster data provided" }, { status: 400 })
    }

    // Prepare the prompt with cluster data
    const clusterDescriptions = clusters
      .map((cluster) => {
        const tagsByCategory = cluster.tags.reduce((acc: Record<string, string[]>, tag: any) => {
          if (!acc[tag.category]) {
            acc[tag.category] = []
          }
          acc[tag.category].push(tag.value)
          return acc
        }, {})

        const tagDescription = Object.entries(tagsByCategory)
          .map(([category, values]) => `${category}: ${values.join(", ")}`)
          .join("; ")

        return `
Cluster: ${cluster.name} (Opportunity Score: ${cluster.opportunityScore})
Description: ${cluster.description}
Top Keywords: ${cluster.keywords.join(", ")}
Tags: ${tagDescription}
      `
      })
      .join("\n\n")

    const prompt = `
You are an expert market analyst specializing in consumer product trends. Based on the following Amazon search behavior data, provide strategic insights and recommendations.

CLUSTER DATA:
${clusterDescriptions}

Please provide:
1. A concise summary of the key trends identified in these clusters
2. An analysis of the highest opportunity areas
3. Specific recommendations for product development and marketing
4. Suggestions for further research or data collection

Format your response with clear sections and bullet points where appropriate.
`

    try {
      // Generate the summary using OpenAI
      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt,
        temperature: 0.7,
        maxTokens: 1000,
      })

      return NextResponse.json({
        success: true,
        message: "Summary generated successfully",
        data: {
          summary: text,
          generatedAt: new Date().toISOString(),
        },
      })
    } catch (aiError) {
      console.error("Error generating summary with AI:", aiError)

      // Return a proper JSON error response
      return NextResponse.json(
        {
          success: false,
          message: "Failed to generate summary with AI",
          error: (aiError as Error).message,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error processing summary request:", error)

    // Return a proper JSON error response
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process summary request",
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
