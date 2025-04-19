import { NextResponse, type NextRequest } from "next/server"
import { parseLevel1FromURL } from "@/lib/parsers/unified-parser"
import { calculateOpportunityScore } from "@/lib/analysis/clustering"

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ success: false, message: "No URL provided" }, { status: 400 })
    }

    // Parse the CSV from the URL
    const { data, errors, headerInfo } = await parseLevel1FromURL(url)

    // Include the first few rows of raw data for debugging
    const rawData = data.slice(0, 3)

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation errors in file",
          errors,
          headerInfo,
          rawData,
        },
        { status: 400 },
      )
    }

    if (data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid data found in file",
          headerInfo,
        },
        { status: 400 },
      )
    }

    // Process the data to extract the requested fields
    const customerNeeds = data.map((item) => {
      return {
        need: item.Customer_Need,
        volume: Math.round(item.Search_Volume || 0), // Round to integer
        growth180:
          item.Search_Volume_Growth_180 !== undefined
            ? `${item.Search_Volume_Growth_180 > 0 ? "+" : ""}${(item.Search_Volume_Growth_180 * 100).toFixed(0)}%`
            : undefined,
        growth90:
          item.Search_Volume_Growth_90 !== undefined
            ? `${item.Search_Volume_Growth_90 > 0 ? "+" : ""}${(item.Search_Volume_Growth_90 * 100).toFixed(0)}%`
            : undefined,
        topClickedProducts: item.Top_Clicked_Products !== undefined ? item.Top_Clicked_Products : undefined,
        // Keep these for future use but don't display them yet
        opportunityScore: calculateOpportunityScore(
          item.Search_Volume || 0,
          item.Search_Volume_Growth_180 || 0,
          item.Brand_Concentration || 0.5,
        ),
        clickShare: item.Click_Share !== undefined ? (item.Click_Share * 100).toFixed(1) + "%" : undefined,
        conversionRate: item.Conversion_Rate !== undefined ? (item.Conversion_Rate * 100).toFixed(1) + "%" : undefined,
        unitsSold: item.Units_Sold,
        brandConcentration:
          item.Brand_Concentration !== undefined ? (item.Brand_Concentration * 100).toFixed(1) + "%" : undefined,
        notes: item.Notes || "",
        // Include top search terms
        topSearchTerms: [item.Top_Search_Term_1, item.Top_Search_Term_2, item.Top_Search_Term_3].filter(Boolean),
      }
    })

    // Sort by volume (descending)
    customerNeeds.sort((a, b) => b.volume - a.volume)

    return NextResponse.json({
      success: true,
      message: "CSV analyzed successfully",
      headerInfo,
      rawData,
      data: {
        customerNeeds,
        totalRecords: data.length,
      },
    })
  } catch (error) {
    console.error("Error analyzing CSV:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to analyze CSV file",
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
