import type { EmbeddingResult } from './embeddings'
import type { TemporalMetrics } from './temporal'
import type { MetadataAnalysis } from './metadata'

export interface HierarchicalCluster {
  terms: EmbeddingResult[]
  id: string
  parentId?: string
  children?: HierarchicalCluster[]
  title?: string
  summary?: string
  confidence?: number
  evidence?: {
    keyTerms: string[]
    keyMetrics: { name: string; value: number; significance: string }[]
    supportingTags: string[]
  }
  temporalMetrics?: TemporalMetrics
  history?: {
    timestamp: Date
    volume: number
    clickShare: number
    competition: number
    terms: string[]
  }[]
  level: number
  similarity: number
  metadataAnalysis?: MetadataAnalysis
  // Added properties based on usage
  metrics?: {
    opportunityScore?: number
    totalVolume?: number
  }
  description?: string
  tags?: Array<{ category: string; value: string; confidence?: number }>
} 