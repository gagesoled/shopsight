import { z } from "zod"

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