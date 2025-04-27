import { z } from "zod"

// Level 2 - Products
export const Level2ProductSchema = z.object({
  ASIN: z.string().optional(),
  Product_Name: z.string().min(1, "Product name is required"),
  Brand: z.string().optional(),
  Price: z.number().nonnegative("Price must be non-negative").optional(),
  Rating: z.number().min(0).max(5, "Rating must be between 0 and 5").optional(),
  Review_Count: z.number().nonnegative("Review count must be non-negative").optional(),
  Market_Share: z.number().min(0).max(1, "Market share must be between 0 and 1").optional(),
  Sales_Estimate: z.number().nonnegative("Sales estimate must be non-negative").optional(),
  Niche_Click_Count: z.number().nonnegative().optional(),
  BSR: z.number().nonnegative().optional(),
  Click_Share: z.number().min(0).max(1).optional(),
})

export type Level2ProductData = z.infer<typeof Level2ProductSchema> 