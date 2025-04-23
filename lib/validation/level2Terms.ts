import { z } from "zod"

// Level 2 - Search Terms
export const Level2SearchTermDataSchema = z.object({
  Search_Term: z.string(),
  Volume: z.number(),
  Growth_180: z.number().optional(),
  Growth_90: z.number().optional(),
  Click_Share: z.number().optional(),
  Conversion_Rate: z.number().optional(),
  Top_Clicked_Product_1_Title: z.string().optional(),
  Top_Clicked_Product_2_Title: z.string().optional(),
  Top_Clicked_Product_3_Title: z.string().optional(),
  Format_Inferred: z.string().optional(),
  Function_Inferred: z.string().optional(),
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