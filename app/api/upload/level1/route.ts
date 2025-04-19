import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"

// Helper function to validate and parse numeric values
function parseNumericValue(value: string | undefined, fieldName: string): number | "N/A" {
  if (!value || value.trim() === "") {
    console.warn(`Missing value for field: ${fieldName}`)
    return "N/A"
  }
  const parsed = parseFloat(value)
  return isNaN(parsed) ? "N/A" : parsed
}

// Helper function to validate and parse array values
function parseArrayValue(values: (string | undefined)[], fieldName: string): string[] | "N/A" {
  const validValues = values.filter((v): v is string => v !== undefined && v.trim() !== "")
  if (validValues.length === 0) {
    console.warn(`Missing values for field: ${fieldName}`)
    return "N/A"
  }
  return validValues
}

interface Level1Record {
  "Customer Need": string;
  "Top Search Term 1": string;
  "Top Search Term 2": string;
  "Top Search Term 3": string;
  "Search Volume (Past 360 days)": string;
  "Search Volume Growth (Past 180 days)": string;
  "Search Volume (Past 90 days)": string;
  "Search Volume Growth (Past 90 days)": string;
  "Units Sold Lower Bound (Past 360 days)": string;
  "Units Sold Upper Bound (Past 360 days)": string;
  "Range of Average Units Sold Lower Bound (Past 360 days)": string;
  "Range of Average Units Sold Upper Bound (Past 360 days)": string;
  "# of Top Clicked Products": string;
  "Average Price (USD)": string;
  "Minimum Price (Past 360 days) (USD)": string;
  "Maximum Price (Past 360 days) (USD)": string;
  "Return Rate (Past 360 days)": string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.error("No file found in form data")
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    console.log("File received:", {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Read the file content
    const buffer = await file.arrayBuffer()
    const content = new TextDecoder().decode(buffer)

    console.log("File content preview:", content.substring(0, 200))

    // Parse CSV with proper options
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      skipRecordsWithError: true
    }) as Level1Record[]

    console.log("Parsed records:", {
      count: records.length,
      headers: Object.keys(records[0] || {}),
      firstRecord: records[0]
    })

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: "No data found in file" },
        { status: 400 }
      )
    }

    // Normalize the data - only including Level 1 fields
    const normalizedData = records.map((record: Level1Record) => {
      const normalized = {
        // Basic niche information
        Customer_Need: record["Customer Need"]?.trim() || "",
        Top_Search_Terms: [
          record["Top Search Term 1"],
          record["Top Search Term 2"],
          record["Top Search Term 3"]
        ].filter(Boolean),
        
        // Search volume metrics
        Search_Volume: parseFloat(record["Search Volume (Past 360 days)"]) || 0,
        Search_Volume_Growth: parseFloat(record["Search Volume Growth (Past 180 days)"]) || 0,
        Recent_Search_Volume: parseFloat(record["Search Volume (Past 90 days)"]) || 0,
        Recent_Growth: parseFloat(record["Search Volume Growth (Past 90 days)"]) || 0,
        
        // Sales metrics
        Units_Sold_Lower: parseFloat(record["Units Sold Lower Bound (Past 360 days)"]) || 0,
        Units_Sold_Upper: parseFloat(record["Units Sold Upper Bound (Past 360 days)"]) || 0,
        Average_Units_Sold_Lower: parseFloat(record["Range of Average Units Sold Lower Bound (Past 360 days)"]) || 0,
        Average_Units_Sold_Upper: parseFloat(record["Range of Average Units Sold Upper Bound (Past 360 days)"]) || 0,
        
        // Product metrics
        Top_Products_Count: parseFloat(record["# of Top Clicked Products"]) || 0,
        Average_Price: parseFloat(record["Average Price (USD)"]) || 0,
        Min_Price: parseFloat(record["Minimum Price (Past 360 days) (USD)"]) || 0,
        Max_Price: parseFloat(record["Maximum Price (Past 360 days) (USD)"]) || 0,
        Return_Rate: parseFloat(record["Return Rate (Past 360 days)"]) || 0
      }

      console.log("Normalized record:", normalized)
      return normalized
    })

    // Calculate validation statistics
    const validationStats = {
      totalRecords: normalizedData.length,
      missingValues: Object.fromEntries(
        Object.keys(normalizedData[0] || {}).map(key => [
          key,
          normalizedData.filter(record => record[key as keyof typeof record] === "N/A").length
        ])
      )
    }

    console.log("Validation statistics:", validationStats)

    console.log("Sending response with normalized data")
    return NextResponse.json({ 
      data: normalizedData,
      headerInfo: {
        originalHeaders: Object.keys(records[0] || {}),
        normalizedHeaders: Object.keys(normalizedData[0] || {}),
        details: `Successfully parsed ${records.length} records`,
        validationStats
      }
    })
  } catch (error) {
    console.error("Error processing file:", error)
    return NextResponse.json(
      { 
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
