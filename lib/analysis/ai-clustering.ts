import { OpenAI } from "openai"
import type { Level2SearchTermData } from "@/lib/schemas"

export interface AICluster {
  terms: Array<{
    term: string
    volume: number
    clickShare: number
    embedding: number[]
  }>
  description?: string
  tags?: Array<{
    category: string
    value: string
    confidence: number
  }>
  metrics?: {
    totalVolume: number
    avgGrowth: number
    avgCompetition: number
    opportunityScore: number
  }
  temporalMetrics?: TemporalMetrics
  history?: Array<{
    timestamp: Date
    volume: number
    clickShare: number
    competition: number
    terms: string[]
  }>
  level: number
  similarity: number
  metadataAnalysis?: MetadataAnalysis
}

interface EmbeddingResult {
  term: string
  volume: number
  clickShare: number
  growth?: number
  competition?: number
  embedding: number[]
  metadata?: Record<string, any>
}

async function generateEmbedding(text: string, openai: OpenAI): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return response.data[0].embedding
}

interface Cluster {
  terms: EmbeddingResult[]
}

interface TemporalMetrics {
  growthRate: number
  volumeTrend: number[]
  clickShareTrend: number[]
  competitionTrend: number[]
  stability: number
  emergenceScore: number
}

interface HierarchicalCluster extends Cluster {
  parentId?: string
  children?: HierarchicalCluster[]
  level: number
  similarity: number
  temporalMetrics?: TemporalMetrics
  history?: {
    timestamp: Date
    volume: number
    clickShare: number
    competition: number
    terms: string[]
  }[]
  tags?: Array<{
    category: string
    value: string
    confidence: number
  }>
}

interface MetadataAnalysis {
  patterns: {
    functionPatterns: Array<{
      pattern: string
      confidence: number
      terms: string[]
    }>
    formatPatterns: Array<{
      pattern: string
      confidence: number
      terms: string[]
    }>
    valuePatterns: Array<{
      pattern: string
      confidence: number
      terms: string[]
    }>
  }
  relationships: {
    functionFormatPairs: Array<{
      function: string
      format: string
      confidence: number
      terms: string[]
    }>
    functionValuePairs: Array<{
      function: string
      value: string
      confidence: number
      terms: string[]
    }>
    formatValuePairs: Array<{
      format: string
      value: string
      confidence: number
      terms: string[]
    }>
  }
  insights: Array<{
    type: 'function' | 'format' | 'value' | 'relationship'
    description: string
    confidence: number
    supportingTerms: string[]
  }>
}

interface TrendClassification {
  primaryCategory: string
  secondaryCategories: string[]
  behavioralClassifiers: Array<{
    type: 'ritual' | 'clean-label' | 'stacked-formula' | 'lifestyle' | 'solution' | 'custom'
    value: string
    confidence: number
    evidence: string[]
  }>
  trendStrength: {
    score: number
    factors: Array<{
      name: string
      value: number
      impact: 'positive' | 'negative' | 'neutral'
    }>
  }
}

interface EvidenceScore {
  score: number
  factors: Array<{
    name: string
    value: number
    weight: number
    evidence: string[]
  }>
  validation: {
    termConsistency: number
    metricAlignment: number
    tagRelevance: number
    temporalStability?: number
  }
}

interface ConfidenceAnalysis {
  overall: number
  components: {
    termAnalysis: number
    metricAnalysis: number
    behavioralAnalysis: number
    marketContext: number
  }
  riskFactors: Array<{
    type: 'data-quality' | 'market-volatility' | 'term-ambiguity' | 'competition' | 'seasonality'
    impact: number
    description: string
  }>
  evidenceScore: EvidenceScore
}

interface ClusterDescription {
  title: string
  summary: string
  behavioralInsight: string
  confidence: number
  evidence: {
    keyTerms: string[]
    keyMetrics: {
      name: string
      value: number
      significance: string
    }[]
    supportingTags: string[]
  }
  trendClassification?: TrendClassification
  confidenceAnalysis?: ConfidenceAnalysis
}

interface MarketMetrics {
  searchVolume: number
  growth: number
  clickShare: number
  conversionRate: number
  brandConcentration: number
  unitsSold: number
  averageUnitsSold: number
  marketSize: {
    total: number
    perProduct: number
    growthRate: number
  }
  consumerBehavior: {
    searchToPurchaseRatio: number
    averageOrderValue: number
    repeatPurchaseRate: number
  }
}

export interface Level1Analysis {
  niche: string
  opportunityScore: number
  marketMetrics: MarketMetrics
  trendAnalysis: {
    growthTrend: 'accelerating' | 'stable' | 'declining'
    marketMaturity: 'emerging' | 'growing' | 'mature'
    competitionLevel: 'low' | 'medium' | 'high'
  }
  suggestedFocus: {
    primary: string
    secondary: string[]
  }
  confidence: number
  evidence: {
    keyMetrics: Array<{
      name: string
      value: number
      significance: string
    }>
    supportingFactors: string[]
    riskFactors: string[]
  }
}

export interface Level1Data {
  Customer_Need: string
  Search_Volume: number
  Search_Volume_Growth: number
  Click_Share: number
  Conversion_Rate: number
  Brand_Concentration: number
  Units_Sold: number
  Average_Units_Sold: number
}

interface AnalysisResult {
  niche: string
  opportunityScore: number
  marketMetrics: {
    searchVolume: number
    growthRate: number
    clickShare: number
    conversionRate: number
    brandConcentration: number
  }
  trendAnalysis: {
    growth: number
    seasonality: number
    stability: number
  }
  suggestedFocus: string
  confidence: number
  evidence: string[]
}

export async function analyzeLevel1Data(data: Level1Data[], openai: OpenAI): Promise<AnalysisResult> {
  console.log("Starting Level 1 analysis with data:", data)
  
  if (!data || data.length === 0) {
    throw new Error("No data provided for analysis")
  }

  // Calculate aggregate metrics
  const totalRecords = data.length
  const avgSearchVolume = data.reduce((sum, item) => sum + item.Search_Volume, 0) / totalRecords
  const avgGrowth = data.reduce((sum, item) => sum + item.Search_Volume_Growth, 0) / totalRecords
  const avgClickShare = data.reduce((sum, item) => sum + item.Click_Share, 0) / totalRecords
  const avgConversionRate = data.reduce((sum, item) => sum + item.Conversion_Rate, 0) / totalRecords
  const avgBrandConcentration = data.reduce((sum, item) => sum + item.Brand_Concentration, 0) / totalRecords

  // Prepare the prompt for OpenAI
  const prompt = `Analyze the following market data and provide insights:

Total Records: ${totalRecords}
Average Search Volume: ${avgSearchVolume.toLocaleString()}
Average Growth Rate: ${(avgGrowth * 100).toFixed(1)}%
Average Click Share: ${(avgClickShare * 100).toFixed(1)}%
Average Conversion Rate: ${(avgConversionRate * 100).toFixed(1)}%
Average Brand Concentration: ${(avgBrandConcentration * 100).toFixed(1)}%

Top 5 Customer Needs by Search Volume:
${data
  .sort((a, b) => b.Search_Volume - a.Search_Volume)
  .slice(0, 5)
  .map(item => `- ${item.Customer_Need}: ${item.Search_Volume.toLocaleString()} searches`)
  .join("\n")}

Top 5 Customer Needs by Growth:
${data
  .sort((a, b) => b.Search_Volume_Growth - a.Search_Volume_Growth)
  .slice(0, 5)
  .map(item => `- ${item.Customer_Need}: ${(item.Search_Volume_Growth * 100).toFixed(1)}% growth`)
  .join("\n")}

Please analyze this data and provide:
1. The most promising niche opportunity
2. Market metrics and trends
3. Suggested focus areas
4. Supporting evidence

Format the response as a JSON object with the following structure:
{
  "niche": "string",
  "opportunityScore": number,
  "marketMetrics": {
    "searchVolume": number,
    "growthRate": number,
    "clickShare": number,
    "conversionRate": number,
    "brandConcentration": number
  },
  "trendAnalysis": {
    "growth": number,
    "seasonality": number,
    "stability": number
  },
  "suggestedFocus": "string",
  "confidence": number,
  "evidence": ["string"]
}`

  try {
    console.log("Sending request to OpenAI")
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a market analysis expert. Analyze the provided data and return insights in the specified JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    })

    console.log("Received response from OpenAI")
    const result = JSON.parse(completion.choices[0].message.content)
    console.log("Parsed result:", result)
    return result
  } catch (error) {
    console.error("Error in OpenAI analysis:", error)
    throw error
  }
}

async function analyzeMetadata(
  cluster: HierarchicalCluster,
  openai: OpenAI
): Promise<MetadataAnalysis> {
  const terms = cluster.terms.map(t => t.term)
  const metadata = cluster.terms.map(t => t.metadata || {})

  // Extract patterns from metadata
  const patterns = await extractMetadataPatterns(terms, metadata, openai)

  // Analyze relationships between different metadata types
  const relationships = await analyzeMetadataRelationships(terms, metadata, openai)

  // Generate insights from patterns and relationships
  const insights = await generateMetadataInsights(patterns, relationships, terms, openai)

  return {
    patterns,
    relationships,
    insights
  }
}

export async function runAIClustering(
  searchTerms: Level2SearchTermData[],
  openai: OpenAI,
  historicalData?: {
    timestamp: Date
    searchTerms: Level2SearchTermData[]
  }[]
): Promise<AICluster[]> {
  // Generate embeddings for each search term with additional metadata
  const embeddings = await Promise.all(
    searchTerms.map(async (term) => {
      const embedding = await generateEmbedding(term.Search_Term, openai)
      return {
        term: term.Search_Term,
        volume: term.Volume,
        clickShare: term.Click_Share || 0,
        growth: term.Growth_180,
        competition: term.Competition,
        embedding,
        metadata: {
          function: term.Function_Inferred,
          format: term.Format_Inferred,
          values: term.Values_Inferred,
        }
      }
    })
  )

  // Cluster the embeddings with dynamic parameters
  const clusters = await clusterEmbeddings(embeddings)

  // If historical data is available, analyze temporal patterns
  if (historicalData) {
    await analyzeTemporalPatterns(clusters, historicalData, openai)
  }

  // Generate descriptions and tags for each cluster
  return await Promise.all(
    clusters.map(async (cluster) => {
      const keywords = cluster.terms.map((t) => t.term)
      const description = await generateClusterDescription(
        keywords,
        openai,
        {
          searchVolume: cluster.terms.reduce((sum, t) => sum + t.volume, 0),
          growth: cluster.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / cluster.terms.length,
          clickShare: cluster.terms.reduce((sum, t) => sum + t.clickShare, 0) / cluster.terms.length
        },
        cluster.tags
      )
      const tags = await extractSemanticTags(keywords, openai)
      const metadataAnalysis = await analyzeMetadata(cluster, openai)

      // Calculate cluster metrics
      const totalVolume = cluster.terms.reduce((sum, t) => sum + t.volume, 0)
      const avgGrowth = cluster.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / cluster.terms.length
      const avgCompetition = cluster.terms.reduce((sum, t) => sum + (t.competition || 0), 0) / cluster.terms.length

      return {
        terms: cluster.terms,
        description: description.behavioralInsight,
        title: description.title,
        summary: description.summary,
        confidence: description.confidence,
        evidence: description.evidence,
        tags,
        metrics: {
          totalVolume,
          avgGrowth,
          avgCompetition,
          opportunityScore: calculateOpportunityScore(totalVolume, avgGrowth, avgCompetition)
        },
        temporalMetrics: cluster.temporalMetrics,
        history: cluster.history,
        level: cluster.level,
        similarity: cluster.similarity,
        metadataAnalysis
      }
    })
  )
}

async function clusterEmbeddings(embeddings: EmbeddingResult[]): Promise<HierarchicalCluster[]> {
  if (embeddings.length < 2) {
    return [{ terms: embeddings, level: 0, similarity: 1 }]
  }

  // Convert embeddings to array of arrays for HDBSCAN
  const points = embeddings.map(e => e.embedding)
  
  // Dynamic parameter calculation based on dataset size and characteristics
  const minClusterSize = Math.max(2, Math.floor(embeddings.length * 0.05)) // At least 5% of terms or 2
  const minSamples = Math.max(1, Math.floor(minClusterSize * 0.5)) // Half of minClusterSize
  
  // Run HDBSCAN clustering with dynamic parameters
  const clusterer = new hdbscan.HDBSCAN({
    minClusterSize,
    minSamples,
    metric: 'euclidean'
  })
  
  const labels = clusterer.fit(points)
  
  // Group terms by cluster with additional metadata
  const clusters: HierarchicalCluster[] = []
  const noiseCluster: EmbeddingResult[] = []
  
  embeddings.forEach((embedding, index) => {
    const label = labels[index]
    if (label === -1) {
      noiseCluster.push(embedding)
    } else {
      if (!clusters[label]) {
        clusters[label] = { terms: [], level: 0, similarity: 1 }
      }
      clusters[label].terms.push(embedding)
    }
  })
  
  // Add noise points as their own cluster if significant
  if (noiseCluster.length > minClusterSize) {
    clusters.push({ terms: noiseCluster, level: 0, similarity: 1 })
  }

  // Calculate cluster centroids and similarities
  const centroids = clusters.map(cluster => {
    const centroid = new Array(cluster.terms[0].embedding.length).fill(0)
    cluster.terms.forEach(term => {
      term.embedding.forEach((val, i) => {
        centroid[i] += val
      })
    })
    return centroid.map(val => val / cluster.terms.length)
  })

  // Build hierarchical structure
  const hierarchicalClusters = buildHierarchy(clusters, centroids)
  
  // Sort clusters by opportunity score
  return hierarchicalClusters.sort((a, b) => {
    const scoreA = calculateOpportunityScore(
      a.terms.reduce((sum, t) => sum + t.volume, 0),
      a.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / a.terms.length,
      a.terms.reduce((sum, t) => sum + (t.competition || 0), 0) / a.terms.length
    )
    const scoreB = calculateOpportunityScore(
      b.terms.reduce((sum, t) => sum + t.volume, 0),
      b.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / b.terms.length,
      b.terms.reduce((sum, t) => sum + (t.competition || 0), 0) / b.terms.length
    )
    return scoreB - scoreA
  })
}

function buildHierarchy(clusters: HierarchicalCluster[], centroids: number[][]): HierarchicalCluster[] {
  if (clusters.length <= 1) return clusters

  // Calculate similarity matrix
  const similarityMatrix = centroids.map((centroidA, i) =>
    centroids.map((centroidB, j) => {
      if (i === j) return 1
      return cosineSimilarity(centroidA, centroidB)
    })
  )

  // Find most similar clusters
  let maxSimilarity = -1
  let clusterA = -1
  let clusterB = -1

  for (let i = 0; i < similarityMatrix.length; i++) {
    for (let j = i + 1; j < similarityMatrix.length; j++) {
      if (similarityMatrix[i][j] > maxSimilarity) {
        maxSimilarity = similarityMatrix[i][j]
        clusterA = i
        clusterB = j
      }
    }
  }

  // Merge most similar clusters
  const mergedCluster: HierarchicalCluster = {
    terms: [...clusters[clusterA].terms, ...clusters[clusterB].terms],
    level: Math.max(clusters[clusterA].level, clusters[clusterB].level) + 1,
    similarity: maxSimilarity,
    children: [clusters[clusterA], clusters[clusterB]]
  }

  // Update parent references
  clusters[clusterA].parentId = `cluster_${clusters.length}`
  clusters[clusterB].parentId = `cluster_${clusters.length}`

  // Create new cluster list with merged cluster
  const newClusters = clusters.filter((_, i) => i !== clusterA && i !== clusterB)
  newClusters.push(mergedCluster)

  // Recursively build hierarchy
  return buildHierarchy(newClusters, newClusters.map(c => calculateCentroid(c.terms)))
}

function calculateCentroid(terms: EmbeddingResult[]): number[] {
  const centroid = new Array(terms[0].embedding.length).fill(0)
  terms.forEach(term => {
    term.embedding.forEach((val, i) => {
      centroid[i] += val
    })
  })
  return centroid.map(val => val / terms.length)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

async function generateClusterDescription(
  keywords: string[],
  openai: OpenAI,
  metrics?: {
    searchVolume: number
    growth?: number
    conversionRate?: number
    clickShare?: number
  },
  tags?: Array<{
    category: string
    value: string
    confidence: number
  }>
): Promise<ClusterDescription> {
  const prompt = `Analyze this cluster of search terms and generate a comprehensive description. Consider the following:

Cluster Terms: ${keywords.join(", ")}
${metrics ? `Metrics:
- Search Volume: ${metrics.searchVolume}
${metrics.growth ? `- Growth Rate: ${metrics.growth}` : ''}
${metrics.conversionRate ? `- Conversion Rate: ${metrics.conversionRate}` : ''}
${metrics.clickShare ? `- Click Share: ${metrics.clickShare}` : ''}` : ''}
${tags ? `Tags: ${tags.map(t => `${t.category}: ${t.value}`).join(", ")}` : ''}

Generate a response in JSON format with the following structure:
{
  "title": "A concise, descriptive title for the cluster",
  "summary": "A brief overview of what this cluster represents",
  "behavioralInsight": "Focus on user motivation and buying behavior. Use plain language and explain why users are searching for these terms.",
  "confidence": "A number between 0 and 1 indicating confidence in the insight",
  "evidence": {
    "keyTerms": ["List of the most significant terms that influenced the insight"],
    "keyMetrics": [
      {
        "name": "Metric name",
        "value": "Metric value",
        "significance": "Why this metric is significant"
      }
    ],
    "supportingTags": ["List of tags that support the insight"]
  }
}`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing search behavior and generating insights. 
        Focus on understanding user motivations and buying behavior.
        Use plain language and avoid jargon.
        Be specific about what users are looking for and why.
        Consider both the search terms and any available metrics or tags.
        Provide evidence to support your insights.`
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const trendClassification = await analyzeTrendClassification(
      {
        terms: keywords.map(term => ({
          term,
          volume: metrics?.searchVolume || 0,
          clickShare: metrics?.clickShare || 0,
          growth: metrics?.growth,
          competition: 0,
          embedding: []
        })),
        level: 0,
        similarity: 1,
        tags
      },
      result,
      openai
    )

    const confidenceAnalysis = await analyzeConfidence(
      {
        terms: keywords.map(term => ({
          term,
          volume: metrics?.searchVolume || 0,
          clickShare: metrics?.clickShare || 0,
          growth: metrics?.growth,
          competition: 0,
          embedding: []
        })),
        level: 0,
        similarity: 1,
        tags
      },
      result,
      openai
    )

    return {
      title: result.title || "Unnamed Cluster",
      summary: result.summary || "No summary available",
      behavioralInsight: result.behavioralInsight || "No behavioral insight available",
      confidence: result.confidence || 0,
      evidence: {
        keyTerms: result.evidence?.keyTerms || [],
        keyMetrics: result.evidence?.keyMetrics || [],
        supportingTags: result.evidence?.supportingTags || []
      },
      trendClassification,
      confidenceAnalysis
    }
  } catch (error) {
    console.error("Failed to parse cluster description:", error)
    return {
      title: "Unnamed Cluster",
      summary: "No summary available",
      behavioralInsight: "No behavioral insight available",
      confidence: 0,
      evidence: {
        keyTerms: [],
        keyMetrics: [],
        supportingTags: []
      },
      trendClassification: {
        primaryCategory: "Uncategorized",
        secondaryCategories: [],
        behavioralClassifiers: [],
        trendStrength: {
          score: 0,
          factors: []
        }
      },
      confidenceAnalysis: {
        overall: 0,
        components: {
          termAnalysis: 0,
          metricAnalysis: 0,
          behavioralAnalysis: 0,
          marketContext: 0
        },
        riskFactors: [],
        evidenceScore: {
          score: 0,
          factors: [],
          validation: {
            termConsistency: 0,
            metricAlignment: 0,
            tagRelevance: 0
          }
        }
      }
    }
  }
}

async function extractSemanticTags(
  keywords: string[],
  openai: OpenAI
): Promise<Array<{ category: string; value: string; confidence: number }>> {
  const prompt = `Analyze these search terms: ${keywords.join(
    ", "
  )}. Extract semantic tags that describe their characteristics. For each tag, provide:
  - Category (one of: Format, Audience, Function, Values, Behavior)
  - Value (the specific tag)
  - Confidence (0-1)
  
  Format your response as JSON:
  {
    "tags": [
      {
        "category": "string",
        "value": "string",
        "confidence": number
      }
    ]
  }`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at extracting semantic tags from search terms. Provide clear, relevant tags with confidence scores. Only use the specified categories.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{"tags":[]}')
    return result.tags || []
  } catch (error) {
    console.error("Failed to parse semantic tags:", error)
    return []
  }
}

// Enhanced opportunity score calculation
function calculateOpportunityScore(volume: number, growth: number, competition: number): number {
  // Normalize inputs
  const normalizedVolume = Math.min(1, volume / 10000) // Cap at 10,000
  const normalizedGrowth = Math.min(1, Math.max(0, (growth + 100) / 200)) // Convert -100 to 100 range to 0-1
  const normalizedCompetition = Math.min(1, competition / 100) // Cap at 100
  
  // Weighted scoring
  const volumeWeight = 0.4
  const growthWeight = 0.3
  const competitionWeight = 0.3
  
  // Calculate weighted score
  const score = (
    normalizedVolume * volumeWeight +
    normalizedGrowth * growthWeight +
    (1 - normalizedCompetition) * competitionWeight
  ) * 100
  
  return Math.round(Math.min(100, Math.max(0, score)))
}

function generateClusterId(description: { title: string }): string {
  return description.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function analyzeTemporalPatterns(
  clusters: HierarchicalCluster[],
  historicalData: {
    timestamp: Date
    searchTerms: Level2SearchTermData[]
  }[],
  openai: OpenAI
): Promise<void> {
  // Sort historical data by timestamp
  historicalData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // For each cluster, analyze its evolution over time
  await Promise.all(clusters.map(async (cluster) => {
    const clusterHistory = await trackClusterEvolution(cluster, historicalData, openai)
    if (clusterHistory) {
      cluster.history = clusterHistory

      // Calculate temporal metrics
      if (clusterHistory.length >= 2) {
        const temporalMetrics = calculateTemporalMetrics(clusterHistory)
        cluster.temporalMetrics = temporalMetrics
      }
    }
  }))
}

async function trackClusterEvolution(
  cluster: HierarchicalCluster,
  historicalData: {
    timestamp: Date
    searchTerms: Level2SearchTermData[]
  }[],
  openai: OpenAI
): Promise<HierarchicalCluster['history']> {
  const history: HierarchicalCluster['history'] = []

  for (const dataPoint of historicalData) {
    // Generate embeddings for historical search terms
    const historicalEmbeddings = await Promise.all(
      dataPoint.searchTerms.map(async (term) => {
        const embedding = await generateEmbedding(term.Search_Term, openai)
        return {
          term: term.Search_Term,
          volume: term.Volume,
          clickShare: term.Click_Share || 0,
          competition: term.Competition,
          embedding
        }
      })
    )

    // Find similar terms in historical data
    const similarTerms = findSimilarTerms(cluster.terms, historicalEmbeddings)
    
    if (similarTerms.length > 0) {
      history.push({
        timestamp: dataPoint.timestamp,
        volume: similarTerms.reduce((sum, t) => sum + t.volume, 0),
        clickShare: similarTerms.reduce((sum, t) => sum + t.clickShare, 0) / similarTerms.length,
        competition: similarTerms.reduce((sum, t) => sum + (t.competition || 0), 0) / similarTerms.length,
        terms: similarTerms.map(t => t.term)
      })
    }
  }

  return history
}

function findSimilarTerms(
  currentTerms: EmbeddingResult[],
  historicalTerms: EmbeddingResult[],
  similarityThreshold = 0.7
): EmbeddingResult[] {
  const similarTerms: EmbeddingResult[] = []
  const currentCentroid = calculateCentroid(currentTerms)

  historicalTerms.forEach(term => {
    const similarity = cosineSimilarity(currentCentroid, term.embedding)
    if (similarity >= similarityThreshold) {
      similarTerms.push(term)
    }
  })

  return similarTerms
}

function calculateTemporalMetrics(history: NonNullable<HierarchicalCluster['history']>): TemporalMetrics {
  if (!history || history.length === 0) {
    return {
      growthRate: 0,
      volumeTrend: [],
      clickShareTrend: [],
      competitionTrend: [],
      stability: 1,
      emergenceScore: 0
    }
  }

  const volumes = history.map(h => h.volume)
  const clickShares = history.map(h => h.clickShare)
  const competitions = history.map(h => h.competition)

  // Calculate growth rate using linear regression
  const growthRate = calculateGrowthRate(volumes)

  // Calculate trends using moving averages
  const volumeTrend = calculateMovingAverage(volumes, 3)
  const clickShareTrend = calculateMovingAverage(clickShares, 3)
  const competitionTrend = calculateMovingAverage(competitions, 3)

  // Calculate stability (how consistent the cluster has been)
  const stability = calculateStability(history)

  // Calculate emergence score (how new/trending the cluster is)
  const emergenceScore = calculateEmergenceScore(volumes, growthRate, stability)

  return {
    growthRate,
    volumeTrend,
    clickShareTrend,
    competitionTrend,
    stability,
    emergenceScore
  }
}

function calculateGrowthRate(values: number[]): number {
  if (values.length < 2) return 0

  const x = values.map((_, i) => i)
  const y = values

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0)
  const sumXX = x.reduce((a, b) => a + b * b, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  return slope
}

function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = []
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const window = values.slice(start, i + 1)
    result.push(window.reduce((a, b) => a + b, 0) / window.length)
  }
  return result
}

function calculateStability(history: NonNullable<HierarchicalCluster['history']>): number {
  if (history.length < 2) return 1

  // Calculate term overlap between consecutive time periods
  let totalOverlap = 0
  for (let i = 1; i < history.length; i++) {
    const currentTerms = new Set(history[i].terms)
    const previousTerms = new Set(history[i - 1].terms)
    const overlap = Array.from(currentTerms).filter(term => previousTerms.has(term)).length
    totalOverlap += overlap / Math.max(currentTerms.size, previousTerms.size)
  }

  return totalOverlap / (history.length - 1)
}

function calculateEmergenceScore(
  volumes: number[],
  growthRate: number,
  stability: number
): number {
  // Normalize growth rate to 0-1 range
  const normalizedGrowth = Math.min(1, Math.max(0, (growthRate + 1) / 2))
  
  // Calculate volume acceleration
  const volumeAcceleration = calculateGrowthRate(volumes.map((v, i) => 
    i > 0 ? v - volumes[i - 1] : 0
  ))
  const normalizedAcceleration = Math.min(1, Math.max(0, (volumeAcceleration + 1) / 2))
  
  // Combine factors with weights
  const growthWeight = 0.4
  const accelerationWeight = 0.4
  const stabilityWeight = 0.2
  
  return (
    normalizedGrowth * growthWeight +
    normalizedAcceleration * accelerationWeight +
    (1 - stability) * stabilityWeight
  )
}

async function extractMetadataPatterns(
  terms: string[],
  metadata: Array<Record<string, any>>,
  openai: OpenAI
): Promise<MetadataAnalysis['patterns']> {
  const functionPatterns: MetadataAnalysis['patterns']['functionPatterns'] = []
  const formatPatterns: MetadataAnalysis['patterns']['formatPatterns'] = []
  const valuePatterns: MetadataAnalysis['patterns']['valuePatterns'] = []

  // Group terms by metadata values
  const functionGroups = new Map<string, string[]>()
  const formatGroups = new Map<string, string[]>()
  const valueGroups = new Map<string, string[]>()

  metadata.forEach((meta, index) => {
    if (meta.function) {
      const group = functionGroups.get(meta.function) || []
      group.push(terms[index])
      functionGroups.set(meta.function, group)
    }
    if (meta.format) {
      const group = formatGroups.get(meta.format) || []
      group.push(terms[index])
      formatGroups.set(meta.format, group)
    }
    if (meta.values) {
      const group = valueGroups.get(meta.values) || []
      group.push(terms[index])
      valueGroups.set(meta.values, group)
    }
  })

  // Analyze patterns within each group
  for (const [functionType, groupTerms] of Array.from(functionGroups)) {
    const pattern = await analyzePattern(groupTerms, openai)
    functionPatterns.push({
      pattern: pattern.description,
      confidence: pattern.confidence,
      terms: groupTerms
    })
  }

  for (const [formatType, groupTerms] of Array.from(formatGroups)) {
    const pattern = await analyzePattern(groupTerms, openai)
    formatPatterns.push({
      pattern: pattern.description,
      confidence: pattern.confidence,
      terms: groupTerms
    })
  }

  for (const [valueType, groupTerms] of Array.from(valueGroups)) {
    const pattern = await analyzePattern(groupTerms, openai)
    valuePatterns.push({
      pattern: pattern.description,
      confidence: pattern.confidence,
      terms: groupTerms
    })
  }

  return {
    functionPatterns,
    formatPatterns,
    valuePatterns
  }
}

async function analyzeMetadataRelationships(
  terms: string[],
  metadata: Array<Record<string, any>>,
  openai: OpenAI
): Promise<MetadataAnalysis['relationships']> {
  const functionFormatPairs: MetadataAnalysis['relationships']['functionFormatPairs'] = []
  const functionValuePairs: MetadataAnalysis['relationships']['functionValuePairs'] = []
  const formatValuePairs: MetadataAnalysis['relationships']['formatValuePairs'] = []

  // Group terms by metadata combinations
  const functionFormatGroups = new Map<string, string[]>()
  const functionValueGroups = new Map<string, string[]>()
  const formatValueGroups = new Map<string, string[]>()

  metadata.forEach((meta, index) => {
    if (meta.function && meta.format) {
      const key = `${meta.function}:${meta.format}`
      const group = functionFormatGroups.get(key) || []
      group.push(terms[index])
      functionFormatGroups.set(key, group)
    }
    if (meta.function && meta.values) {
      const key = `${meta.function}:${meta.values}`
      const group = functionValueGroups.get(key) || []
      group.push(terms[index])
      functionValueGroups.set(key, group)
    }
    if (meta.format && meta.values) {
      const key = `${meta.format}:${meta.values}`
      const group = formatValueGroups.get(key) || []
      group.push(terms[index])
      formatValueGroups.set(key, group)
    }
  })

  // Analyze relationships within each group
  for (const [key, groupTerms] of Array.from(functionFormatGroups)) {
    const [functionType, formatType] = key.split(':')
    const relationship = await analyzeRelationship(groupTerms, openai)
    functionFormatPairs.push({
      function: functionType,
      format: formatType,
      confidence: relationship.confidence,
      terms: groupTerms
    })
  }

  for (const [key, groupTerms] of Array.from(functionValueGroups)) {
    const [functionType, valueType] = key.split(':')
    const relationship = await analyzeRelationship(groupTerms, openai)
    functionValuePairs.push({
      function: functionType,
      value: valueType,
      confidence: relationship.confidence,
      terms: groupTerms
    })
  }

  for (const [key, groupTerms] of Array.from(formatValueGroups)) {
    const [formatType, valueType] = key.split(':')
    const relationship = await analyzeRelationship(groupTerms, openai)
    formatValuePairs.push({
      format: formatType,
      value: valueType,
      confidence: relationship.confidence,
      terms: groupTerms
    })
  }

  return {
    functionFormatPairs,
    functionValuePairs,
    formatValuePairs
  }
}

async function generateMetadataInsights(
  patterns: MetadataAnalysis['patterns'],
  relationships: MetadataAnalysis['relationships'],
  terms: string[],
  openai: OpenAI
): Promise<MetadataAnalysis['insights']> {
  const insights: MetadataAnalysis['insights'] = []

  // Generate insights from patterns
  for (const pattern of patterns.functionPatterns) {
    const insight = await generateInsight(pattern, 'function', openai)
    insights.push(insight)
  }

  for (const pattern of patterns.formatPatterns) {
    const insight = await generateInsight(pattern, 'format', openai)
    insights.push(insight)
  }

  for (const pattern of patterns.valuePatterns) {
    const insight = await generateInsight(pattern, 'value', openai)
    insights.push(insight)
  }

  // Generate insights from relationships
  for (const relationship of relationships.functionFormatPairs) {
    const insight = await generateRelationshipInsight(relationship, 'functionFormat', openai)
    insights.push(insight)
  }

  for (const relationship of relationships.functionValuePairs) {
    const insight = await generateRelationshipInsight(relationship, 'functionValue', openai)
    insights.push(insight)
  }

  for (const relationship of relationships.formatValuePairs) {
    const insight = await generateRelationshipInsight(relationship, 'formatValue', openai)
    insights.push(insight)
  }

  return insights
}

async function analyzePattern(
  terms: string[],
  openai: OpenAI
): Promise<{ description: string; confidence: number }> {
  const prompt = `Analyze these search terms and identify the common pattern: ${terms.join(', ')}. 
  Provide a concise description of the pattern and a confidence score (0-1). 
  Format your response as JSON:
  {
    "description": "string",
    "confidence": number
  }`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert at identifying patterns in search terms. Provide clear, concise descriptions with confidence scores.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    return JSON.parse(response.choices[0].message.content || '{"description":"","confidence":0}')
  } catch (error) {
    console.error("Failed to parse pattern analysis:", error)
    return { description: "No pattern identified", confidence: 0 }
  }
}

async function analyzeRelationship(
  terms: string[],
  openai: OpenAI
): Promise<{ description: string; confidence: number }> {
  const prompt = `Analyze these search terms and identify the relationship between their metadata attributes: ${terms.join(', ')}. 
  Provide a concise description of the relationship and a confidence score (0-1). 
  Format your response as JSON:
  {
    "description": "string",
    "confidence": number
  }`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert at identifying relationships between metadata attributes. Provide clear, concise descriptions with confidence scores.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    return JSON.parse(response.choices[0].message.content || '{"description":"","confidence":0}')
  } catch (error) {
    console.error("Failed to parse relationship analysis:", error)
    return { description: "No relationship identified", confidence: 0 }
  }
}

async function generateInsight(
  pattern: { pattern: string; confidence: number; terms: string[] },
  type: 'function' | 'format' | 'value',
  openai: OpenAI
): Promise<MetadataAnalysis['insights'][0]> {
  const prompt = `Based on this ${type} pattern: "${pattern.pattern}", generate a business insight. 
  Consider the following terms: ${pattern.terms.join(', ')}. 
  Format your response as JSON:
  {
    "description": "string",
    "confidence": number
  }`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert at generating business insights from patterns. Provide clear, actionable insights with confidence scores.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{"description":"","confidence":0}')
    return {
      type,
      description: result.description,
      confidence: result.confidence * pattern.confidence,
      supportingTerms: pattern.terms
    }
  } catch (error) {
    console.error("Failed to parse insight generation:", error)
    return {
      type,
      description: "No insight generated",
      confidence: 0,
      supportingTerms: pattern.terms
    }
  }
}

async function generateRelationshipInsight(
  relationship: { confidence: number; terms: string[] },
  type: 'functionFormat' | 'functionValue' | 'formatValue',
  openai: OpenAI
): Promise<MetadataAnalysis['insights'][0]> {
  const prompt = `Based on this ${type} relationship, generate a business insight. 
  Consider the following terms: ${relationship.terms.join(', ')}. 
  Format your response as JSON:
  {
    "description": "string",
    "confidence": number
  }`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are an expert at generating business insights from relationships. Provide clear, actionable insights with confidence scores.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{"description":"","confidence":0}')
    return {
      type: 'relationship',
      description: result.description,
      confidence: result.confidence * relationship.confidence,
      supportingTerms: relationship.terms
    }
  } catch (error) {
    console.error("Failed to parse relationship insight generation:", error)
    return {
      type: 'relationship',
      description: "No insight generated",
      confidence: 0,
      supportingTerms: relationship.terms
    }
  }
}

async function analyzeTrendClassification(
  cluster: HierarchicalCluster,
  description: ClusterDescription,
  openai: OpenAI
): Promise<TrendClassification> {
  const prompt = `Analyze this cluster and classify its trend characteristics:

Cluster Title: ${description.title}
Behavioral Insight: ${description.behavioralInsight}
Terms: ${cluster.terms.map(t => t.term).join(", ")}
${cluster.tags ? `Tags: ${cluster.tags.map(t => `${t.category}: ${t.value}`).join(", ")}` : ''}
Metrics:
- Volume: ${cluster.terms.reduce((sum, t) => sum + t.volume, 0)}
- Growth: ${cluster.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / cluster.terms.length}
- Click Share: ${cluster.terms.reduce((sum, t) => sum + t.clickShare, 0) / cluster.terms.length}

Generate a response in JSON format with the following structure:
{
  "primaryCategory": "Main category this trend belongs to",
  "secondaryCategories": ["Additional relevant categories"],
  "behavioralClassifiers": [
    {
      "type": "One of: ritual, clean-label, stacked-formula, lifestyle, solution, or custom",
      "value": "Specific classification value",
      "confidence": "Confidence score 0-1",
      "evidence": ["Supporting evidence points"]
    }
  ],
  "trendStrength": {
    "score": "Overall trend strength score 0-1",
    "factors": [
      {
        "name": "Factor name",
        "value": "Factor value 0-1",
        "impact": "positive, negative, or neutral"
      }
    ]
  }
}`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing market trends and consumer behavior.
        Focus on identifying:
        1. Primary and secondary categories that best describe the trend
        2. Behavioral classifiers that capture how consumers interact with these products
        3. Trend strength based on multiple factors
        Be specific and evidence-based in your classifications.
        Use the provided metrics and terms to support your analysis.`
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}')
    return {
      primaryCategory: result.primaryCategory || "Uncategorized",
      secondaryCategories: result.secondaryCategories || [],
      behavioralClassifiers: result.behavioralClassifiers || [],
      trendStrength: {
        score: result.trendStrength?.score || 0,
        factors: result.trendStrength?.factors || []
      }
    }
  } catch (error) {
    console.error("Failed to parse trend classification:", error)
    return {
      primaryCategory: "Uncategorized",
      secondaryCategories: [],
      behavioralClassifiers: [],
      trendStrength: {
        score: 0,
        factors: []
      }
    }
  }
}

async function analyzeConfidence(
  cluster: HierarchicalCluster,
  description: ClusterDescription,
  openai: OpenAI
): Promise<ConfidenceAnalysis> {
  const prompt = `Analyze the confidence and evidence for this cluster:

Cluster Title: ${description.title}
Behavioral Insight: ${description.behavioralInsight}
Terms: ${cluster.terms.map(t => t.term).join(", ")}
${cluster.tags ? `Tags: ${cluster.tags.map(t => `${t.category}: ${t.value}`).join(", ")}` : ''}
Metrics:
- Volume: ${cluster.terms.reduce((sum, t) => sum + t.volume, 0)}
- Growth: ${cluster.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / cluster.terms.length}
- Click Share: ${cluster.terms.reduce((sum, t) => sum + t.clickShare, 0) / cluster.terms.length}
${cluster.temporalMetrics ? `
Temporal Metrics:
- Growth Rate: ${cluster.temporalMetrics.growthRate}
- Stability: ${cluster.temporalMetrics.stability}
- Emergence Score: ${cluster.temporalMetrics.emergenceScore}` : ''}

Generate a response in JSON format with the following structure:
{
  "overall": "Overall confidence score 0-1",
  "components": {
    "termAnalysis": "Confidence in term clustering 0-1",
    "metricAnalysis": "Confidence in metric patterns 0-1",
    "behavioralAnalysis": "Confidence in behavioral insights 0-1",
    "marketContext": "Confidence in market relevance 0-1"
  },
  "riskFactors": [
    {
      "type": "One of: data-quality, market-volatility, term-ambiguity, competition, seasonality",
      "impact": "Impact score 0-1",
      "description": "Description of the risk factor"
    }
  ],
  "evidenceScore": {
    "score": "Overall evidence score 0-1",
    "factors": [
      {
        "name": "Factor name",
        "value": "Factor value 0-1",
        "weight": "Weight of this factor",
        "evidence": ["Supporting evidence points"]
      }
    ],
    "validation": {
      "termConsistency": "How consistent are the terms 0-1",
      "metricAlignment": "How well do metrics support the insight 0-1",
      "tagRelevance": "How relevant are the tags 0-1",
      "temporalStability": "How stable is the trend over time 0-1"
    }
  }
}`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing confidence and evidence in market trends.
        Focus on:
        1. Evaluating the strength of evidence across multiple dimensions
        2. Identifying potential risk factors and their impact
        3. Assessing the consistency and reliability of the data
        4. Validating the alignment between different data points
        Be thorough and critical in your analysis.
        Consider both quantitative and qualitative factors.`
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}')
    return {
      overall: result.overall || 0,
      components: {
        termAnalysis: result.components?.termAnalysis || 0,
        metricAnalysis: result.components?.metricAnalysis || 0,
        behavioralAnalysis: result.components?.behavioralAnalysis || 0,
        marketContext: result.components?.marketContext || 0
      },
      riskFactors: result.riskFactors || [],
      evidenceScore: {
        score: result.evidenceScore?.score || 0,
        factors: result.evidenceScore?.factors || [],
        validation: {
          termConsistency: result.evidenceScore?.validation?.termConsistency || 0,
          metricAlignment: result.evidenceScore?.validation?.metricAlignment || 0,
          tagRelevance: result.evidenceScore?.validation?.tagRelevance || 0,
          temporalStability: result.evidenceScore?.validation?.temporalStability
        }
      }
    }
  } catch (error) {
    console.error("Failed to parse confidence analysis:", error)
    return {
      overall: 0,
      components: {
        termAnalysis: 0,
        metricAnalysis: 0,
        behavioralAnalysis: 0,
        marketContext: 0
      },
      riskFactors: [],
      evidenceScore: {
        score: 0,
        factors: [],
        validation: {
          termConsistency: 0,
          metricAlignment: 0,
          tagRelevance: 0
        }
      }
    }
  }
}

function calculateMarketSizeMetrics(
  searchVolume: number,
  unitsSold: number,
  averageUnitsSold: number,
  conversionRate: number
): {
  total: number
  perProduct: number
  growthRate: number
} {
  // Calculate total market size based on search volume and conversion rate
  const totalMarketSize = searchVolume * conversionRate
  
  // Calculate market size per product
  const marketSizePerProduct = averageUnitsSold
  
  // Calculate growth rate based on historical data
  const growthRate = (unitsSold / searchVolume) * 100
  
  return {
    total: totalMarketSize,
    perProduct: marketSizePerProduct,
    growthRate
  }
}

function calculateConsumerBehaviorMetrics(
  searchVolume: number,
  unitsSold: number,
  averageUnitsSold: number
): {
  searchToPurchaseRatio: number
  averageOrderValue: number
  repeatPurchaseRate: number
} {
  // Calculate search to purchase ratio
  const searchToPurchaseRatio = unitsSold / searchVolume
  
  // Estimate average order value based on market data
  const averageOrderValue = averageUnitsSold * 1.5 // Assuming 1.5x multiplier for order value
  
  // Estimate repeat purchase rate based on market maturity
  const repeatPurchaseRate = Math.min(0.3, searchToPurchaseRatio * 2) // Cap at 30%
  
  return {
    searchToPurchaseRatio,
    averageOrderValue,
    repeatPurchaseRate
  }
}

function calculateEnhancedOpportunityScore(
  volume: number,
  growth: number,
  competition: number,
  unitsSold: number,
  averageUnitsSold: number,
  conversionRate: number
): number {
  // Normalize inputs
  const normalizedVolume = Math.min(1, volume / 10000) // Cap at 10,000
  const normalizedGrowth = Math.min(1, Math.max(0, (growth + 100) / 200)) // Convert -100 to 100 range to 0-1
  const normalizedCompetition = Math.min(1, competition / 100) // Cap at 100
  const normalizedUnitsSold = Math.min(1, unitsSold / 100000) // Cap at 100,000 units
  const normalizedAvgUnitsSold = Math.min(1, averageUnitsSold / 1000) // Cap at 1,000 units per product
  const normalizedConversion = Math.min(1, conversionRate * 10) // Cap at 10% conversion
  
  // Weighted scoring
  const volumeWeight = 0.2
  const growthWeight = 0.2
  const competitionWeight = 0.15
  const unitsSoldWeight = 0.2
  const avgUnitsSoldWeight = 0.15
  const conversionWeight = 0.1
  
  // Calculate weighted score
  const score = (
    normalizedVolume * volumeWeight +
    normalizedGrowth * growthWeight +
    (1 - normalizedCompetition) * competitionWeight +
    normalizedUnitsSold * unitsSoldWeight +
    normalizedAvgUnitsSold * avgUnitsSoldWeight +
    normalizedConversion * conversionWeight
  ) * 100
  
  return Math.round(Math.min(100, Math.max(0, score)))
}

export async function analyzeLevel1Data(
  data: Level1Data[],
  openai: OpenAI
): Promise<Level1Analysis[]> {
  const prompt = `Analyze these customer needs and suggest which niches are most promising for deeper exploration:

${data.map(item => `
Niche: ${item.Customer_Need}
- Search Volume: ${item.Search_Volume}
- Growth: ${item.Search_Volume_Growth || 0}%
- Click Share: ${(item.Click_Share * 100).toFixed(1)}%
- Conversion Rate: ${(item.Conversion_Rate * 100).toFixed(1)}%
- Brand Concentration: ${(item.Brand_Concentration * 100).toFixed(1)}%
- Units Sold (360 days): ${item.Units_Sold}
- Average Units Sold: ${item.Average_Units_Sold}
`).join('\n')}

For each niche, provide a JSON response with:
{
  "niche": "The customer need/niche name",
  "opportunityScore": "Score from 0-100 based on market opportunity",
  "marketMetrics": {
    "searchVolume": "Raw search volume",
    "growth": "Growth rate percentage",
    "clickShare": "Click share percentage",
    "conversionRate": "Conversion rate percentage",
    "brandConcentration": "Brand concentration percentage",
    "unitsSold": "Total units sold in 360 days",
    "averageUnitsSold": "Average units sold per product",
    "marketSize": {
      "total": "Total market size estimate",
      "perProduct": "Average market size per product",
      "growthRate": "Market growth rate"
    },
    "consumerBehavior": {
      "searchToPurchaseRatio": "Ratio of searches to purchases",
      "averageOrderValue": "Estimated average order value",
      "repeatPurchaseRate": "Estimated repeat purchase rate"
    }
  },
  "trendAnalysis": {
    "growthTrend": "One of: accelerating, stable, declining",
    "marketMaturity": "One of: emerging, growing, mature",
    "competitionLevel": "One of: low, medium, high"
  },
  "suggestedFocus": {
    "primary": "Primary area to focus on",
    "secondary": ["Additional areas to consider"]
  },
  "confidence": "Confidence score 0-1",
  "evidence": {
    "keyMetrics": [
      {
        "name": "Metric name",
        "value": "Metric value",
        "significance": "Why this metric is significant"
      }
    ],
    "supportingFactors": ["List of positive factors"],
    "riskFactors": ["List of potential risks"]
  }
}`

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing market opportunities and suggesting promising niches.
        Focus on:
        1. Identifying niches with strong growth potential and market size
        2. Assessing consumer behavior and purchase patterns
        3. Highlighting both opportunities and risks
        4. Providing evidence-based recommendations
        Be thorough and critical in your analysis.
        Consider both quantitative metrics and qualitative factors.`
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }
  })

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}')
    return Array.isArray(result) ? result : [result]
  } catch (error) {
    console.error("Failed to parse Level 1 analysis:", error)
    return data.map(item => {
      const marketSize = calculateMarketSizeMetrics(
        item.Search_Volume,
        item.Units_Sold,
        item.Average_Units_Sold,
        item.Conversion_Rate
      )
      
      const consumerBehavior = calculateConsumerBehaviorMetrics(
        item.Search_Volume,
        item.Units_Sold,
        item.Average_Units_Sold
      )
      
      return {
        niche: item.Customer_Need,
        opportunityScore: calculateEnhancedOpportunityScore(
          item.Search_Volume,
          item.Search_Volume_Growth || 0,
          item.Brand_Concentration * 100,
          item.Units_Sold,
          item.Average_Units_Sold,
          item.Conversion_Rate
        ),
        marketMetrics: {
          searchVolume: item.Search_Volume,
          growth: item.Search_Volume_Growth || 0,
          clickShare: item.Click_Share,
          conversionRate: item.Conversion_Rate,
          brandConcentration: item.Brand_Concentration,
          unitsSold: item.Units_Sold,
          averageUnitsSold: item.Average_Units_Sold,
          marketSize,
          consumerBehavior
        },
        trendAnalysis: {
          growthTrend: 'stable',
          marketMaturity: 'mature',
          competitionLevel: 'medium'
        },
        suggestedFocus: {
          primary: "No analysis available",
          secondary: []
        },
        confidence: 0,
        evidence: {
          keyMetrics: [],
          supportingFactors: [],
          riskFactors: []
        }
      }
    })
  }
} 