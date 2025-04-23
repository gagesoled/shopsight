export interface EmbeddingResult {
  term: string
  volume: number
  growth?: number
  competition?: number
  values?: number
  embedding: number[]
  metadata?: Record<string, any>
} 