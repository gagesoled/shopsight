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
} from "@/lib/schemas"
import { ParseResult } from '../types'
import Papa from 'papaparse'
import { normalizeHeader, normalizeHeaders, extractMetadata } from './header-normalizer'

/**
 * Parse file into ArrayBuffer
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
 * Parse CSV file as text
 */
export async function parseCSVAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string)
      } else {
        reject(new Error("Failed to read file"))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

/**
 * Detect file type based on extension
 */
export function detectFileType(fileName: string): "csv" | "excel" {
  const extension = fileName.split(".").pop()?.toLowerCase()
  return extension === "csv" ? "csv" : "excel"
}

/**
 * Clean header text by removing parentheses content and normalizing
 */
function cleanHeaderText(header: string): string {
  // Remove content in parentheses
  let cleaned = header.replace(/\s*$$[^)]*$$/g, "")
  // Trim whitespace
  cleaned = cleaned.trim()
  // Convert to lowercase and replace spaces with underscores
  return cleaned.toLowerCase().replace(/\s+/g, "_")
}

/**
 * Parse a string value to a number, handling commas and percentages
 * This is a critical function for ensuring proper number parsing
 */
export function parseNumberValue(value: string | number | null | undefined): number | undefined {
  // For debugging
  const originalValue = value

  if (value === null || value === undefined || value === "") {
    return undefined
  }

  // If already a number, return it
  if (typeof value === "number") {
    return value
  }

  // Convert to string and trim
  const strValue = String(value).trim()

  // Handle empty string
  if (strValue === "") {
    return undefined
  }

  // Handle percentage values (e.g., "25%")
  if (strValue.endsWith("%")) {
    const percentValue = strValue.replace("%", "").trim()
    const result = Number.parseFloat(percentValue) / 100
    console.log(`Parsed percentage: ${strValue} -> ${result}`)
    return result
  }

  // Handle numbers with commas (e.g., "1,000")
  const cleanedValue = strValue.replace(/,/g, "")

  // Parse as float
  const parsedValue = Number.parseFloat(cleanedValue)

  // Return undefined if NaN
  if (isNaN(parsedValue)) {
    console.log(`Failed to parse number: ${originalValue}`)
    return undefined
  }

  console.log(`Parsed number: ${originalValue} -> ${parsedValue}`)
  return parsedValue
}

/**
 * Determine if a row is likely a header row
 */
function isLikelyHeaderRow(row: string[]): boolean {
  // Headers typically don't have many numeric values
  const numericCount = row.filter((cell) => /^\d+(\.\d+)?$/.test(cell.trim())).length
  const nonEmptyCount = row.filter((cell) => cell.trim() !== "").length

  // If more than 30% of non-empty cells are numeric, probably not a header
  if (nonEmptyCount > 0 && numericCount / nonEmptyCount > 0.3) {
    return false
  }

  // Headers often contain certain keywords
  const headerKeywords = [
    "name",
    "title",
    "id",
    "count",
    "volume",
    "rate",
    "share",
    "date",
    "price",
    "asin",
    "search",
    "product",
    "need",
    "growth",
    "term",
    "click",
    "conversion",
    "customer",
    "brand",
    "rating",
    "review",
    "bsr",
    "keyword",
  ]
  const keywordMatches = row.filter((cell) =>
    headerKeywords.some((keyword) => cell.toLowerCase().includes(keyword)),
  ).length

  // If we have several keyword matches, likely a header
  if (keywordMatches >= 2) {
    return true
  }

  return false
}

/**
 * Find the most likely header row in CSV data
 */
function findHeaderRow(lines: string[]): { headerRowIndex: number; headers: string[] } {
  // Look through the first 20 rows to find the most likely header row
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Skip metadata lines that don't look like headers
    if (line.startsWith("Niche Name:") || 
        line.includes("Details -") || 
        line.includes("Last updated")) {
      continue
    }

    // Split the line into cells, handling quoted values
    const cells: string[] = []
    let inQuotes = false
    let currentCell = ""

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        cells.push(currentCell.trim())
        currentCell = ""
      } else {
        currentCell += char
      }
    }

    // Add the last cell
    cells.push(currentCell.trim())

    // Check if this row looks like a header
    if (isLikelyHeaderRow(cells)) {
      return { headerRowIndex: i, headers: cells }
    }
  }

  // If no header row found, default to the first row
  const firstLine = lines[0].trim()
  const firstRowCells = firstLine.split(",").map((cell) => cell.trim())
  return { headerRowIndex: 0, headers: firstRowCells }
}

/**
 * Parse CSV data with improved header detection
 */
export function parseCSV(csvText: string): { headers: string[]; rows: any[]; headerRowIndex: number } {
  // Split by lines
  const lines = csvText.trim().split(/\r?\n/)

  if (lines.length === 0) {
    return { headers: [], rows: [], headerRowIndex: -1 }
  }

  // Extract metadata and find where data starts
  const { metadata, dataStartIndex } = extractMetadata(csvText);
  
  // Find the header row
  const { headerRowIndex, headers: rawHeaders } = findHeaderRow(lines.slice(dataStartIndex))
  const actualHeaderRowIndex = headerRowIndex + dataStartIndex;

  // Normalize the headers
  const headers = normalizeHeaders(rawHeaders)
  console.log("Normalized headers:", headers)

  // Parse data rows
  const rows = []
  for (let i = actualHeaderRowIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle quoted fields with commas inside
    const values: string[] = []
    let inQuotes = false
    let currentValue = ""

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        values.push(currentValue.replace(/^"|"$/g, "").trim()) // Remove quotes if present
        currentValue = ""
      } else {
        currentValue += char
      }
    }

    // Add the last value
    values.push(currentValue.replace(/^"|"$/g, "").trim())

    // Create object from headers and values
    const row: Record<string, any> = {}
    headers.forEach((header, index) => {
      if (index < values.length) {
        row[header] = values[index]
      } else {
        row[header] = ""
      }
    })

    rows.push(row)
  }

  // Debug the first row
  if (rows.length > 0) {
    console.log("First row of parsed CSV:", rows[0])
  }

  return { headers, rows, headerRowIndex: actualHeaderRowIndex }
}

/**
 * Process Excel file with improved header detection
 */
export function processExcel(buffer: ArrayBuffer): { headers: string[]; rows: any[]; headerRowIndex: number } {
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]

  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")

  // Look for the header row in the first 20 rows
  let headerRowIndex = -1
  let headers: string[] = []

  for (let r = range.s.r; r <= Math.min(range.s.r + 19, range.e.r); r++) {
    const rowCells: string[] = []

    // Extract the row cells
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]
      rowCells.push(cell ? String(cell.v).trim() : "")
    }

    // Check if this row looks like a header
    if (isLikelyHeaderRow(rowCells)) {
      headerRowIndex = r
      headers = rowCells.map(header => normalizeHeader(header))
      break
    }
  }

  // If no header row found, default to the first row
  if (headerRowIndex === -1) {
    headerRowIndex = range.s.r

    // Extract headers from the first row
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c })
      const cell = worksheet[cellAddress]
      headers.push(cell ? normalizeHeader(String(cell.v)) : `Column_${c + 1}`)
    }
  }

  console.log("Excel headers:", headers)

  // Extract data rows
  const rows: any[] = []

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const row: Record<string, any> = {}
    let hasData = false

    for (let c = range.s.c; c <= range.e.c; c++) {
      const headerIndex = c - range.s.c
      if (headerIndex >= headers.length) continue

      const header = headers[headerIndex]
      if (!header) continue

      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]

      if (cell && cell.v !== undefined && cell.v !== null) {
        row[header] = cell.v
        hasData = true
      } else {
        row[header] = ""
      }
    }

    if (hasData) {
      rows.push(row)
    }
  }

  // Debug the first row
  if (rows.length > 0) {
    console.log("First row of parsed Excel:", rows[0])
  }

  return { headers, rows, headerRowIndex }
}

/**
 * Process Excel workbook with multiple sheets
 */
export function processExcelWorkbook(buffer: ArrayBuffer): {
  searchTerms: ParseResult<Level2SearchTermData>
  nicheInsights: ParseResult<Level2NicheInsightData>
  products: ParseResult<Level2ProductData>
  sheetNames: string[]
} {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetNames = workbook.SheetNames

  // Initialize results with proper types
  const result: {
    searchTerms: ParseResult<Level2SearchTermData>
    nicheInsights: ParseResult<Level2NicheInsightData>
    products: ParseResult<Level2ProductData>
    sheetNames: string[]
  } = {
    searchTerms: { data: [], errors: [] },
    nicheInsights: { data: [], errors: [] },
    products: { data: [], errors: [] },
    sheetNames,
  }

  // Process each sheet based on its name or position
  sheetNames.forEach((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })

    // Determine data level based on sheet name
    let dataLevel: string | undefined
    if (sheetName.toLowerCase().includes("search") || sheetName.toLowerCase().includes("term")) {
      dataLevel = "Level2SearchTerms"
    } else if (sheetName.toLowerCase().includes("insight") || sheetName.toLowerCase().includes("niche")) {
      dataLevel = "Level2NicheInsights"
    } else if (sheetName.toLowerCase().includes("product")) {
      dataLevel = "Level2Products"
    }

    // Normalize headers
    const normalizedData = jsonData.map((row: any) => {
      const normalizedRow: Record<string, any> = {}
      Object.entries(row).forEach(([key, value]) => {
        normalizedRow[normalizeHeader(key, dataLevel)] = value
      })
      return normalizedRow
    })

    // Process data based on sheet type
    if (dataLevel === "Level2SearchTerms" || index === 0) {
      result.searchTerms = processSearchTerms(normalizedData)
    } else if (dataLevel === "Level2NicheInsights" || index === 1) {
      result.nicheInsights = processNicheInsights(normalizedData)
    } else if (dataLevel === "Level2Products" || index === 2) {
      result.products = processProducts(normalizedData)
    }
  })

  return result
}

/**
 * Process a single Excel sheet
 */
function processExcelSheet(worksheet: XLSX.WorkSheet): { headers: string[]; rows: any[]; headerRowIndex: number } {
  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")

  // Look for the header row in the first 20 rows
  let headerRowIndex = -1
  let headers: string[] = []

  for (let r = range.s.r; r <= Math.min(range.s.r + 19, range.e.r); r++) {
    const rowCells: string[] = []

    // Extract the row cells
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]
      rowCells.push(cell ? String(cell.v).trim() : "")
    }

    // Check if this row looks like a header
    if (isLikelyHeaderRow(rowCells)) {
      headerRowIndex = r
      headers = rowCells.map(header => normalizeHeader(header))
      break
    }
  }

  // If no header row found, default to the first row
  if (headerRowIndex === -1) {
    headerRowIndex = range.s.r

    // Extract headers from the first row
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c })
      const cell = worksheet[cellAddress]
      headers.push(cell ? normalizeHeader(String(cell.v)) : `Column_${c + 1}`)
    }
  }

  // Extract data rows
  const rows: any[] = []

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const row: Record<string, any> = {}
    let hasData = false

    for (let c = range.s.c; c <= range.e.c; c++) {
      const headerIndex = c - range.s.c
      if (headerIndex >= headers.length) continue

      const header = headers[headerIndex]
      if (!header) continue

      const cellAddress = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellAddress]

      if (cell && cell.v !== undefined && cell.v !== null) {
        row[header] = cell.v
        hasData = true
      } else {
        row[header] = ""
      }
    }

    if (hasData) {
      rows.push(row)
    }
  }

  return { headers, rows, headerRowIndex }
}

/**
 * Determine if headers indicate a search terms sheet
 */
function isSearchTermsSheet(headers: string[]): boolean {
  const searchTermsIndicators = ["Search_Term", "Volume", "Growth_180", "Growth_90", "Top_Clicked_Product"]
  return searchTermsIndicators.some((indicator) => headers.some((header) => header.includes(indicator)))
}

/**
 * Determine if headers indicate a niche insights sheet
 */
function isNicheInsightsSheet(headers: string[]): boolean {
  const insightsIndicators = ["Insight_Category", "Insight", "Relevance_Score", "Supporting_Keywords"]
  return insightsIndicators.some((indicator) => headers.some((header) => header.includes(indicator)))
}

/**
 * Determine if headers indicate a products sheet
 */
function isProductsSheet(headers: string[]): boolean {
  const productsIndicators = ["Product_Name", "ASIN", "Brand", "Price", "Rating", "Review_Count", "BSR"]
  return productsIndicators.some((indicator) => headers.some((header) => header.includes(indicator)))
}

/**
 * Process a single CSV file for Level 2 data
 * Detects the type of data based on headers
 */
function processCSV(rows: any[]): {
  searchTerms: ParseResult<Level2SearchTermData>
  nicheInsights: ParseResult<Level2NicheInsightData>
  products: ParseResult<Level2ProductData>
  headerInfo: string
} {
  // Initialize results
  const result: {
    searchTerms: ParseResult<Level2SearchTermData>
    nicheInsights: ParseResult<Level2NicheInsightData>
    products: ParseResult<Level2ProductData>
    headerInfo: string
  } = {
    searchTerms: { data: [], errors: [] },
    nicheInsights: { data: [], errors: [] },
    products: { data: [], errors: [] },
    headerInfo: "",
  }

  // Check if this is empty
  if (rows.length === 0) {
    result.headerInfo = "No data rows found in CSV"
    return result
  }

  // Get headers from the first row
  const headers = Object.keys(rows[0])
  result.headerInfo = `CSV headers: ${headers.join(", ")}\n`

  // Determine the type of data based on headers
  if (isSearchTermsSheet(headers)) {
    const processed = processSearchTerms(rows)
    result.searchTerms = processed
    result.headerInfo += `Processed as Search Terms: ${processed.data.length} valid rows, ${processed.errors.length} errors\n`
    return result
  }

  if (isProductsSheet(headers)) {
    const processed = processProducts(rows)
    result.products = processed
    result.headerInfo += `Processed as Products: ${processed.data.length} valid rows, ${processed.errors.length} errors\n`
    return result
  }

  if (isNicheInsightsSheet(headers)) {
    const processed = processNicheInsights(rows)
    result.nicheInsights = processed
    result.headerInfo += `Processed as Niche Insights: ${processed.data.length} valid rows, ${processed.errors.length} errors\n`
    return result
  }

  // If we can't determine the type, try all processors
  result.headerInfo += "Sheet type unclear, trying all processors\n"

  const searchTermsResult = processSearchTerms(rows)
  const nicheInsightsResult = processNicheInsights(rows)
  const productsResult = processProducts(rows)

  // Use the one with the most valid data
  if (
    searchTermsResult.data.length > 0 &&
    searchTermsResult.data.length >= nicheInsightsResult.data.length &&
    searchTermsResult.data.length >= productsResult.data.length
  ) {
    result.searchTerms = searchTermsResult
    result.headerInfo += `Processed as Search Terms: ${searchTermsResult.data.length} valid rows\n`
  } else if (nicheInsightsResult.data.length > 0 && nicheInsightsResult.data.length >= productsResult.data.length) {
    result.nicheInsights = nicheInsightsResult
    result.headerInfo += `Processed as Niche Insights: ${nicheInsightsResult.data.length} valid rows\n`
  } else if (productsResult.data.length > 0) {
    result.products = productsResult
    result.headerInfo += `Processed as Products: ${productsResult.data.length} valid rows\n`
  } else {
    result.headerInfo += `Could not process CSV as any known type\n`
  }

  return result
}

/**
 * Process search terms data with more lenient validation
 */
function processSearchTerms(data: any[]): ParseResult<Level2SearchTermData> {
  const processed: Level2SearchTermData[] = []
  const errors: string[] = []

  for (const item of data) {
    try {
      const processedItem: Level2SearchTermData = {
        Search_Term: String(item.Search_Term || item.search_term || item.term || ""),
        Volume: Number(item.Volume || item.volume || 0),
        Growth_90: item.Growth_90 || item.growth_90 ? Number(item.Growth_90 || item.growth_90) : undefined,
        Growth_180: item.Growth_180 || item.growth_180 ? Number(item.Growth_180 || item.growth_180) : undefined,
        Click_Share: item.Click_Share || item.click_share ? Number(item.Click_Share || item.click_share) : undefined,
        Conversion_Rate: item.Conversion_Rate || item.conversion_rate ? Number(item.Conversion_Rate || item.conversion_rate) : undefined,
        Format_Inferred: item.Format_Inferred || item.format_inferred || undefined,
        Function_Inferred: item.Function_Inferred || item.function_inferred || undefined,
        Top_Clicked_Product_1_ASIN: item.Top_Clicked_Product_1_ASIN || item.top_clicked_product_1_asin || undefined,
        Top_Clicked_Product_2_ASIN: item.Top_Clicked_Product_2_ASIN || item.top_clicked_product_2_asin || undefined,
        Top_Clicked_Product_3_ASIN: item.Top_Clicked_Product_3_ASIN || item.top_clicked_product_3_asin || undefined
      }
      processed.push(processedItem)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error processing search term: ${errorMessage}`)
    }
  }

  return { data: processed, errors }
}

/**
 * Process niche insights data with more lenient validation
 */
function processNicheInsights(data: any[]): ParseResult<Level2NicheInsightData> {
  const processed: Level2NicheInsightData[] = []
  const errors: string[] = []

  for (const item of data) {
    try {
      const processedItem: Level2NicheInsightData = {
        Insight_Category: String(item.Insight_Category || item.insight_category || item.category || ""),
        Insight: String(item.Insight || item.insight || ""),
        Relevance_Score: item.Relevance_Score || item.relevance_score ? Number(item.Relevance_Score || item.relevance_score) : undefined,
        Supporting_Keywords: item.Supporting_Keywords || item.supporting_keywords || undefined,
        Notes: item.Notes || item.notes || undefined
      }
      processed.push(processedItem)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error processing niche insight: ${errorMessage}`)
    }
  }

  return { data: processed, errors }
}

/**
 * Process products data with more lenient validation
 */
function processProducts(data: any[]): ParseResult<Level2ProductData> {
  const processed: Level2ProductData[] = []
  const errors: string[] = []

  for (const item of data) {
    try {
      const processedItem: Level2ProductData = {
        ASIN: item.ASIN || item.asin || undefined,
        Product_Name: String(item.Product_Name || item.product_name || item.name || ""),
        Brand: item.Brand || item.brand || undefined,
        Price: item.Price || item.price ? Number(item.Price || item.price) : undefined,
        Rating: item.Rating || item.rating ? Number(item.Rating || item.rating) : undefined,
        Review_Count: item.Review_Count || item.review_count ? Number(item.Review_Count || item.review_count) : undefined,
        Market_Share: item.Market_Share || item.market_share ? Number(item.Market_Share || item.market_share) : undefined,
        Sales_Estimate: item.Sales_Estimate || item.sales_estimate ? Number(item.Sales_Estimate || item.sales_estimate) : undefined,
        Niche_Click_Count: item.Niche_Click_Count || item.niche_click_count ? Number(item.Niche_Click_Count || item.niche_click_count) : undefined,
        BSR: item.BSR || item.bsr ? Number(item.BSR || item.bsr) : undefined,
        Click_Share: item.Click_Share || item.click_share ? Number(item.Click_Share || item.click_share) : undefined
      }
      processed.push(processedItem)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error processing product: ${errorMessage}`)
    }
  }

  return { data: processed, errors }
}

/**
 * Map data to Level 1 schema with more lenient validation
 */
export function mapToLevel1Schema(data: any[]): { data: Level1Data[]; errors: string[] } {
  const validData: Level1Data[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip rows that are clearly not data (e.g., empty rows or headers)
      if (!row["Customer Need"]) {
        continue
      }

      // Debug raw row data
      console.log(`Processing Level 1 row ${i}:`, row)

      // Try to map the data to our schema
      const mappedRow: any = {} // Use any type to allow for additional fields

      // Map Customer_Need
      mappedRow.Customer_Need = String(row["Customer Need"] || "")

      // Map Search_Volume - ensure it's a number
      mappedRow.Search_Volume = parseNumberValue(row["Search Volume (Past 360 days)"])

      // Map Search_Volume_Growth - use 180 days growth if available
      mappedRow.Search_Volume_Growth = parseNumberValue(row["Search Volume Growth (Past 180 days)"])

      // Map Click_Share and Conversion_Rate with defaults
      mappedRow.Click_Share = 0.5 // Default value
      mappedRow.Conversion_Rate = 0.1 // Default value

      // Map Units_Sold - use lower bound if available
      mappedRow.Units_Sold = parseNumberValue(row["Units Sold Lower Bound (Past 360 days)"])

      // Map Brand_Concentration - use a proxy from Top_Clicked_Products
      const numProducts = parseNumberValue(row["# of Top Clicked Products"])
      mappedRow.Brand_Concentration = numProducts ? Math.min(1, 10 / numProducts) : 0.5

      // Map Notes
      mappedRow.Notes = ""

      // Skip rows with empty Customer_Need
      if (!mappedRow.Customer_Need) {
        console.log(`Skipping row ${i}: Empty customer need`)
        continue
      }

      // Add additional fields that aren't in the schema but we want to keep
      const additionalFields = {
        Search_Volume_Growth_180: parseNumberValue(row["Search Volume Growth (Past 180 days)"]),
        Search_Volume_90: parseNumberValue(row["Search Volume (Past 90 days)"]),
        Search_Volume_Growth_90: parseNumberValue(row["Search Volume Growth (Past 90 days)"]),
        Top_Clicked_Products: parseNumberValue(row["# of Top Clicked Products"]),
        Top_Search_Term_1: row["Top Search Term 1"] || "",
        Top_Search_Term_2: row["Top Search Term 2"] || "",
        Top_Search_Term_3: row["Top Search Term 3"] || "",
        Average_Price: parseNumberValue(row["Average Price (USD)"]),
        Min_Price: parseNumberValue(row["Minimum Price (Past 360 days) (USD)"]),
        Max_Price: parseNumberValue(row["Maximum Price (Past 360 days) (USD)"]),
        Return_Rate: parseNumberValue(row["Return Rate (Past 360 days)"])
      }

      // Debug additional fields
      console.log(`Additional fields for Level 1 row ${i}:`, additionalFields)

      try {
        // Validate with Zod schema
        const validatedRow = Level1Schema.parse(mappedRow)

        // Combine validated row with additional fields
        const finalRow = {
          ...validatedRow,
          ...additionalFields,
        }

        validData.push(finalRow as Level1Data)
        console.log(`Row ${i} validated successfully`)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const rowErrors = validationError.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
          errors.push(...rowErrors)
          console.log(`Row ${i} validation errors:`, rowErrors)
        } else {
          errors.push(`Row ${i + 1}: Validation error - ${(validationError as Error).message}`)
          console.log(`Row ${i} validation error:`, validationError)
        }
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      console.log(`Row ${i} processing error:`, error)
    }
  }

  console.log(`Processed ${data.length} Level 1 rows, found ${validData.length} valid entries`)
  return { data: validData, errors }
}

/**
 * Map data to Level 3 schema with more lenient validation
 */
export function mapToLevel3Schema(data: any[]): { data: Level3Data[]; errors: string[] } {
  const validData: Level3Data[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip rows that are clearly not data
      if (!row.ASIN && !row.asin && !row.Keyword && !row.keyword) {
        continue
      }

      // Debug raw row data
      console.log(`Processing Level 3 row ${i}:`, row)

      // Convert string values to appropriate types
      const processedRow = {
        ASIN: String(row.ASIN || row.asin || ""),
        Keyword: String(row.Keyword || row.keyword || ""),
        Search_Volume: parseNumberValue(row.Search_Volume || row.search_volume || 0) || 0,
        ABA_Click_Share: parseNumberValue(row.ABA_Click_Share || row.aba_click_share || 0) || 0,
        Conversion_Share: parseNumberValue(row.Conversion_Share || row.conversion_share || 0) || 0,
        Organic_Rank: parseNumberValue(row.Organic_Rank || row.organic_rank) || null,
        Sponsored_Rank: parseNumberValue(row.Sponsored_Rank || row.sponsored_rank) || null,
        Keyword_Sales: parseNumberValue(row.Keyword_Sales || row.keyword_sales || 0) || 0,
      }

      // Debug processed row
      console.log(`Processed Level 3 row:`, processedRow)

      // Skip rows with empty ASIN or Keyword
      if (!processedRow.ASIN || !processedRow.Keyword) {
        console.log(`Skipping row ${i}: Empty ASIN or keyword`)
        continue
      }

      // Validate with Zod schema
      try {
        const validatedRow = Level3Schema.parse(processedRow)
        validData.push(validatedRow)
        console.log(`Row ${i} validated successfully`)
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const rowErrors = validationError.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
          errors.push(...rowErrors)
          console.log(`Row ${i} validation errors:`, rowErrors)
        } else {
          errors.push(`Row ${i + 1}: ${(validationError as Error).message}`)
          console.log(`Row ${i} validation error:`, validationError)
        }
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      console.log(`Row ${i} processing error:`, error)
    }
  }

  console.log(`Processed ${data.length} Level 3 rows, found ${validData.length} valid entries`)
  return { data: validData, errors }
}

/**
 * Parse and process a file for Level 1 data
 */
export async function parseLevel1Data(file: File): Promise<{
  data: Level1Data[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const fileType = detectFileType(file.name)
    let rows: any[] = []
    let headerInfo = `File type: ${fileType}\n`

    if (fileType === "csv") {
      const csvText = await parseCSVAsText(file)
      const { headers, rows: csvRows, headerRowIndex } = parseCSV(csvText)
      rows = csvRows
      headerInfo += `CSV header row detected at line ${headerRowIndex + 1}\n`
      headerInfo += `CSV headers detected: ${headers.join(", ")}\n`
    } else {
      const buffer = await parseFile(file)
      const { headers, rows: excelRows, headerRowIndex } = processExcel(buffer)
      rows = excelRows
      headerInfo += `Excel header row detected at row ${headerRowIndex + 1}\n`
      headerInfo += `Excel headers detected: ${headers.join(", ")}\n`
    }

    // Map the raw data to our schema
    const { data: validData, errors } = mapToLevel1Schema(rows)

    headerInfo += `Processed ${rows.length} rows, found ${validData.length} valid entries\n`
    if (errors.length > 0) {
      headerInfo += `Found ${errors.length} validation errors\n`
      // Include first 5 errors in header info
      const firstErrors = errors.slice(0, 5)
      headerInfo += `First errors: ${firstErrors.join("; ")}\n`
    }

    return { data: validData, errors, headerInfo }
  } catch (error) {
    console.error("Error parsing Level 1 data:", error)
    return {
      data: [],
      errors: [(error as Error).message || "Failed to parse Level 1 data"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

/**
 * Parse and process a file for Level 2 data
 */
export async function parseLevel2Data(file: File): Promise<{
  searchTerms: { data: any[]; errors: string[] }
  nicheInsights: { data: any[]; errors: string[] }
  products: { data: any[]; errors: string[] }
  headerInfo: string
  sheetNames?: string[]
}> {
  try {
    const fileType = detectFileType(file.name)
    let headerInfo = `File type: ${fileType}\n`
    let result: {
      searchTerms: { data: any[]; errors: string[] }
      nicheInsights: { data: any[]; errors: string[] }
      products: { data: any[]; errors: string[] }
      headerInfo?: string
      sheetNames?: string[]
    }

    if (fileType === "csv") {
      const csvText = await parseCSVAsText(file)
      const { headers, rows, headerRowIndex } = parseCSV(csvText)
      headerInfo += `CSV header row detected at line ${headerRowIndex + 1}\n`
      headerInfo += `CSV headers detected: ${headers.join(", ")}\n`

      // Process the CSV for Level 2 data
      const csvResult = processCSV(rows)
      result = {
        searchTerms: csvResult.searchTerms,
        nicheInsights: csvResult.nicheInsights,
        products: csvResult.products,
      }
      headerInfo += csvResult.headerInfo
    } else {
      const buffer = await parseFile(file)
      result = processExcelWorkbook(buffer)
      headerInfo += result.headerInfo || ""
    }

    // Add processing summary to header info
    headerInfo += `
Processing summary:
- Search Terms: ${result.searchTerms.data.length} rows (${result.searchTerms.errors.length} errors)
- Niche Insights: ${result.nicheInsights.data.length} rows (${result.nicheInsights.errors.length} errors)
- Products: ${result.products.data.length} rows (${result.products.errors.length} errors)
`

    return { ...result, headerInfo }
  } catch (error) {
    console.error("Error parsing Level 2 data:", error)
    return {
      searchTerms: { data: [], errors: [(error as Error).message] },
      nicheInsights: { data: [], errors: [] },
      products: { data: [], errors: [] },
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

/**
 * Parse and process a file for Level 3 data
 */
export async function parseLevel3Data(file: File): Promise<{
  data: Level3Data[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const fileType = detectFileType(file.name)
    let rows: any[] = []
    let headerInfo = `File type: ${fileType}\n`

    if (fileType === "csv") {
      const csvText = await parseCSVAsText(file)
      const { headers, rows: csvRows, headerRowIndex } = parseCSV(csvText)
      rows = csvRows
      headerInfo += `CSV header row detected at line ${headerRowIndex + 1}\n`
      headerInfo += `CSV headers detected: ${headers.join(", ")}\n`
    } else {
      const buffer = await parseFile(file)
      const { headers, rows: excelRows, headerRowIndex } = processExcel(buffer)
      rows = excelRows
      headerInfo += `Excel header row detected at row ${headerRowIndex + 1}\n`
      headerInfo += `Excel headers detected: ${headers.join(", ")}\n`
    }

    // Map the raw data to our schema
    const { data: validData, errors } = mapToLevel3Schema(rows)

    headerInfo += `Processed ${rows.length} rows, found ${validData.length} valid entries\n`
    if (errors.length > 0) {
      headerInfo += `Found ${errors.length} validation errors\n`
      // Include first 5 errors in header info
      const firstErrors = errors.slice(0, 5)
      headerInfo += `First errors: ${firstErrors.join("; ")}\n`
    }

    return { data: validData, errors, headerInfo }
  } catch (error) {
    console.error("Error parsing Level 3 data:", error)
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
export async function fetchAndParseCSV(url: string): Promise<{
  data: any[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
    }

    const csvText = await response.text()
    const { headers, rows, headerRowIndex } = parseCSV(csvText)

    const headerInfo = `
CSV fetched from URL
Header row detected at line ${headerRowIndex + 1}
Headers detected: ${headers.join(", ")}
Rows found: ${rows.length}
`

    return {
      data: rows,
      errors: [],
      headerInfo,
    }
  } catch (error) {
    console.error("Error fetching and parsing CSV:", error)
    return {
      data: [],
      errors: [(error as Error).message || "Failed to fetch and parse CSV"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}

/**
 * Parse Level 1 data from a URL
 */
export async function parseLevel1FromURL(url: string): Promise<{
  data: Level1Data[]
  errors: string[]
  headerInfo: string
}> {
  try {
    const { data: rows, errors: fetchErrors, headerInfo: fetchInfo } = await fetchAndParseCSV(url)

    if (fetchErrors.length > 0) {
      return {
        data: [],
        errors: fetchErrors,
        headerInfo: fetchInfo,
      }
    }

    // Map the raw data to our schema
    const { data: validData, errors } = mapToLevel1Schema(rows)

    const headerInfo = `
${fetchInfo}
Processed ${rows.length} rows, found ${validData.length} valid entries
${errors.length > 0 ? `Found ${errors.length} validation errors` : ""}
`

    return { data: validData, errors, headerInfo }
  } catch (error) {
    console.error("Error parsing Level 1 data from URL:", error)
    return {
      data: [],
      errors: [(error as Error).message || "Failed to parse Level 1 data from URL"],
      headerInfo: `Error: ${(error as Error).message}`,
    }
  }
}
