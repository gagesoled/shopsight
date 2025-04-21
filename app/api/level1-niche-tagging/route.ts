import { NextResponse } from "next/server"
import { OpenAI } from "openai"

interface NicheData {
  name: string
  searchTerms: string[]
  searchVolume: number
  growth: number
}

/**
 * API endpoint for analyzing Level 1 niche data with OpenAI
 * Identifies semantic relationships and assigns intent tags
 */
export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    // Format the data for analysis
    const formattedData = data.map((item: any) => ({
      name: item.customerNeed,
      searchTerms: item.topSearchTerms || [],
      searchVolume: item.metrics?.searchVolume || 0,
      growth: item.metrics?.searchVolumeGrowth || 0
    }))
    
    // Calculate niche relationships and tags
    const analysisResults = await analyzeNicheRelationships(formattedData, openai)
    
    return NextResponse.json(analysisResults)
  } catch (error) {
    console.error("Error in Level 1 niche analysis:", error)
    return NextResponse.json(
      { error: "Failed to analyze niche relationships" },
      { status: 500 }
    )
  }
}

/**
 * Uses OpenAI to analyze semantic relationships between niches
 * and identify market themes/patterns
 */
async function analyzeNicheRelationships(niches: NicheData[], openai: OpenAI) {
  // Format the data as a simple text representation for the prompt
  const nicheText = niches.map(niche => 
    `${niche.name}: ${niche.searchTerms.join(", ")} (Volume: ${niche.searchVolume.toLocaleString()}, Growth: ${(niche.growth * 100).toFixed(1)}%)`
  ).join("\n")
  
  const prompt = `Analyze these market niches and their search terms to:
1. Identify semantic relationships between different niches
2. Group related niches into logical market themes
3. Assign 1-3 intent tags to each niche
4. Identify if certain niches are actually variations of the same market

Here are the niches and their search terms:
${nicheText}

Your analysis should identify:
- Parent themes that connect multiple niches
- Consumer intent behind each niche (e.g., Health, Convenience, Seasonal)
- Whether some niches represent format variations rather than distinct markets
- Broader market trends that emerge from the data

Format your response as a JSON object with these sections:
{
  "marketThemes": [
    {
      "name": "Theme name",
      "description": "Brief description of the theme",
      "relatedNiches": ["niche1", "niche2"]
    }
  ],
  "nicheTags": {
    "nicheName": ["tag1", "tag2"]
  },
  "marketTrends": [
    {
      "trend": "Trend name",
      "evidence": "Evidence for this trend",
      "impact": "High|Medium|Low"
    }
  ]
}`

  // Call OpenAI for analysis
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are a market analysis expert skilled at identifying semantic relationships between different product niches and consumer search behaviors."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" }
  })

  // Parse and return the JSON response
  try {
    return JSON.parse(completion.choices[0].message.content || '{}')
  } catch (error) {
    console.error("Error parsing OpenAI response:", error)
    return {
      marketThemes: [],
      nicheTags: {},
      marketTrends: []
    }
  }
} 