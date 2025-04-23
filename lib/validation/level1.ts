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