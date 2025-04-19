import { z } from "zod"

// Level 1 - Category Overview (APOE)
export const Level1Schema = z.object({
  Customer_Need: z.string().min(1, "Customer need is required"),
  Search_Volume: z.number().nonnegative("Search volume must be non-negative"),
  // Make these fields optional since they might not be in the CSV
  Search_Volume_Growth: z.number().optional(),
  Click_Share: z.number().min(0).max(1, "Click share must be between 0 and 1").default(0.5),
  Conversion_Rate: z.number().min(0).max(1, "Conversion rate must be between 0 and 1").default(0.1),
  Units_Sold: z.number().nonnegative("Units sold must be non-negative").default(0),
  // Allow any number for Brand_Concentration, we'll normalize it later
  Brand_Concentration: z.number().default(0.5),
  Notes: z.string().optional(),
})

export type Level1Data = z.infer<typeof Level1Schema>

// Level 2 - Search Terms
export const Level2SearchTermDataSchema = z.object({
  Search_Term: z.string(),
  Volume: z.number(),
  Growth_180: z.number().optional(),
  Growth_90: z.number().optional(),
  Click_Share: z.number().optional(),
  Conversion_Rate: z.number().optional(),
  Format_Inferred: z.string().optional(),
  Function_Inferred: z.string().optional(),
  Values_Inferred: z.string().optional(),
  Competition: z.number().optional(),
  Top_Clicked_Product_1_ASIN: z.string().optional(),
  Top_Clicked_Product_2_ASIN: z.string().optional(),
  Top_Clicked_Product_3_ASIN: z.string().optional(),
})

export type Level2SearchTermData = z.infer<typeof Level2SearchTermDataSchema>

// Level 2 - Niche Insights
export const Level2NicheInsightSchema = z.object({
  Insight_Category: z.string().min(1, "Insight category is required"),
  Insight: z.string().min(1, "Insight is required"),
  Relevance_Score: z.number().min(0).max(100, "Relevance score must be between 0 and 100").optional(),
  Supporting_Keywords: z.string().optional(),
  Notes: z.string().optional(),
})

export type Level2NicheInsightData = z.infer<typeof Level2NicheInsightSchema>

// Level 2 - Products
export const Level2ProductSchema = z.object({
  ASIN: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, "ASIN must be 10 alphanumeric characters")
    .optional(),
  Product_Name: z.string().min(1, "Product name is required"),
  Brand: z.string().optional(),
  Price: z.number().nonnegative("Price must be non-negative").optional(),
  Rating: z.number().min(0).max(5, "Rating must be between 0 and 5").optional(),
  Review_Count: z.number().nonnegative("Review count must be non-negative").optional(),
  Market_Share: z.number().min(0).max(1, "Market share must be between 0 and 1").optional(),
  Sales_Estimate: z.number().nonnegative("Sales estimate must be non-negative").optional(),
})

export type Level2ProductData = z.infer<typeof Level2ProductSchema> & {
  Niche_Click_Count?: number
  BSR?: number
  Click_Share?: number
}

// Level 3 - ASIN Keyword Detail (Cerebro)
export const Level3Schema = z.object({
  ASIN: z.string().regex(/^[A-Z0-9]{10}$/, "ASIN must be 10 alphanumeric characters"),
  Keyword: z.string().min(1, "Keyword is required"),
  Search_Volume: z.number().nonnegative("Search volume must be non-negative"),
  ABA_Click_Share: z.number().min(0).max(1, "ABA click share must be between 0 and 1"),
  Conversion_Share: z.number().min(0).max(1, "Conversion share must be between 0 and 1"),
  Organic_Rank: z.number().positive("Organic rank must be positive").nullable(),
  Sponsored_Rank: z.number().positive("Sponsored rank must be positive").nullable(),
  Keyword_Sales: z.number().nonnegative("Keyword sales must be non-negative"),
})

export type Level3Data = z.infer<typeof Level3Schema>

// Cluster model
export const ClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  opportunityScore: z.number().min(0).max(100),
  keywords: z.array(z.string()),
  tags: z.array(
    z.object({
      category: z.string(),
      value: z.string(),
    }),
  ),
})

export type Cluster = z.infer<typeof ClusterSchema>

// Tag model
export const TagSchema = z.object({
  category: z.string(),
  tag: z.string(),
  trigger: z.string(),
})

export type Tag = z.infer<typeof TagSchema>
