import * as XLSX from "xlsx-js-style"
import { z } from "zod"
import {
  Level1Schema,
  Level2SearchTermDataSchema,
  Level2NicheInsightSchema,
  Level2ProductSchema,
  Level3Schema,
  type Level1Data,
  type Level2SearchTermData,
  type Level2NicheInsightData,
  type Level2ProductData,
  type Level3Data,
} from "../validation"

/**
 * Parse Excel/CSV files into structured data
 */
export async function parseFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as ArrayBuffer)
      } else {
        reject(new Error("Failed to read file"))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Debug function to log worksheet structure
 */
function debugWorksheet(worksheet: XLSX.WorkSheet): string {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
  let debug = `Worksheet range: ${worksheet["!ref"]}\n`
  debug += "First 5 rows:\n"

  // Check first 5 rows
  for (let r = range.s.r; r <= Math.min(range.s.r + 4, range.e.r); r++) {
    let rowContent = `Row ${r + 1}: `
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]
      if (cell) {
        rowContent += `${XLSX.utils.encode_col(c)}=${cell.v}; `
      }
    }
    debug += rowContent + "\n"
  }
  return debug
}

/**
 * Normalize column headers to match expected schema
 */
function normalizeHeader(header: string): string {
  // Clean the header string
  const originalHeader = header.trim()

  // Special case handling for specific headers in your CSV
  if (originalHeader === "Customer Need") {
    return "Customer_Need"
  }
  if (originalHeader === "Search Volume (Past 360 days)") {
    return "Search_Volume"
  }
  if (originalHeader === "Search Volume Growth (Past 180 days)") {
    return "Search_Volume_Growth_180"
  }
  if (originalHeader === "Search Volume (Past 90 days)") {
    return "Search_Volume_90"
  }
  if (originalHeader === "Search Volume Growth (Past 90 days)") {
    return "Search_Volume_Growth_90"
  }
  if (originalHeader === "# of Top Clicked Products") {
    return "Top_Clicked_Products"
  }
  if (originalHeader === "Units Sold Lower Bound (Past 360 days)") {
    return "Units_Sold_Lower"
  }
  if (originalHeader === "Units Sold Upper Bound (Past 360 days)") {
    return "Units_Sold_Upper"
  }
  if (originalHeader === "Top Search Term 1") {
    return "Top_Search_Term_1"
  }
  if (originalHeader === "Top Search Term 2") {
    return "Top_Search_Term_2"
  }
  if (originalHeader === "Top Search Term 3") {
    return "Top_Search_Term_3"
  }

  // Replace spaces and special characters with underscores
  const cleaned = originalHeader.replace(/[^a-zA-Z0-9_]/g, "_")

  // Convert to snake_case
  return cleaned
}

/**
 * Calculate header match score - how well a row matches our expected headers
 */
function calculateHeaderMatchScore(
  rowHeaders: string[],
  expectedHeaders: string[],
): {
  score: number
  matches: string[]
} {
  // Normalize the headers for comparison
  const normalizedRowHeaders = rowHeaders.map((h) => normalizeHeader(h).toLowerCase())
  const normalizedExpectedHeaders = expectedHeaders.map((h) => h.toLowerCase())

  // Count how many expected headers are found in this row
  const matches: string[] = []

  for (const expectedHeader of normalizedExpectedHeaders) {
    for (const rowHeader of normalizedRowHeaders) {
      if (rowHeader.includes(expectedHeader) || expectedHeader.includes(rowHeader)) {
        matches.push(expectedHeader)
        break
      }
    }
  }

  // Calculate score as percentage of matches
  const score = matches.length / expectedHeaders.length

  return { score, matches }
}

/**
 * Improved Excel/CSV to JSON conversion with flexible header detection
 */
export function excelToJson(
  buffer: ArrayBuffer,
  expectedHeaders: string[] = [],
): {
  data: any[]
  headerInfo: string
  originalHeaders: string[]
  normalizedHeaders: string[]
} {
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]

  // Get debug info
  const debugInfo = debugWorksheet(worksheet)

  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")

  // Look for headers in the first 15 rows (expanded from 10)
  let headerRowIndex = -1
  let headers: string[] = []
  let headerInfo = "Header detection:\n"
  let bestScore = 0
  let bestMatches: string[] = []

  // Check each of the first 15 rows
  for (let r = range.s.r; r <= Math.min(range.s.r + 14, range.e.r); r++) {
    const rowHeaders: string[] = []
    let hasValues = false
    let potentialHeaderRow = true
    let nonEmptyCells = 0

    // Check each cell in the row
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]

      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== "") {
        hasValues = true
        nonEmptyCells++
        const headerValue = String(cell.v).trim()
        rowHeaders.push(headerValue)

        // Check if this looks like data rather than a header
        // Headers typically don't contain only numbers
        if (/^\d+(\.\d+)?$/.test(headerValue)) {
          potentialHeaderRow = false
        }
      } else {
        rowHeaders.push("")
      }
    }

    // Skip rows with too few non-empty cells
    if (nonEmptyCells < 3) {
      headerInfo += `Row ${r + 1}: Skipped (too few cells: ${nonEmptyCells})\n`
      continue
    }

    // Skip empty rows
    if (!hasValues) {
      headerInfo += `Row ${r + 1}: Skipped (empty row)\n`
      continue
    }

    // Skip rows that look like data
    if (!potentialHeaderRow) {
      headerInfo += `Row ${r + 1}: Skipped (looks like data row)\n`
      continue
    }

    headerInfo += `Row ${r + 1}: ${rowHeaders.filter((h) => h).join(", ")}\n`

    // If we have expected headers, check if this row matches
    if (expectedHeaders.length > 0) {
      const { score, matches } = calculateHeaderMatchScore(rowHeaders, expectedHeaders)

      headerInfo += `  Match score: ${(score * 100).toFixed(1)}% (${matches.length}/${expectedHeaders.length})\n`

      // Keep track of the best matching row
      if (score > bestScore) {
        bestScore = score
        bestMatches = matches
        headerRowIndex = r
        headers = rowHeaders
        headerInfo += `  New best match\n`
      }
    }
    // If we couldn't find a good header row, fall back to the default behavior
    else if (potentialHeaderRow) {
      headerRowIndex = r
      headers = rowHeaders
      headerInfo += `  Selected as header row (no expected headers provided)\n`
      break
    }
  }

  // If we found a header row with a good enough score
  if (headerRowIndex !== -1 && bestScore >= 0.4) {
    headerInfo += `Selected row ${headerRowIndex + 1} as header row (score: ${(bestScore * 100).toFixed(1)}%)\n`
  }
  // If we couldn't find a good header row, fall back to the default behavior
  else {
    headerInfo += "Could not detect headers with sufficient confidence, using default XLSX parsing\n"
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })
    return {
      data: jsonData,
      headerInfo: headerInfo + debugInfo,
      originalHeaders: [],
      normalizedHeaders: [],
    }
  }

  // Normalize the detected headers
  const normalizedHeaders = headers.map((header) => normalizeHeader(header))
  headerInfo += `Original headers: ${headers.join(", ")}\n`
  headerInfo += `Normalized headers: ${normalizedHeaders.join(", ")}\n`

  // Create a new range that starts after the header row
  const dataRange = {
    s: { r: headerRowIndex + 1, c: range.s.c },
    e: range.e,
  }

  // Extract the data rows
  const rows: any[] = []

  for (let r = dataRange.s.r; r <= dataRange.e.r; r++) {
    const row: Record<string, any> = {}
    let hasValues = false

    for (let c = dataRange.s.c; c <= dataRange.e.c; c++) {
      const headerIndex = c - range.s.c
      if (headerIndex >= normalizedHeaders.length) continue

      const header = normalizedHeaders[headerIndex]
      if (!header) continue

      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]

      if (cell && cell.v !== undefined && cell.v !== null) {
        // Handle different cell types
        if (cell.t === "n") {
          // Numeric cell
          row[header] = cell.v
        } else if (cell.t === "b") {
          // Boolean cell
          row[header] = cell.v
        } else if (cell.t === "d") {
          // Date cell
          row[header] = cell.w || cell.v
        } else {
          // String or other cell type
          row[header] = String(cell.v).trim()
        }
        hasValues = true
      } else {
        row[header] = ""
      }
    }

    if (hasValues) {
      rows.push(row)
    }
  }

  return {
    data: rows,
    headerInfo: headerInfo + `Processed ${rows.length} data rows\n` + debugInfo,
    originalHeaders: headers,
    normalizedHeaders: normalizedHeaders,
  }
}

/**
 * Map CSV data to Level 1 schema
 */
function mapToLevel1Schema(data: any[], normalizedHeaders: string[]): { data: Level1Data[]; errors: string[] } {
  const validData: Level1Data[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip rows that are clearly not data (e.g., empty rows or headers)
      if (!row.Customer_Need) {
        continue
      }

      // Try to map the data to our schema
      const mappedRow: any = {} // Use any type to allow for additional fields

      // Map Customer_Need
      mappedRow.Customer_Need = String(row.Customer_Need || "")

      // Map Search_Volume - ensure it's a number
      mappedRow.Search_Volume = row.Search_Volume ? Number.parseFloat(String(row.Search_Volume)) : 0

      // Ensure Search_Volume is non-negative
      mappedRow.Search_Volume = Math.max(0, mappedRow.Search_Volume)

      // Map Search_Volume_Growth - use 180 days growth if available
      if (row.Search_Volume_Growth_180 !== undefined) {
        mappedRow.Search_Volume_Growth = Number.parseFloat(String(row.Search_Volume_Growth_180))
      } else {
        mappedRow.Search_Volume_Growth = 0
      }

      // Map Click_Share and Conversion_Rate with defaults
      mappedRow.Click_Share = 0.5 // Default value
      mappedRow.Conversion_Rate = 0.1 // Default value

      // Map Units_Sold - use lower bound if available
      if (row.Units_Sold_Lower !== undefined) {
        mappedRow.Units_Sold = Number.parseFloat(String(row.Units_Sold_Lower))
      } else {
        mappedRow.Units_Sold = 0
      }

      // Ensure Units_Sold is non-negative
      mappedRow.Units_Sold = Math.max(0, mappedRow.Units_Sold)

      // Map Brand_Concentration - use a proxy from Top_Clicked_Products
      if (row.Top_Clicked_Products !== undefined) {
        const numProducts = Number.parseFloat(String(row.Top_Clicked_Products))
        mappedRow.Brand_Concentration = numProducts > 0 ? Math.min(1, 10 / numProducts) : 0.5
      } else {
        mappedRow.Brand_Concentration = 0.5 // Default value
      }

      // Map Notes
      mappedRow.Notes = ""

      // Skip rows with empty Customer_Need
      if (!mappedRow.Customer_Need) {
        continue
      }

      // Add additional fields that aren't in the schema but we want to keep
      const additionalFields = {
        Search_Volume_Growth_180:
          row.Search_Volume_Growth_180 !== undefined
            ? Number.parseFloat(String(row.Search_Volume_Growth_180))
            : undefined,
        Search_Volume_90:
          row.Search_Volume_90 !== undefined ? Number.parseFloat(String(row.Search_Volume_90)) : undefined,
        Search_Volume_Growth_90:
          row.Search_Volume_Growth_90 !== undefined
            ? Number.parseFloat(String(row.Search_Volume_Growth_90))
            : undefined,
        Top_Clicked_Products:
          row.Top_Clicked_Products !== undefined ? Number.parseFloat(String(row.Top_Clicked_Products)) : undefined,
        Top_Search_Term_1: row.Top_Search_Term_1 || "",
        Top_Search_Term_2: row.Top_Search_Term_2 || "",
        Top_Search_Term_3: row.Top_Search_Term_3 || "",
      }

      try {
        // Validate with Zod schema
        const validatedRow = Level1Schema.parse(mappedRow)

        // Combine validated row with additional fields
        const finalRow = {
          ...validatedRow,
          ...additionalFields,
        }

        validData.push(finalRow as Level1Data)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const rowErrors = validationError.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
          errors.push(...rowErrors)
        } else {
          errors.push(`Row ${i + 1}: Validation error - ${(validationError as Error).message}`)
        }
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${(error as Error).message}`)
    }
  }

  return { data: validData, errors }
}

/**
 * Parse and validate Level 1 data (Category Overview)
 */
export async function parseLevel1Data(file: File): Promise<{
  data: Level1Data[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const buffer = await parseFile(file)
    // Provide expected headers for Level 1 data
    const expectedHeaders = [
      "Customer_Need",
      "Search_Volume",
      "Search_Volume_Growth",
      "Click_Share",
      "Conversion_Rate",
      "Units_Sold",
      "Brand_Concentration",
    ]

    const { data: rawData, headerInfo, normalizedHeaders } = excelToJson(buffer, expectedHeaders)

    // Map the raw data to our schema
    const { data: validData, errors } = mapToLevel1Schema(rawData, normalizedHeaders)

    return { data: validData, errors, headerInfo }
  } catch (error) {
    return {
      data: [],
      errors: [(error as Error).message || "Failed to parse Level 1 data"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

/**
 * Parse and validate Level 2 data (Search Term Data)
 */
export async function parseLevel2Data(file: File): Promise<{
  data: Level2SearchTermData[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const buffer = await parseFile(file)
    // Provide expected headers for Level 2 data
    const expectedHeaders = [
      "Search_Term",
      "Volume",
      "Click_Share",
      "Conversion_Rate",
      "Top_Products",
      "Format_Inferred",
      "Function_Inferred",
    ]

    const { data: rawData, headerInfo } = excelToJson(buffer, expectedHeaders)

    const errors: string[] = []
    const validData: Level2SearchTermData[] = []

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]

      // Skip rows that are clearly not data
      if (!row.Search_Term && !row.Volume) {
        continue
      }

      try {
        // Convert string values to appropriate types
        const processedRow = {
          Search_Term: String(row.Search_Term || ""),
          Volume: Number.parseFloat(row.Volume) || 0,
          Click_Share: Number.parseFloat(row.Click_Share) || 0,
          Conversion_Rate: Number.parseFloat(row.Conversion_Rate) || 0,
          // Handle Top_Products as a string or array
          Top_Clicked_Product_1_ASIN: Array.isArray(row.Top_Products) ? row.Top_Products[0] : undefined,
          Top_Clicked_Product_2_ASIN: Array.isArray(row.Top_Products) ? row.Top_Products[1] : undefined,
          Top_Clicked_Product_3_ASIN: Array.isArray(row.Top_Products) ? row.Top_Products[2] : undefined,
          Format_Inferred: row.Format_Inferred || undefined,
          Function_Inferred: row.Function_Inferred || undefined,
        }

        // Skip rows with empty Search_Term
        if (!processedRow.Search_Term) {
          continue
        }

        // Validate with Zod schema
        const validatedRow = Level2SearchTermDataSchema.parse(processedRow)
        validData.push(validatedRow)
      } catch (error) {
        if (error instanceof z.ZodError) {
          const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
          errors.push(...rowErrors)
        } else {
          errors.push(`Row ${i + 1}: Unknown error - ${(error as Error).message}`)
        }
      }
    }

    return { data: validData, errors, headerInfo }
  } catch (error) {
    return {
      data: [],
      errors: [(error as Error).message || "Failed to parse Level 2 data"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

export async function parseLevel3Data(file: File): Promise<{
  data: Level3Data[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const buffer = await parseFile(file)
    // Provide expected headers for Level 3 data
    const expectedHeaders = [
      "ASIN",
      "Keyword",
      "Search_Volume",
      "ABA_Click_Share",
      "Conversion_Share",
      "Organic_Rank",
      "Sponsored_Rank",
      "Keyword_Sales",
    ]

    const { data: rawData, headerInfo } = excelToJson(buffer, expectedHeaders)

    const errors: string[] = []
    const validData: Level3Data[] = []

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]

      // Skip rows that are clearly not data
      if (!row.ASIN && !row.Keyword) {
        continue
      }

      try {
        // Convert string values to appropriate types
        const processedRow = {
          ASIN: String(row.ASIN || ""),
          Keyword: String(row.Keyword || ""),
          Search_Volume: Number.parseFloat(row.Search_Volume) || 0,
          ABA_Click_Share: Number.parseFloat(row.ABA_Click_Share) || 0,
          Conversion_Share: Number.parseFloat(row.Conversion_Share) || 0,
          Organic_Rank: row.Organic_Rank ? Number.parseFloat(row.Organic_Rank) : null,
          Sponsored_Rank: row.Sponsored_Rank ? Number.parseFloat(row.Sponsored_Rank) : null,
          Keyword_Sales: Number.parseFloat(row.Keyword_Sales) || 0,
        }

        // Skip rows with empty ASIN or Keyword
        if (!processedRow.ASIN || !processedRow.Keyword) {
          continue
        }

        // Validate with Zod schema
        const validatedRow = Level3Schema.parse(processedRow)
        validData.push(validatedRow)
      } catch (error) {
        if (error instanceof z.ZodError) {
          const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
          errors.push(...rowErrors)
        } else {
          errors.push(`Row ${i + 1}: Unknown error - ${(error as Error).message}`)
        }
      }
    }

    return { data: validData, errors, headerInfo }
  } catch (error) {
    return {
      data: [],
      errors: [(error as Error).message || "Failed to parse Level 3 data"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

/**
 * Fetch and parse a CSV file from a URL
 */
export async function fetchAndParseCSV(
  url: string,
  expectedHeaders: string[] = [],
): Promise<{
  data: any[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    const { data, headerInfo } = excelToJson(buffer, expectedHeaders)

    return {
      data,
      errors: [],
      headerInfo,
    }
  } catch (error) {
    return {
      data: [],
      errors: [(error as Error).message || "Failed to fetch and parse CSV"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

/**
 * Direct parse from URL for Level 1 data
 */
export async function parseLevel1FromURL(url: string): Promise<{
  data: Level1Data[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()

    // Provide expected headers for Level 1 data
    const expectedHeaders = [
      "Customer_Need",
      "Search_Volume",
      "Search_Volume_Growth",
      "Click_Share",
      "Conversion_Rate",
      "Units_Sold",
      "Brand_Concentration",
    ]

    const { data: rawData, headerInfo, normalizedHeaders } = excelToJson(buffer, expectedHeaders)

    // Map the raw data to our schema
    const { data: validData, errors } = mapToLevel1Schema(rawData, normalizedHeaders)

    return { data: validData, errors, headerInfo }
  } catch (error) {
    return {
      data: [],
      errors: [(error as Error).message || "Failed to parse Level 1 data from URL"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}
