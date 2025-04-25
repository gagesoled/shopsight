import { NextResponse, type NextRequest } from "next/server"
import { parseLevel2Data } from "@/lib/parsers/unified-parser"
import { runAIClustering } from "@/lib/analysis/ai-clustering"
import { OpenAI } from "openai"
import type { TrendCluster } from "@/lib/types"

// Define minimal interface for AICluster used in this file
interface AICluster {
  id?: string;
  title?: string;
  description?: string;
  tags?: Array<{ category: string, value: string, confidence?: number }>;
  metrics?: {
    totalVolume?: number;
    avgGrowth?: number;
    avgClickShare?: number;
    opportunityScore?: number;
  };
  terms?: Array<{ term: string }>;
}

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

    console.log(`Parsing results: ${searchTerms.data.length} search terms, ${nicheInsights.data.length} insights, ${products.data.length} products`)

    // Check if we have any valid data
    if (searchTerms.data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid search term data found",
          headerInfo,
          sheetNames,
          metadata,
          data: {
            searchTerms: searchTerms.data,
            nicheInsights: nicheInsights.data,
            products: products.data,
            clusters: [],
            totalSearchTerms: 0,
            totalNicheInsights: nicheInsights.data.length,
            totalProducts: products.data.length,
            totalClusters: 0,
          },
        },
        { status: 400 },
      )
    }

    // Collect all errors from parsing stage
    const allParsingErrors = [...searchTerms.errors, ...nicheInsights.errors, ...products.errors]

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Verify OpenAI connection before proceeding
    let openaiConnectionVerified = false;
    let clusteringError: string | null = null;
    
    try {
      console.log("Verifying OpenAI API connection...");
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      
      // Simple API call to verify connection
      const modelList = await openai.models.list();
      if (modelList && Array.isArray(modelList.data)) {
        const hasEmbeddingModel = modelList.data.some(model => 
          model.id === "text-embedding-ada-002" || 
          model.id.includes("embedding")
        );
        
        console.log(`OpenAI API connection successful. Embedding model available: ${hasEmbeddingModel}`);
        openaiConnectionVerified = true;
      } else {
        console.warn("OpenAI API returned unexpected response format for models list");
      }
    } catch (openaiError) {
      console.error("Failed to verify OpenAI API connection:", openaiError);
      clusteringError = `OpenAI API connection failed: ${openaiError instanceof Error ? openaiError.message : String(openaiError)}`;
    }

    // Run AI-powered clustering on search terms data
    let aiClusters: AICluster[] = []
    
    if (openaiConnectionVerified) {
      try {
        console.log("Starting AI clustering with verified OpenAI connection...");
        aiClusters = await runAIClustering(searchTerms.data, openai)
        console.log(`AI Clustering returned ${aiClusters.length} clusters`)
      } catch (error) {
        clusteringError = `Error during clustering: ${error instanceof Error ? error.message : String(error)}`
        console.error(clusteringError)
        aiClusters = []
      }
    } else {
      console.log("Skipping AI clustering due to OpenAI connection issues");
    }

    // Map the enriched AICluster objects to TrendCluster for frontend
    const trendClusters: TrendCluster[] = aiClusters.map((cluster) => {
      // Generate a clean ID from the title or use the existing id
      const id = cluster.id || 
        (cluster.title ? cluster.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : 
        `cluster-${Math.random().toString(36).substring(2, 8)}`)

      // Format tags for the frontend
      const formattedTags = Array.isArray(cluster.tags) 
        ? cluster.tags.map(tag => ({
            category: tag.category || "Unknown",
            value: tag.value || ""
          }))
        : []

      return {
        id,
        name: cluster.title || `Cluster ${id}`,
        description: cluster.description || "",
        opportunityScore: cluster.metrics?.opportunityScore || 0,
        searchVolume: cluster.metrics?.totalVolume || 0,
        clickShare: cluster.metrics?.avgClickShare || 0,
        keywords: cluster.terms?.map(t => t.term) || [],
        tags: formattedTags
      }
    })

    // Construct the response
    const responseData = {
      searchTerms: searchTerms.data,
      nicheInsights: nicheInsights.data,
      products: products.data,
      clusters: trendClusters,
      totalSearchTerms: searchTerms.data.length,
      totalNicheInsights: nicheInsights.data.length,
      totalProducts: products.data.length,
      totalClusters: trendClusters.length,
    }

    // Add warnings if there were any parsing or clustering errors
    let warnings = allParsingErrors.length > 0 ? `Processed with ${allParsingErrors.length} parsing warnings.` : undefined
    if (clusteringError) {
      warnings = warnings ? `${warnings} ${clusteringError}` : clusteringError
    }

    return NextResponse.json({
      success: true,
      message: "Level 2 file processed successfully.",
      headerInfo,
      metadata,
      warnings,
      data: responseData,
    })
  } catch (error) {
    console.error("Error processing Level 2 file:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process file",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
