import { z } from "zod"

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