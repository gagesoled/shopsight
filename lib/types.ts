export interface CustomerNeed {
  need: string
  volume: number
  growth: string
  opportunityScore: number
}

export interface Tag {
  category: string
  value: string
  confidence?: number
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
  ASIN: string
  Brand: string
  category: string
  launch_date: string
  Niche_Click_Count: number
  Click_Share: number
  average_selling_price: number
  total_ratings: number
  Average_Customer_Rating: number
  Average_BSR: number
  average_of_sellers_and_vendors: number
}

export interface ParseResult<T> {
  data: T[]
  errors: string[]
}

export interface Project {
  id: string
  name: string
  created_at: string
  settings?: ProjectSettings
  files?: ProjectFiles
  analysis?: ProjectAnalysis
}

export interface ProjectSettings {
  maxClusters: number
  minClusterSize: number
  clusteringSettings: {
    searchTerms: {
      enabled: boolean
      parameters: {
        minClusterSize?: number
        maxClusters?: number
        similarityThreshold?: number
      }
    }
    products: {
      enabled: boolean
      parameters: {
        minClusterSize?: number
        maxClusters?: number
        similarityThreshold?: number
      }
    }
  }
}

export interface ProjectFiles {
  searchTerms?: {
    id: string
    uploadedAt: string
    data: Level2SearchTermData[]
  }
  products?: {
    id: string
    uploadedAt: string
    data: Level2ProductData[]
  }
}

export interface ProjectAnalysis {
  searchTermClusters?: ClusterResult[]
  productClusters?: ProductClusterResult[]
  insights?: {
    marketOpportunities: OpportunityResult[]
    competitionAnalysis: CompetitionResult[]
    trends: TrendAnalysis[]
  }
}

export interface ClusterResult {
  id: string
  name: string
  description: string
  opportunityScore: number
  keywords: string[]
  tags: Tag[]
  searchVolume: number
  clickShare: number
}

export interface ProductClusterResult {
  id: string
  name: string
  description: string
  products: Product[]
  metrics: {
    averagePrice: number
    averageRating: number
    totalReviews: number
    marketShare: number
  }
}

export interface OpportunityResult {
  id: string
  title: string
  description: string
  opportunityScore: number
  supportingData: {
    searchTerms: string[]
    products: string[]
    metrics: {
      searchVolume: number
      competition: number
      growth: number
    }
  }
}

export interface CompetitionResult {
  id: string
  title: string
  description: string
  competitors: {
    name: string
    marketShare: number
    strengths: string[]
    weaknesses: string[]
  }[]
}

export interface TrendAnalysis {
  id: string
  title: string
  description: string
  trend: 'up' | 'down' | 'stable'
  confidence: number
  supportingData: {
    searchTerms: string[]
    products: string[]
    metrics: {
      growth: number
      volume: number
    }
  }
}

export interface ProjectFile {
  id: string
  project_id: string
  level: number
  original_filename: string
  parsed_json?: any
  created_at: string
  parser_version?: string
}

export interface Product {
  ASIN?: string
  Product_Name: string
  Brand?: string
  Price?: number
  Rating?: number
  Review_Count?: number
  Market_Share?: number
  Sales_Estimate?: number
  Niche_Click_Count?: number
  BSR?: number
  Click_Share?: number
}
