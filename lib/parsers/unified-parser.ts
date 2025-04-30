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
import { ParseResult } from '../types'
import * as Papa from 'papaparse'
import { normalizeHeader, normalizeHeaders, extractMetadata } from './header-normalizer'

/**
 * Parse file into ArrayBuffer
 */
export async function parseFile(file: File): Promise<ArrayBuffer> {
  // Check if we're in a browser or server environment
  if (typeof FileReader !== 'undefined') {
    // Browser environment
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
  } else {
    // Server environment
    const buffer = await file.arrayBuffer()
    return buffer
  }
}

/**
 * Parse CSV file as text
 */
export async function parseCSVAsText(file: File): Promise<string> {
  // Check if we're in a browser or server environment
  if (typeof FileReader !== 'undefined') {
    // Browser environment
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
  } else {
    // Server environment
    const buffer = await file.arrayBuffer()
    const text = new TextDecoder().decode(buffer)
    return text
  }
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
    return isNaN(value) ? undefined : value
  }

  // Convert to string and trim
  const strValue = String(value).trim()

  // Handle empty string
  if (strValue === "") {
    return undefined
  }
  
  // Handle "N/A", "-", "null", etc.
  if (["n/a", "na", "-", "null", "undefined"].includes(strValue.toLowerCase())) {
    return undefined
  }

  // Handle percentage values (e.g., "25%")
  if (strValue.endsWith("%")) {
    const percentValue = strValue.replace("%", "").trim()
    try {
    const result = Number.parseFloat(percentValue) / 100
      return isNaN(result) ? undefined : result
    } catch (e) {
      console.log(`Failed to parse percentage: ${strValue}`)
      return undefined
    }
  }

  // Handle numbers with commas (e.g., "1,000") and potentially other separators
  const cleanedValue = strValue.replace(/,/g, "").replace(/\s/g, "")

  // Parse as float
  try {
  const parsedValue = Number.parseFloat(cleanedValue)

  // Return undefined if NaN
  if (isNaN(parsedValue)) {
    console.log(`Failed to parse number: ${originalValue}`)
    return undefined
  }

  return parsedValue
  } catch (e) {
    console.log(`Exception parsing number: ${originalValue}`)
    return undefined
  }
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
export function parseCSV(csvText: string): { headers: string[]; rows: any[]; headerRowIndex: number; metadata: Record<string, string> } {
  // Split by lines
  const lines = csvText.trim().split(/\r?\n/)

  if (lines.length === 0) {
    return { headers: [], rows: [], headerRowIndex: -1, metadata: {} }
  }

  // Extract metadata and find where data starts
  const { metadata, dataStartIndex } = extractMetadata(csvText)
  
  // Find the header row
  const { headerRowIndex, headers: rawHeaders } = findHeaderRow(lines.slice(dataStartIndex))
  const actualHeaderRowIndex = headerRowIndex + dataStartIndex;

  // Handle duplicate headers and special cases before normalization
  let processedHeaders = [...rawHeaders];
  
  // Check for duplicate search_volume_growth or growth columns
  const growthIndices = processedHeaders.reduce((acc, header, index) => {
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('growth') && (lowerHeader.includes('90') || lowerHeader.includes('180') || 
        lowerHeader.includes('three month') || lowerHeader.includes('six month'))) {
      acc.push({index, header, value: lowerHeader});
    }
    return acc;
  }, [] as {index: number, header: string, value: string}[]);
  
  // If we found multiple growth columns, specifically name them
  if (growthIndices.length >= 2) {
    growthIndices.forEach(({index, header, value}) => {
      // Determine if this is 90-day or 180-day growth
      if (value.includes('90') || value.includes('three month')) {
        processedHeaders[index] = 'Growth_90';
      } else if (value.includes('180') || value.includes('six month')) {
        processedHeaders[index] = 'Growth_180';
      }
    });
  }
  
  // Handle product columns
  const productIndices = processedHeaders.reduce((acc, header, index) => {
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('product') || lowerHeader.includes('asin')) {
      acc.push({index, header, value: lowerHeader});
    }
    return acc;
  }, [] as {index: number, header: string, value: string}[]);
  
  // Group product columns
  if (productIndices.length > 0) {
    // Find patterns to determine if a column is a title or ASIN
    productIndices.forEach(({index, header, value}) => {
      if (value.includes('title')) {
        // This is definitely a title column
        const productNum = value.includes('1') ? '1' : value.includes('2') ? '2' : value.includes('3') ? '3' : '';
        if (productNum) {
          processedHeaders[index] = `Top_Clicked_Product_${productNum}_Title`;
        }
      } else if (value.includes('asin')) {
        // This is definitely an ASIN column
        const productNum = value.includes('1') ? '1' : value.includes('2') ? '2' : value.includes('3') ? '3' : '';
        if (productNum) {
          processedHeaders[index] = `Top_Clicked_Product_${productNum}_ASIN`;
        }
      } else {
        // Need to determine based on position if this is missing explicit title/asin
        // For now, assume Title if it's not explicitly marked
        const productNum = value.includes('1') ? '1' : value.includes('2') ? '2' : value.includes('3') ? '3' : '';
        if (productNum) {
          processedHeaders[index] = `Top_Clicked_Product_${productNum}_Title`;
        }
      }
    });
  }

  // Normalize the headers after our preprocessing
  const headers = normalizeHeaders(processedHeaders, 'Level2SearchTerms');
  console.log("Original headers:", rawHeaders);
  console.log("Processed headers:", processedHeaders);
  console.log("Normalized headers:", headers);

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

  return { headers, rows, headerRowIndex: actualHeaderRowIndex, metadata }
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
  const searchTermKeywords = ["search_term", "search term", "searchterm", "keyword", "term"];
  const volumeKeywords = ["volume", "search volume", "search_volume"];
  
  // Convert headers to lowercase for case-insensitive matching
  const lowercaseHeaders = headers.map(h => h.toLowerCase());
  
  // Check if we have at least one search term indicator and one volume indicator
  const hasSearchTermIndicator = searchTermKeywords.some(keyword => 
    lowercaseHeaders.some(header => header.includes(keyword))
  );
  
  const hasVolumeIndicator = volumeKeywords.some(keyword => 
    lowercaseHeaders.some(header => header.includes(keyword))
  );
  
  return hasSearchTermIndicator && hasVolumeIndicator;
}

/**
 * Determine if headers indicate a niche insights sheet
 */
function isNicheInsightsSheet(headers: string[]): boolean {
  const insightsIndicators = ["insight_category", "insight category", "insight", "relevance_score", "relevance score", "supporting_keywords", "supporting keywords"]
  
  // Convert headers to lowercase for case-insensitive matching
  const lowercaseHeaders = headers.map(h => h.toLowerCase());
  
  return insightsIndicators.some(indicator => 
    lowercaseHeaders.some(header => header.includes(indicator))
  );
}

/**
 * Determine if headers indicate a products sheet
 */
function isProductsSheet(headers: string[]): boolean {
  // Key indicators that would indicate this is a products sheet
  const productNameKeywords = ["product_name", "product name", "productname", "title", "item name", "item_name"];
  const productIdentifierKeywords = ["asin", "sku", "product_id", "product id", "productid"];
  const productMetricsKeywords = ["brand", "price", "rating", "review", "bsr", "best seller rank", "sales rank"];
  
  // Convert headers to lowercase for case-insensitive matching
  const lowercaseHeaders = headers.map(h => h.toLowerCase());
  
  // Check for product name indicators
  const hasProductNameIndicator = productNameKeywords.some(keyword => 
    lowercaseHeaders.some(header => header.includes(keyword))
  );
  
  // Check for product identifier indicators
  const hasProductIdentifierIndicator = productIdentifierKeywords.some(keyword => 
    lowercaseHeaders.some(header => header.includes(keyword))
  );
  
  // Check for product metrics indicators
  const hasProductMetricsIndicator = productMetricsKeywords.some(keyword => 
    lowercaseHeaders.some(header => header.includes(keyword))
  );
  
  // We need at least a product name indicator plus either an identifier or metrics indicator
  return hasProductNameIndicator && (hasProductIdentifierIndicator || hasProductMetricsIndicator);
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

  // Process with all processors for full coverage
  const searchTermsResult = processSearchTerms(rows)
  const nicheInsightsResult = processNicheInsights(rows)
  const productsResult = processProducts(rows)

  // Add result details to headerInfo
  result.headerInfo += `Found ${searchTermsResult.data.length} search terms (${searchTermsResult.errors.length} errors)\n`
  result.headerInfo += `Found ${nicheInsightsResult.data.length} niche insights (${nicheInsightsResult.errors.length} errors)\n`
  result.headerInfo += `Found ${productsResult.data.length} products (${productsResult.errors.length} errors)\n`

  // Determine the primary file type based on data counts, but keep all valid data
  if (isSearchTermsSheet(headers) && searchTermsResult.data.length > 0) {
    result.headerInfo += `Identified as Search Terms file (${searchTermsResult.data.length} rows)\n`
  } else if (isProductsSheet(headers) && productsResult.data.length > 0) {
    result.headerInfo += `Identified as Products file (${productsResult.data.length} rows)\n`
  } else if (isNicheInsightsSheet(headers) && nicheInsightsResult.data.length > 0) {
    result.headerInfo += `Identified as Niche Insights file (${nicheInsightsResult.data.length} rows)\n`
  } else {
    // If type detection based on headers fails, determine by data count
    if (searchTermsResult.data.length > 0 && 
    searchTermsResult.data.length >= nicheInsightsResult.data.length &&
        searchTermsResult.data.length >= productsResult.data.length) {
      result.headerInfo += `Determined as Search Terms file by data count (${searchTermsResult.data.length} rows)\n`
    } else if (productsResult.data.length > 0 &&
               productsResult.data.length >= searchTermsResult.data.length &&
               productsResult.data.length >= nicheInsightsResult.data.length) {
      result.headerInfo += `Determined as Products file by data count (${productsResult.data.length} rows)\n`
    } else if (nicheInsightsResult.data.length > 0) {
      result.headerInfo += `Determined as Niche Insights file by data count (${nicheInsightsResult.data.length} rows)\n`
    } else {
      result.headerInfo += `Could not determine file type (no valid data found)\n`
    }
  }

  // Always include all valid data in the result
    result.searchTerms = searchTermsResult
    result.nicheInsights = nicheInsightsResult
    result.products = productsResult

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
      // Debug raw values - important for troubleshooting
      console.log("Processing search term row:", item)
      console.log("Available keys:", Object.keys(item))

      // Find search term using possible field names
      const searchTermField = findField(item, [
        "Search_Term", "search_term", "Search Term", "SearchTerm", 
        "Keyword", "keyword", "Term", "term", "Query", "query"
      ]);

      // Extract search volume more carefully
      const volumeRaw = findField(item, [
        "Search_Volume", "search_volume", "Search Volume", "Volume", 
        "volume", "Monthly Volume", "monthly_volume", "Searches", "searches"
      ]);
      
      let volume = 0;
      if (volumeRaw !== undefined) {
        const parsedVolume = parseNumberValue(volumeRaw);
        volume = parsedVolume !== undefined ? parsedVolume : 0;
      }

      // Handle cases where volume might be a string with commas or other formatting
      if (typeof volume === 'string') {
        const numValue = String(volume).replace(/,/g, '');
        volume = Number(numValue);
        if (isNaN(volume)) volume = 0;
      }

      // Find growth data - expanded lookup to catch more variations
      const growth90Raw = findField(item, [
        "Growth_90", "Growth90", "growth_90", "Growth (90d)", "growth_90d", "growth_90D",
        "Growth (90 Days)", "Growth (90 days)", "90d Growth", "90-day Growth", "growth (90d)",
        "search_volume_growth_90d", "90 Day Growth", "90d_growth", "90d growth",
        "Three Month Growth", "three_month_growth", "Three month growth", 
        "Growth 90", "growth 90", "90d", "90D", "90 day", "90 days", "growth90", "growth90d"
      ]);
      
      const growth180Raw = findField(item, [
        "Growth_180", "Growth180", "growth_180", "Growth (180d)", "growth_180d", "growth_180D",
        "Growth (180 Days)", "Growth (180 days)", "180d Growth", "180-day Growth", "growth (180d)",
        "search_volume_growth_180d", "180 Day Growth", "180d_growth", "180d growth",
        "Six Month Growth", "six_month_growth", "Six month growth",
        "Growth 180", "growth 180", "180d", "180D", "180 day", "180 days", "growth180", "growth180d"
      ]);
      
      // Log raw growth values for debugging
      console.log("Growth 90 Raw Value:", growth90Raw);
      console.log("Growth 180 Raw Value:", growth180Raw);
      
      // Parse them to numbers
      const growth90 = parseNumberValue(growth90Raw);
      const growth180 = parseNumberValue(growth180Raw);
      
      // Log the parsed numeric growth values
      console.log("Growth 90 Parsed Value:", growth90);
      console.log("Growth 180 Parsed Value:", growth180);

      // Find click share
      const clickShareRaw = findField(item, [
        "Click_Share", "click_share", "Click Share", "CTR", "ctr", 
        "Click Through Rate", "click_through_rate"
      ]);
      const clickShare = parseNumberValue(clickShareRaw);

      // Find conversion rate
      const conversionRateRaw = findField(item, [
        "Conversion_Rate", "conversion_rate", "Conversion Rate", "ConversionRate", 
        "Conversion", "conversion", "CVR", "cvr", "search_conversion_rate"
      ]);
      const conversionRate = parseNumberValue(conversionRateRaw);

      // Find format
      const formatField = findField(item, [
        "Format", "format", "Format_Inferred", "format_inferred", "Format Inferred",
        "Product Format", "product_format", "Item Format", "item_format"
      ]);

      // Find function
      const functionField = findField(item, [
        "Function", "function", "Function_Inferred", "function_inferred", "Function Inferred",
        "Product Function", "product_function", "Item Function", "item_function"
      ]);

      // Find values
      const valuesField = findField(item, [
        "Values", "values", "Values_Inferred", "values_inferred", "Values Inferred",
        "Product Values", "product_values", "Item Values", "item_values"
      ]);

      // Find competition
      const competitionRaw = findField(item, [
        "Competition", "competition", "Difficulty", "difficulty", 
        "Competitive Score", "competitive_score"
      ]);
      const competition = parseNumberValue(competitionRaw);

      // More robust product field detection - try both title and non-title variations
      // Find top clicked products ASINs
      const topProduct1ASIN = findField(item, [
        "Top_Clicked_Product_1_ASIN", "top_clicked_product_1_asin", "Top Clicked Product 1 ASIN",
        "Top Product 1 ASIN", "top_product_1_asin", "Top ASIN 1", "top_asin_1",
        "Product 1 ASIN", "product_1_asin", "ASIN 1", "asin_1", "Product1ASIN"
      ]);

      const topProduct2ASIN = findField(item, [
        "Top_Clicked_Product_2_ASIN", "top_clicked_product_2_asin", "Top Clicked Product 2 ASIN",
        "Top Product 2 ASIN", "top_product_2_asin", "Top ASIN 2", "top_asin_2",
        "Product 2 ASIN", "product_2_asin", "ASIN 2", "asin_2", "Product2ASIN"
      ]);

      const topProduct3ASIN = findField(item, [
        "Top_Clicked_Product_3_ASIN", "top_clicked_product_3_asin", "Top Clicked Product 3 ASIN",
        "Top Product 3 ASIN", "top_product_3_asin", "Top ASIN 3", "top_asin_3",
        "Product 3 ASIN", "product_3_asin", "ASIN 3", "asin_3", "Product3ASIN"
      ]);

      // Find top clicked products titles with more variations
      const topProduct1Title = findField(item, [
        "Top_Clicked_Product_1_Title", "top_clicked_product_1_title", "Top_Clicked_Product_1",
        "top_clicked_product_1", "Top Clicked Product 1 Title", "Top Clicked Product 1",
        "Top Product 1 Title", "top_product_1_title", "Top Title 1", "top_title_1",
        "Product 1 Title", "product_1_title", "Title 1", "title_1", "Product1Title",
        "Product 1", "product_1", "Product1", "Top1"
      ]);

      const topProduct2Title = findField(item, [
        "Top_Clicked_Product_2_Title", "top_clicked_product_2_title", "Top_Clicked_Product_2",
        "top_clicked_product_2", "Top Clicked Product 2 Title", "Top Clicked Product 2",
        "Top Product 2 Title", "top_product_2_title", "Top Title 2", "top_title_2",
        "Product 2 Title", "product_2_title", "Title 2", "title_2", "Product2Title",
        "Product 2", "product_2", "Product2", "Top2"
      ]);

      const topProduct3Title = findField(item, [
        "Top_Clicked_Product_3_Title", "top_clicked_product_3_title", "Top_Clicked_Product_3",
        "top_clicked_product_3", "Top Clicked Product 3 Title", "Top Clicked Product 3",
        "Top Product 3 Title", "top_product_3_title", "Top Title 3", "top_title_3",
        "Product 3 Title", "product_3_title", "Title 3", "title_3", "Product3Title",
        "Product 3", "product_3", "Product3", "Top3"
      ]);
      
      // Log found product fields for debugging
      console.log("Top Product 1 Title:", topProduct1Title);
      console.log("Top Product 2 Title:", topProduct2Title);
      console.log("Top Product 3 Title:", topProduct3Title);

      const processedItem: Level2SearchTermData = {
        Search_Term: searchTermField ? String(searchTermField) : "",
        Volume: volume,
        Growth_90: growth90,
        Growth_180: growth180,
        Click_Share: clickShare || 0,
        Conversion_Rate: conversionRate,
        Format_Inferred: formatField,
        Function_Inferred: functionField,
        Values_Inferred: valuesField,
        Competition: competition,
        Top_Clicked_Product_1_ASIN: topProduct1ASIN,
        Top_Clicked_Product_2_ASIN: topProduct2ASIN,
        Top_Clicked_Product_3_ASIN: topProduct3ASIN,
        Top_Clicked_Product_1_Title: topProduct1Title ? String(topProduct1Title) : undefined,
        Top_Clicked_Product_2_Title: topProduct2Title ? String(topProduct2Title) : undefined,
        Top_Clicked_Product_3_Title: topProduct3Title ? String(topProduct3Title) : undefined
      }

      // Skip items without a search term
      if (!processedItem.Search_Term) {
        console.log("Skipping search term row: Missing search term");
        continue;
      }

      // Debug processed values
      console.log("Processed search term:", processedItem)

      // Validate the processed item
      const validationResult = Level2SearchTermDataSchema.safeParse(processedItem)
      if (!validationResult.success) {
        throw new Error(`Validation failed: ${validationResult.error.message}`)
      }

      processed.push(processedItem)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error processing search term: ${errorMessage}`)
      console.error("Error processing row:", error)
    }
  }

  return { data: processed, errors }
}

/**
 * Process data rows as niche insights data
 */
function processNicheInsights(rows: any[]): ParseResult<Level2NicheInsightData> {
  const processed: ParseResult<Level2NicheInsightData> = {
    data: [],
    errors: [],
  }

  // Helper function to find a field with multiple possible names
  function findField(row: any, possibleNames: string[]): string | undefined {
    // Direct exact match first (fastest path)
    for (const name of possibleNames) {
      if (row[name] !== undefined) {
        return row[name]
      }
    }
    
    // Pascal case and snake case variations
    const variations: string[] = [];
    possibleNames.forEach(name => {
      // Add original name
      variations.push(name);
      
      // Add snake_case variation
      if (!name.includes('_')) {
        variations.push(name.replace(/([A-Z])/g, '_$1').toLowerCase());
      }
      
      // Add camelCase variation
      if (name.includes('_')) {
        variations.push(name.replace(/_([a-z])/g, (_, p1) => p1.toUpperCase()));
      }
      
      // Add PascalCase variation
      if (name.includes('_')) {
        const pascalCase = name.split('_').map(part => 
          part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        ).join('');
        variations.push(pascalCase);
      }
      
      // Add lowercase variation
      variations.push(name.toLowerCase());
      
      // Add uppercase variation
      variations.push(name.toUpperCase());
    });
    
    // Try all variations with exact match
    for (const variation of variations) {
      if (row[variation] !== undefined) {
        return row[variation];
      }
    }
    
    // Special handling for fields with known patterns
    const rowKeys = Object.keys(row);
    
    // 1. Growth field pattern matching
    if (possibleNames.some(name => name.includes('Growth_90') || name.includes('growth_90'))) {
      const growth90Pattern = rowKeys.find(key => {
        const lowerKey = key.toLowerCase();
        return (lowerKey.includes('growth') && (lowerKey.includes('90') || lowerKey.includes('three') || lowerKey.includes('3m')));
      });
      
      if (growth90Pattern && row[growth90Pattern] !== undefined) {
        return row[growth90Pattern];
      }
    }
    
    if (possibleNames.some(name => name.includes('Growth_180') || name.includes('growth_180'))) {
      const growth180Pattern = rowKeys.find(key => {
        const lowerKey = key.toLowerCase();
        return (lowerKey.includes('growth') && (lowerKey.includes('180') || lowerKey.includes('six') || lowerKey.includes('6m')));
      });
      
      if (growth180Pattern && row[growth180Pattern] !== undefined) {
        return row[growth180Pattern];
      }
    }
    
    // 2. Product field pattern matching
    for (const num of ['1', '2', '3']) {
      if (possibleNames.some(name => name.includes(`Product_${num}`) || name.includes(`product_${num}`))) {
        // Look for any field containing this product number and the context (title or asin)
        const isTitle = possibleNames.some(name => name.includes('Title') || name.includes('title'));
        const isASIN = possibleNames.some(name => name.includes('ASIN') || name.includes('asin'));
        
        if (isTitle) {
          const titlePattern = rowKeys.find(key => {
            const lowerKey = key.toLowerCase();
            return lowerKey.includes(num) && 
              (lowerKey.includes('product') || lowerKey.includes('item')) && 
              !lowerKey.includes('asin');
          });
          
          if (titlePattern && row[titlePattern] !== undefined) {
            return row[titlePattern];
          }
        }
        
        if (isASIN) {
          const asinPattern = rowKeys.find(key => {
            const lowerKey = key.toLowerCase();
            return lowerKey.includes(num) && 
              (lowerKey.includes('asin') || (lowerKey.includes('product') && lowerKey.includes('id')));
          });
          
          if (asinPattern && row[asinPattern] !== undefined) {
            return row[asinPattern];
          }
        }
      }
    }
    
    // 3. Partial case-insensitive matching as last resort
    const lowerCaseFieldNames = possibleNames.map(name => name.toLowerCase());
    
    for (const key of rowKeys) {
      const lowerKey = key.toLowerCase();
      for (let i = 0; i < lowerCaseFieldNames.length; i++) {
        const fieldName = lowerCaseFieldNames[i];
        // Match if the key includes the field name or vice versa
        if (lowerKey.includes(fieldName) || fieldName.includes(lowerKey)) {
          return row[key];
        }
      }
    }
    
    // 4. Super fuzzy matching - try to find anything with similar words
    const fieldNameWords = possibleNames.flatMap(name => 
      name.toLowerCase().split(/[_\s]/).filter(word => word.length > 3)
    );
    
    if (fieldNameWords.length > 0) {
      for (const key of rowKeys) {
        const keyWords = key.toLowerCase().split(/[_\s]/);
        const matchesAnyWord = fieldNameWords.some(word => 
          keyWords.some(keyWord => keyWord.includes(word) || word.includes(keyWord))
        );
        
        if (matchesAnyWord) {
          return row[key];
        }
      }
    }
    
    // Nothing found
    return undefined;
  }

  // Debug raw data
  console.log("Processing niche insights with raw data:", rows)

  // Process each row
  rows.forEach((row, index) => {
    try {
      // Try to extract niche data with multiple possible field names
      const nameField = findField(row, ['niche', 'category', 'niche name', 'category name', 'name'])
      const volumeField = findField(row, ['volume', 'search volume', 'monthly volume', 'monthly search volume', 'searches'])
      const competitionField = findField(row, ['competition', 'comp', 'competition score', 'comp score', 'competition level'])
      const growthField = findField(row, ['growth', 'growth rate', '90 day growth', '90d growth', 'growth (90d)'])
      const growth180Field = findField(row, ['180 day growth', '180d growth', 'growth (180d)', '6 month growth'])
      const trendinessField = findField(row, ['trendiness', 'trend', 'trend score'])
      const oppScoreField = findField(row, ['opportunity', 'opp', 'opportunity score', 'opp score'])
      
      // Skip if no niche name
      if (!nameField) {
        processed.errors.push(`Row ${index}: Missing niche name field`)
        return
      }

      // Create niche insight object
      const nicheInsight: Level2NicheInsightData = {
        Insight_Category: nameField.toString().trim(),
        Insight: nameField.toString().trim(),
        Relevance_Score: parseNumberValue(oppScoreField),
        Supporting_Keywords: "",
        Notes: `Volume: ${volumeField}, Competition: ${competitionField}, Growth90d: ${growthField}, Growth180d: ${growth180Field}, Trendiness: ${trendinessField}`
      }

      processed.data.push(nicheInsight)
    } catch (e: any) {
      processed.errors.push(`Row ${index}: ${e.message || "Unknown error"}`)
    }
  })

  console.log(`Processed ${processed.data.length} niche insights with ${processed.errors.length} errors`)
  return processed
}

/**
 * Process products data with more lenient validation
 */
function processProducts(data: any[]): ParseResult<Level2ProductData> {
  const processed: Level2ProductData[] = []
  const errors: string[] = []

  console.log(`Processing ${data.length} product rows`);
  if (data.length > 0) {
    console.log(`First product row keys: ${Object.keys(data[0]).join(', ')}`);
  }

  for (const item of data) {
    try {
      // Extract product fields with enhanced field name matching
      // Find the product name by trying various common field names
      const productNameField = findField(item, [
        "Product_Name", "product_name", "Product Name", "ProductName", 
        "Title", "title", "Item Name", "item_name", "Name", "name",
        "Product", "product"
      ]);

      // Find the ASIN/product identifier
      const asinField = findField(item, [
        "ASIN", "asin", "Product ID", "product_id", "ProductID", 
        "SKU", "sku", "ID", "id", "Identifier", "identifier"
      ]);

      // Find the brand
      const brandField = findField(item, [
        "Brand", "brand", "Manufacturer", "manufacturer", "Vendor", "vendor", "Seller", "seller"
      ]);

      // Find the price
      const priceRaw = findField(item, [
        "Price", "price", "Retail Price", "retail_price", "List Price", "list_price",
        "Cost", "cost", "MSRP", "msrp", "Amount", "amount"
      ]);
      const price = parseNumberValue(priceRaw);

      // Find the rating
      const ratingRaw = findField(item, [
        "Rating", "rating", "Star Rating", "star_rating", "Review Rating", 
        "review_rating", "Stars", "stars", "Score", "score"
      ]);
      const rating = parseNumberValue(ratingRaw);

      // Find the review count
      const reviewCountRaw = findField(item, [
        "Review_Count", "review_count", "Review Count", "Reviews", "reviews", 
        "Number of Reviews", "number_of_reviews", "Review Total", "review_total"
      ]);
      const reviewCount = parseNumberValue(reviewCountRaw);

      // Find features and description 
      const features = findField(item, [
        "Features", "features", "Product Features", "product_features",
        "Key Features", "key_features", "Bullet Points", "bullet_points"
      ]);
      
      const description = findField(item, [
        "Description", "description", "Product Description", "product_description",
        "Details", "details", "Product Details", "product_details"
      ]);

      // Find market share
      const marketShareRaw = findField(item, [
        "Market_Share", "market_share", "Market Share", "Share", "share",
        "Market Percentage", "market_percentage"
      ]);
      const marketShare = parseNumberValue(marketShareRaw);

      // Find sales estimate
      const salesEstimateRaw = findField(item, [
        "Sales_Estimate", "sales_estimate", "Sales Estimate", "Estimated Sales",
        "estimated_sales", "Sales", "sales", "Volume", "volume"
      ]);
      const salesEstimate = parseNumberValue(salesEstimateRaw);

      // Find niche click count
      const nicheClickCountRaw = findField(item, [
        "Niche_Click_Count", "niche_click_count", "Niche Click Count", "Clicks", 
        "clicks", "Total Clicks", "total_clicks"
      ]);
      const nicheClickCount = parseNumberValue(nicheClickCountRaw);

      // Find BSR (Best Seller Rank)
      const bsrRaw = findField(item, [
        "BSR", "bsr", "Best Seller Rank", "best_seller_rank", "Sales Rank", 
        "sales_rank", "Rank", "rank"
      ]);
      const bsr = parseNumberValue(bsrRaw);

      // Find click share
      const clickShareRaw = findField(item, [
        "Click_Share", "click_share", "Click Share", "CTR", "ctr", 
        "Click Through Rate", "click_through_rate"
      ]);
      const clickShare = parseNumberValue(clickShareRaw);

      // Create the product object
      const processedItem: Level2ProductData = {
        Product_Name: productNameField ? String(productNameField) : "",
        ASIN: asinField ? String(asinField) : undefined,
        Brand: brandField ? String(brandField) : undefined,
        Price: price,
        Rating: rating,
        Review_Count: reviewCount,
        Market_Share: marketShare,
        Sales_Estimate: salesEstimate,
        Niche_Click_Count: nicheClickCount,
        BSR: bsr,
        Click_Share: clickShare,
        Features: features ? String(features) : undefined,
        Description: description ? String(description) : undefined
      }

      // Skip products without a name
      if (!processedItem.Product_Name || processedItem.Product_Name.trim() === "") {
        console.warn("Skipping product row due to missing product name:", item);
        errors.push(`Skipped row: Missing product name`);
        continue;
      }

      processed.push(processedItem);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Error processing product row:", error, "Row data:", item);
      errors.push(`Error processing product: ${errorMessage}`);
    }
  }

  console.log(`Successfully processed ${processed.length} products out of ${data.length} rows`);
  if (errors.length > 0) {
    console.warn(`Encountered ${errors.length} errors while processing products`);
  }

  return { data: processed, errors }
}

/**
 * Helper function to find a field value from an object using various possible field names
 */
function findField(item: any, possibleFieldNames: string[]): any {
  // Direct exact match first (fastest path)
  for (const fieldName of possibleFieldNames) {
    if (item[fieldName] !== undefined) {
      return item[fieldName];
    }
  }
  
  // Pascal case and snake case variations
  const variations: string[] = [];
  possibleFieldNames.forEach(name => {
    // Add original name
    variations.push(name);
    
    // Add snake_case variation
    if (!name.includes('_')) {
      variations.push(name.replace(/([A-Z])/g, '_$1').toLowerCase());
    }
    
    // Add camelCase variation
    if (name.includes('_')) {
      variations.push(name.replace(/_([a-z])/g, (_, p1) => p1.toUpperCase()));
    }
    
    // Add PascalCase variation
    if (name.includes('_')) {
      const pascalCase = name.split('_').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('');
      variations.push(pascalCase);
    }
    
    // Add lowercase variation
    variations.push(name.toLowerCase());
    
    // Add uppercase variation
    variations.push(name.toUpperCase());
  });
  
  // Try all variations with exact match
  for (const variation of variations) {
    if (item[variation] !== undefined) {
      return item[variation];
    }
  }
  
  // Special handling for fields with known patterns
  const itemKeys = Object.keys(item);
  
  // 1. Growth field pattern matching
  if (possibleFieldNames.some(name => name.includes('Growth_90') || name.includes('growth_90'))) {
    const growth90Pattern = itemKeys.find(key => {
      const lowerKey = key.toLowerCase();
      return (lowerKey.includes('growth') && (lowerKey.includes('90') || lowerKey.includes('three') || lowerKey.includes('3m')));
    });
    
    if (growth90Pattern && item[growth90Pattern] !== undefined) {
      return item[growth90Pattern];
    }
  }
  
  if (possibleFieldNames.some(name => name.includes('Growth_180') || name.includes('growth_180'))) {
    const growth180Pattern = itemKeys.find(key => {
      const lowerKey = key.toLowerCase();
      return (lowerKey.includes('growth') && (lowerKey.includes('180') || lowerKey.includes('six') || lowerKey.includes('6m')));
    });
    
    if (growth180Pattern && item[growth180Pattern] !== undefined) {
      return item[growth180Pattern];
    }
  }
  
  // 2. Product field pattern matching
  for (const num of ['1', '2', '3']) {
    if (possibleFieldNames.some(name => name.includes(`Product_${num}`) || name.includes(`product_${num}`))) {
      // Look for any field containing this product number and the context (title or asin)
      const isTitle = possibleFieldNames.some(name => name.includes('Title') || name.includes('title'));
      const isASIN = possibleFieldNames.some(name => name.includes('ASIN') || name.includes('asin'));
      
      if (isTitle) {
        const titlePattern = itemKeys.find(key => {
          const lowerKey = key.toLowerCase();
          return lowerKey.includes(num) && 
            (lowerKey.includes('product') || lowerKey.includes('item')) && 
            !lowerKey.includes('asin');
        });
        
        if (titlePattern && item[titlePattern] !== undefined) {
          return item[titlePattern];
        }
      }
      
      if (isASIN) {
        const asinPattern = itemKeys.find(key => {
          const lowerKey = key.toLowerCase();
          return lowerKey.includes(num) && 
            (lowerKey.includes('asin') || (lowerKey.includes('product') && lowerKey.includes('id')));
        });
        
        if (asinPattern && item[asinPattern] !== undefined) {
          return item[asinPattern];
        }
      }
    }
  }
  
  // 3. Partial case-insensitive matching as last resort
  const lowerCaseFieldNames = possibleFieldNames.map(name => name.toLowerCase());
  
  for (const key of itemKeys) {
    const lowerKey = key.toLowerCase();
    for (let i = 0; i < lowerCaseFieldNames.length; i++) {
      const fieldName = lowerCaseFieldNames[i];
      // Match if the key includes the field name or vice versa
      if (lowerKey.includes(fieldName) || fieldName.includes(lowerKey)) {
        return item[key];
      }
    }
  }
  
  // 4. Super fuzzy matching - try to find anything with similar words
  const fieldNameWords = possibleFieldNames.flatMap(name => 
    name.toLowerCase().split(/[_\s]/).filter(word => word.length > 3)
  );
  
  if (fieldNameWords.length > 0) {
    for (const key of itemKeys) {
      const keyWords = key.toLowerCase().split(/[_\s]/);
      const matchesAnyWord = fieldNameWords.some(word => 
        keyWords.some(keyWord => keyWord.includes(word) || word.includes(keyWord))
      );
      
      if (matchesAnyWord) {
        return item[key];
      }
    }
  }
  
  // Nothing found
  return undefined;
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
      const { headers, rows: csvRows, headerRowIndex, metadata } = parseCSV(csvText)
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
  metadata?: Record<string, string>
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

    let metadata: Record<string, string> | undefined

    if (fileType === "csv") {
      const csvText = await parseCSVAsText(file)
      const { headers, rows, headerRowIndex, metadata: md } = parseCSV(csvText)
      metadata = md
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

    return { ...result, headerInfo, metadata }
  } catch (error) {
    console.error("Error parsing Level 2 data:", error)
    return {
      searchTerms: { data: [], errors: [(error as Error).message] },
      nicheInsights: { data: [], errors: [] },
      products: { data: [], errors: [] },
      headerInfo: `Error: ${(error as Error).message}`,
      metadata: undefined
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
