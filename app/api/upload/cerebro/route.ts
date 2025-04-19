import { NextResponse, type NextRequest } from "next/server"
import { parseLevel3Data } from "@/lib/parsers/unified-parser"
import { parseTagOntology, applyTags } from "@/lib/analysis/tagging"

// Sample tag ontology (in a real app, this would be loaded from a database or file)
const sampleTagOntology = [
  {
    Category: "Format",
    Tag: "Gummies",
    Trigger: "gummy|chews",
  },
  {
    Category: "Format",
    Tag: "Tea",
    Trigger: "tea|herbal drink",
  },
  {
    Category: "Format",
    Tag: "Spray",
    Trigger: "spray",
  },
  {
    Category: "Format",
    Tag: "Capsule",
    Trigger: "capsule|pill|softgel",
  },
  {
    Category: "Audience",
    Tag: "Kids",
    Trigger: "kids|children|toddler",
  },
  {
    Category: "Audience",
    Tag: "Women",
    Trigger: "women|female|pregnancy",
  },
  {
    Category: "Function",
    Tag: "Sleep Onset",
    Trigger: "fall asleep|fast-acting|quick sleep",
  },
  {
    Category: "Function",
    Tag: "Sleep Maintenance",
    Trigger: "stay asleep|through the night",
  },
  {
    Category: "Values",
    Tag: "Non-Hormonal",
    Trigger: "melatonin-free|no hormone",
  },
  {
    Category: "Values",
    Tag: "Natural",
    Trigger: "organic|natural|non-gmo|vegan",
  },
  {
    Category: "Behavior",
    Tag: "Ritual-Based",
    Trigger: "bedtime ritual|nighttime routine|calming ritual",
  },
  {
    Category: "Behavior",
    Tag: "Stacked Formula",
    Trigger: "multi-ingredient|complex blend|stacked formula",
  },
]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    console.log(`Processing Cerebro file: ${file.name} (${file.type}, ${file.size} bytes)`)

    // Parse and validate the file
    const { data, errors, headerInfo } = await parseLevel3Data(file)

    console.log(`Parsing results: ${data.length} valid rows, ${errors.length} errors`)

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation errors in file",
          errors,
          headerInfo,
        },
        { status: 400 },
      )
    }

    if (data.length === 0) {
      return NextResponse.json({ success: false, message: "No valid data found in file", headerInfo }, { status: 400 })
    }

    // Parse tag ontology
    const tags = parseTagOntology(sampleTagOntology)

    // Process the data to add tags
    const keywordData = data.map((item) => {
      // Apply tags to the keyword
      const appliedTags = applyTags(item.Keyword, tags)

      // Convert tags to array format for the response
      const tagArray = Object.entries(appliedTags).flatMap(([category, values]) =>
        values.map((value) => ({ category, value })),
      )

      return {
        keyword: item.Keyword,
        asin: item.ASIN,
        volume: item.Search_Volume,
        clickShare: (item.ABA_Click_Share * 100).toFixed(1) + "%",
        conversionShare: (item.Conversion_Share * 100).toFixed(1) + "%",
        organicRank: item.Organic_Rank,
        sponsoredRank: item.Sponsored_Rank,
        keywordSales: item.Keyword_Sales,
        tags: tagArray,
        clusterId: null, // Initially no cluster assigned
      }
    })

    // Group by ASIN for easier analysis
    const keywordsByAsin: Record<string, any[]> = {}
    keywordData.forEach((item) => {
      if (!keywordsByAsin[item.asin]) {
        keywordsByAsin[item.asin] = []
      }
      keywordsByAsin[item.asin].push(item)
    })

    return NextResponse.json({
      success: true,
      message: "Cerebro file processed successfully",
      headerInfo,
      data: {
        keywords: keywordData,
        keywordsByAsin,
        totalRecords: data.length,
        uniqueAsins: Object.keys(keywordsByAsin).length,
      },
    })
  } catch (error) {
    console.error("Error processing Cerebro file:", error)
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
