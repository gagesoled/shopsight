import { z } from "zod"

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