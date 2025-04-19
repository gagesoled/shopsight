export interface CustomerNeed {
  need: string
  volume: number
  growth: string
  opportunityScore: number
}

export interface Tag {
  category: string
  value: string
}

export interface TrendCluster {
  id: string
  name: string
  description: string
  opportunityScore: number
  searchVolume?: number
  clickShare?: number
  keywords: string[]
  tags: Tag[]
}

export interface KeywordData {
  keyword: string
  asin: string
  volume: number
  position: number
  tags: Tag[]
  clusterId: string | null
}

export interface InsightSummary {
  content: string
  generatedAt: Date
}

export interface Level2SearchTermData {
  Search_Term: string
  Volume: number
  Growth_90?: number
  Growth_180?: number
  Click_Share?: number
  Conversion_Rate?: number
  Top_Clicked_Product_1_Title?: string
  Top_Clicked_Product_1_ASIN?: string
  Top_Clicked_Product_2_Title?: string
  Top_Clicked_Product_2_ASIN?: string
  Top_Clicked_Product_3_Title?: string
  Top_Clicked_Product_3_ASIN?: string
}

export interface Level2NicheInsightData {
  Insight_Category: string
  Insight: string
  Relevance_Score?: number
  Supporting_Keywords?: string
  Notes?: string
}

export interface Level2ProductData {
  Product_Name: string
  Brand?: string
  Price?: number
  Rating?: number
  Review_Count?: number
  Features?: string
  Description?: string
}

export interface ParseResult<T> {
  data: T[]
  errors: string[]
}
