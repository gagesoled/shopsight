import { NextResponse, type NextRequest } from "next/server"
import { parseLevel2Data } from "@/lib/parsers/unified-parser"
import { runAIClustering, type AICluster } from "@/lib/analysis/ai-clustering"
import { OpenAI } from "openai"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    console.log(`Processing Level 2 file: ${file.name} (${file.type}, ${file.size} bytes)`)

    // Parse and validate the file
    const { searchTerms, nicheInsights, products, headerInfo, sheetNames, metadata } = await parseLevel2Data(file)

    console.log(`Parsing results: ${searchTerms.data.length} search terms, ${products.data.length} products`)

    // Check if we have any valid data
    if (searchTerms.data.length === 0 && nicheInsights.data.length === 0 && products.data.length === 0) {
      console.log("No valid data found in file")
      return NextResponse.json(
        {
          success: false,
          message: "No valid data found in file",
          headerInfo,
          sheetNames,
        },
        { status: 400 },
      )
    }

    // Collect all errors
    const allErrors = [...searchTerms.errors, ...nicheInsights.errors, ...products.errors]

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Run AI-powered clustering on search terms data
    let clusters: AICluster[] = []
    if (searchTerms.data.length > 0) {
      try {
        clusters = await runAIClustering(searchTerms.data, openai)
        console.log(`Generated ${clusters.length} clusters from ${searchTerms.data.length} search terms`)
        
        // Validate clusters
        if (clusters.length === 0) {
          console.warn("No clusters generated from search terms")
        } else {
          // Log cluster statistics
          const avgClusterSize = clusters.reduce((sum, cluster) => sum + cluster.terms.length, 0) / clusters.length
          console.log(`Average cluster size: ${avgClusterSize.toFixed(2)} terms`)
          
          // Check for potential issues
          const smallClusters = clusters.filter(c => c.terms.length < 3)
          if (smallClusters.length > 0) {
            console.warn(`Found ${smallClusters.length} clusters with less than 3 terms`)
          }
        }
      } catch (error) {
        console.error("Error during clustering:", error)
        // Continue with empty clusters rather than failing the entire request
        clusters = []
      }
    }

    const trendClusters = clusters.map((c) => {
      // Use the AI-generated title directly (now declared on AICluster)
      const rawTitle = c.title
      const id = rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "-")
      return {
        id,
        name: rawTitle,
        description: c.description ?? "",
        opportunityScore: c.metrics?.opportunityScore ?? 0,
        searchVolume: c.metrics?.totalVolume,
        clickShare: c.terms.reduce((sum, t) => sum + t.clickShare, 0) / c.terms.length,
        keywords: c.terms.map((t) => t.term),
        tags: (c.tags || []).map((tag) => ({ category: tag.category, value: tag.value })),
      }
    })

    return NextResponse.json({
      success: true,
      message: "Level 2 file processed successfully",
      headerInfo,
      metadata,
      warnings: allErrors.length > 0 ? `Processed with ${allErrors.length} validation warnings` : undefined,
      data: {
        searchTerms: searchTerms.data,
        nicheInsights: nicheInsights.data,
        products: products.data,
        clusters: trendClusters,
        totalSearchTerms: searchTerms.data.length,
        totalNicheInsights: nicheInsights.data.length,
        totalProducts: products.data.length,
        totalClusters: trendClusters.length,
      },
    })
  } catch (error) {
    console.error("Error processing Level 2 file:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process file",
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
