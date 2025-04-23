import * as XLSX from "xlsx-js-style"
import { z } from "zod"
import {
  Level1Schema,
  Level2SearchTermDataSchema,
  Level2NicheInsightSchema,
  Level2ProductSchema,
  Level3Schema,
} from "../validation"

/**
 * Parse Excel file with multiple sheets
 */
export async function parseExcelFile(file: File): Promise<ArrayBuffer> {
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
 * Normalize column headers to match expected schema
 */
function normalizeHeader(header: string): string {
  // Clean the header string
  const originalHeader = header.trim()

  // Special case handling for specific headers
  const headerMap: Record<string, string> = {
    // Search Terms sheet
    "Search Term": "Search_Term",
    "Search Volume": "Volume",
    "Search Volume (Past 360 days)": "Volume",
    "Growth (Past 180 days)": "Growth_180",
    "Growth (Past 90 days)": "Growth_90",
    "Click Share": "Click_Share",
    "Conversion Rate": "Conversion_Rate",
    "Format Inferred": "Format_Inferred",
    "Function Inferred": "Function_Inferred",

    // Niche Insights sheet
    "Insight Category": "Insight_Category",
    "Relevance Score": "Relevance_Score",
    "Supporting Keywords": "Supporting_Keywords",

    // Products sheet
    "Product Name": "Product_Name",
    "Review Count": "Review_Count",
    "Market Share": "Market_Share",
    "Sales Estimate": "Sales_Estimate",
  }

  // Check if we have a direct mapping
  if (headerMap[originalHeader]) {
    return headerMap[originalHeader]
  }

  // Replace spaces and special characters with underscores
  const cleaned = originalHeader.replace(/[^a-zA-Z0-9_]/g, "_")

  // Convert to snake_case
  return cleaned
}

/**
 * Process Excel workbook with multiple sheets
 */
export function processExcelWorkbook(buffer: ArrayBuffer): {
  searchTerms: { data: z.infer<typeof Level2SearchTermDataSchema>[]; errors: string[] }
  nicheInsights: { data: z.infer<typeof Level2NicheInsightSchema>[]; errors: string[] }
  products: { data: z.infer<typeof Level2ProductSchema>[]; errors: string[] }
  sheetNames: string[]
} {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetNames = workbook.SheetNames

  // Initialize results
  const result: {
    searchTerms: { data: z.infer<typeof Level2SearchTermDataSchema>[]; errors: string[] }
    nicheInsights: { data: z.infer<typeof Level2NicheInsightSchema>[]; errors: string[] }
    products: { data: z.infer<typeof Level2ProductSchema>[]; errors: string[] }
    sheetNames: string[]
  } = {
    searchTerms: { data: [], errors: [] },
    nicheInsights: { data: [], errors: [] },
    products: { data: [], errors: [] },
    sheetNames,
  }

  // Process each sheet based on its name or position
  sheetNames.forEach((sheetName: string, index: number) => {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })

    // Normalize headers
    const normalizedData = jsonData.map((row: any) => {
      const normalizedRow: Record<string, any> = {}
      Object.entries(row).forEach(([key, value]) => {
        normalizedRow[normalizeHeader(key)] = value
      })
      return normalizedRow
    })

    // Determine sheet type and process accordingly
    if (sheetName.toLowerCase().includes("search") || sheetName.toLowerCase().includes("term") || index === 0) {
      result.searchTerms = processSearchTerms(normalizedData)
    } else if (
      sheetName.toLowerCase().includes("insight") ||
      sheetName.toLowerCase().includes("niche") ||
      index === 1
    ) {
      result.nicheInsights = processNicheInsights(normalizedData)
    } else if (sheetName.toLowerCase().includes("product") || index === 2) {
      result.products = processProducts(normalizedData)
    }
  })

  return result
}

/**
 * Process search terms data
 */
function processSearchTerms(data: any[]): { data: z.infer<typeof Level2SearchTermDataSchema>[]; errors: string[] } {
  const validData: z.infer<typeof Level2SearchTermDataSchema>[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip empty rows
      if (!row.Search_Term) {
        continue
      }

      // Convert string values to appropriate types
      const processedRow = {
        Search_Term: String(row.Search_Term || ""),
        Volume: row.Volume ? Number(row.Volume) : 0,
        Growth_180: row.Growth_180 ? Number(row.Growth_180) : undefined,
        Growth_90: row.Growth_90 ? Number(row.Growth_90) : undefined,
        Click_Share: row.Click_Share ? Number(row.Click_Share) : undefined,
        Conversion_Rate: row.Conversion_Rate ? Number(row.Conversion_Rate) : undefined,
        Format_Inferred: row.Format_Inferred || undefined,
        Function_Inferred: row.Function_Inferred || undefined,
      }

      // Validate with schema
      const validatedRow = Level2SearchTermDataSchema.parse(processedRow)
      validData.push(validatedRow)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
        errors.push(...rowErrors)
      } else {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      }
    }
  }

  return { data: validData, errors }
}

/**
 * Process niche insights data
 */
function processNicheInsights(data: any[]): { data: z.infer<typeof Level2NicheInsightSchema>[]; errors: string[] } {
  const validData: z.infer<typeof Level2NicheInsightSchema>[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip empty rows
      if (!row.Insight_Category && !row.Insight) {
        continue
      }

      // Convert string values to appropriate types
      const processedRow = {
        Insight_Category: String(row.Insight_Category || ""),
        Insight: String(row.Insight || ""),
        Relevance_Score: row.Relevance_Score ? Number(row.Relevance_Score) : undefined,
        Supporting_Keywords: row.Supporting_Keywords || undefined,
        Notes: row.Notes || undefined,
      }

      // Validate with schema
      const validatedRow = Level2NicheInsightSchema.parse(processedRow)
      validData.push(validatedRow)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
        errors.push(...rowErrors)
      } else {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      }
    }
  }

  return { data: validData, errors }
}

/**
 * Process products data
 */
function processProducts(data: any[]): { data: z.infer<typeof Level2ProductSchema>[]; errors: string[] } {
  const validData: z.infer<typeof Level2ProductSchema>[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip empty rows
      if (!row.Product_Name && !row.ASIN) {
        continue
      }

      // Convert string values to appropriate types
      const processedRow = {
        ASIN: row.ASIN || undefined,
        Product_Name: String(row.Product_Name || ""),
        Brand: row.Brand || undefined,
        Price: row.Price ? Number(row.Price) : undefined,
        Rating: row.Rating ? Number(row.Rating) : undefined,
        Review_Count: row.Review_Count ? Number(row.Review_Count) : undefined,
        Market_Share: row.Market_Share ? Number(row.Market_Share) : undefined,
        Sales_Estimate: row.Sales_Estimate ? Number(row.Sales_Estimate) : undefined,
      }

      // Validate with schema
      const validatedRow = Level2ProductSchema.parse(processedRow)
      validData.push(validatedRow)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
        errors.push(...rowErrors)
      } else {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      }
    }
  }

  return { data: validData, errors }
}
