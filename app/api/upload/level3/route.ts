import { NextResponse, type NextRequest } from "next/server"
import { parseLevel3Data, mapToLevel3Schema } from "@/lib/parsers/unified-parser"
import { OpenAI } from "openai"
import Papa from "papaparse"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    console.log(`Processing Level 3 file: ${file.name} (${file.type}, ${file.size} bytes)`)

    // Parse and validate the file (skip CSV metadata, fallback to Excel parser)
    let data: any[] = []
    let errors: string[] = []
    let headerInfo = ''
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      // Read CSV and drop any pre-header lines
      const buffer = await file.arrayBuffer()
      const rawText = new TextDecoder().decode(buffer)
      const lines = rawText.split(/\r?\n/)
      const headerIdx = lines.findIndex(l => l.includes('ASIN') && l.includes('Keyword'))
      if (headerIdx > 0) headerInfo += `Skipped ${headerIdx} lines of metadata\n`
      const csvText = headerIdx >= 0 ? lines.slice(headerIdx).join('\n') : rawText
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
      headerInfo += `Rows: ${parsed.data.length}\nHeaders: ${parsed.meta.fields?.join(', ')}\n`
      const mapped = mapToLevel3Schema(parsed.data as any[])
      data = mapped.data
      errors = mapped.errors
      headerInfo += `Valid entries: ${data.length}, Errors: ${errors.length}\n`
      console.log(`CSV parsed: ${data.length} entries, ${errors.length} errors`)
    } else {
      const result = await parseLevel3Data(file)
      data = result.data
      errors = result.errors
      headerInfo = result.headerInfo
      console.log(`Excel parsed: ${data.length} entries, ${errors.length} errors`)
    }

    // Check if we have any valid data
    if (data.length === 0) {
      console.log("No valid data found in file")
      return NextResponse.json(
        {
          success: false,
          message: "No valid Level 3 data found in file",
          headerInfo,
        },
        { status: 400 },
      )
    }

    // Calculate summary metrics
    const asins = new Set(data.map(item => item.ASIN))
    const keywords = new Set(data.map(item => item.Keyword))
    const avgSearchVolume = data.reduce((sum, item) => sum + item.Search_Volume, 0) / data.length
    const avgClickShare = data.reduce((sum, item) => sum + item.ABA_Click_Share, 0) / data.length
    const avgConversionShare = data.reduce((sum, item) => sum + item.Conversion_Share, 0) / data.length

    // Group data by ASIN for analysis
    const asinGroups = data.reduce((groups: Record<string, typeof data>, item) => {
      if (!groups[item.ASIN]) {
        groups[item.ASIN] = []
      }
      groups[item.ASIN].push(item)
      return groups
    }, {})

    // Build summary for each ASIN
    const asinSummaries = Object.entries(asinGroups).map(([asin, items]) => {
      const totalSearchVolume = items.reduce((sum, item) => sum + item.Search_Volume, 0)
      const avgClickShare = items.reduce((sum, item) => sum + item.ABA_Click_Share, 0) / items.length
      const avgConversionShare = items.reduce((sum, item) => sum + item.Conversion_Share, 0) / items.length
      const topKeywords = [...items]
        .sort((a, b) => b.Search_Volume - a.Search_Volume)
        .slice(0, 5)
        .map(item => ({
          keyword: item.Keyword,
          searchVolume: item.Search_Volume,
          organicRank: item.Organic_Rank,
          sponsoredRank: item.Sponsored_Rank,
        }))

      return {
        asin,
        keywordCount: items.length,
        totalSearchVolume,
        avgClickShare,
        avgConversionShare,
        topKeywords,
        totalKeywordSales: items.reduce((sum, item) => sum + item.Keyword_Sales, 0),
      }
    })

    return NextResponse.json({
      success: true,
      message: "Level 3 file processed successfully",
      headerInfo,
      warnings: errors.length > 0 ? `Processed with ${errors.length} validation warnings` : undefined,
      data: {
        keywordAsinPairs: data,
        summary: {
          totalPairs: data.length,
          uniqueAsins: asins.size,
          uniqueKeywords: keywords.size,
          avgSearchVolume,
          avgClickShare,
          avgConversionShare,
        },
        asinSummaries,
      },
    })
  } catch (error) {
    console.error("Error processing Level 3 file:", error)
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