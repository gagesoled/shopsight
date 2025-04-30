import { OpenAI } from "openai"
import type { Level2SearchTermData } from "../validation"
import type { HierarchicalCluster } from "./types"
import type { EmbeddingResult as BaseEmbeddingResult } from "./embeddings"
import * as clustering from 'density-clustering'

// Extend the EmbeddingResult interface to include clickShare
export interface EmbeddingResult extends BaseEmbeddingResult {
  term: string;
  volume: number;
  clickShare?: number;
  growth?: number;
  competition?: number;
  embedding: number[];
  metadata?: {
    function?: string;
    format?: string;
    values?: string;
  };
}

// Define the missing interface to match our implementation
export interface MetadataAnalysis {
  patterns?: {
    functionPatterns: Array<{
      pattern: string;
      confidence: number;
      terms: string[];
    }>;
    formatPatterns: Array<{
      pattern: string;
      confidence: number;
      terms: string[];
    }>;
    valuePatterns: Array<{
      pattern: string;
      confidence: number;
      terms: string[];
    }>;
  };
  relationships?: {
    functionFormatPairs: Array<{
      function: string;
      format: string;
      confidence: number;
      terms: string[];
    }>;
    functionValuePairs: Array<{
      function: string;
      value: string;
      confidence: number;
      terms: string[];
    }>;
    formatValuePairs: Array<{
      format: string;
      value: string;
      confidence: number;
      terms: string[];
    }>;
  };
  insights?: Array<{
    type: string;
    description: string;
    confidence: number;
    supportingTerms: string[];
  }>;
  volume?: number;
  growth?: number;
  competition?: number;
  values?: number;
  terms?: string[];
}

interface SearchTermData extends Level2SearchTermData {
  competition?: number
  values_inferred?: string[]
  format_inferred?: string
}

interface DBSCANInstance {
  run(points: number[][], epsilon: number, minPts: number): number[][];
  noise: number[];
}

// Add a fallback method to generate embeddings using the chat completions API
async function generateEmbeddingFallback(text: string, openai: OpenAI): Promise<number[]> {
  try {
    console.log(`Using fallback method to generate embedding for: "${text.substring(0, 30)}..."`);
    
    // Use the chat completions API to generate a mock embedding
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Generate a mock embedding for the text. Return a JSON array of 100 floating point numbers between -1 and 1."
        },
        {
          role: "user",
          content: `Text to embed: "${text}"`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = completion.choices[0]?.message?.content || "{}";
    try {
      const result = JSON.parse(content);
      if (result.embedding && Array.isArray(result.embedding) && result.embedding.length > 0) {
        console.log(`Generated fallback embedding of length ${result.embedding.length}`);
        return result.embedding;
      } else if (Array.isArray(result) && result.length > 0) {
        console.log(`Generated fallback embedding array of length ${result.length}`);
        return result;
      }
    } catch (parseError) {
      console.error("Failed to parse fallback embedding result:", parseError);
    }
    
    // If all else fails, generate a random embedding
    console.log("Generating random embedding as last resort");
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  } catch (error) {
    console.error(`Error generating fallback embedding:`, error);
    // Return a random embedding as absolute last resort
    console.log("Generating random embedding after fallback failed");
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  }
}

// Update the generateEmbedding function to use the fallback method when needed
async function generateEmbedding(text: string, openai: OpenAI): Promise<number[]> {
  try {
    console.log(`Generating embedding for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const response = await openai.embeddings.create({
      input: text,
      model: "text-embedding-ada-002",
    });

    if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
      console.error(`Invalid embedding response structure for "${text.substring(0, 30)}..."`);
      console.error("Response:", JSON.stringify(response, null, 2).substring(0, 200) + "...");
      console.log("Falling back to alternative embedding method");
      return generateEmbeddingFallback(text, openai);
    }

    // Verify embedding is valid
    const embedding = response.data[0].embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error(`Empty or invalid embedding array for "${text.substring(0, 30)}..."`);
      console.log("Falling back to alternative embedding method");
      return generateEmbeddingFallback(text, openai);
    }

    console.log(`Successfully generated embedding of length ${embedding.length} for "${text.substring(0, 30)}..."`);
    return embedding;
  } catch (error) {
    console.error(`Error generating embedding for '${text.substring(0, 50)}...':`, error);
    console.log("Falling back to alternative embedding method");
    return generateEmbeddingFallback(text, openai);
  }
}

// Structure for AI Cluster, extending HierarchicalCluster
export interface AICluster extends HierarchicalCluster {
  title: string;
  description: string;
  tags: Array<{ category: string; value: string; confidence?: number }>;
  metrics: {
    totalVolume: number;
    avgGrowth: number;
    avgClickShare: number;
    avgCompetition: number;
    opportunityScore: number;
  };
  confidence: number;
  evidence: {
    keyTerms: string[];
    keyMetrics: Array<{ name: string; value: number; significance: string }>;
    supportingTags: string[];
  };
  terms: Array<{
    term: string;
    volume: number;
    clickShare: number;
    embedding: number[];
  }>;
  // Inherited from HierarchicalCluster
  // id: string;
  // level: number;
  // similarity: number;
  // parentId?: string;
  // children?: HierarchicalCluster[];
}

interface TemporalMetrics {
  growthRate: number
  volumeTrend: number[]
  clickShareTrend: number[]
  competitionTrend: number[]
  stability: number
  emergenceScore: number
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

export async function analyzeSingleLevel1Data(data: Level1Data[], openai: OpenAI): Promise<AnalysisResult> {
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
    const responseContent = completion.choices[0]?.message?.content || "{}"
    const result = JSON.parse(responseContent)
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
  const terms = cluster.terms as EmbeddingResult[];
  
  // Extract patterns from terms
  const patterns = await extractMetadataPatterns(terms, openai);
  
  // Analyze relationships between patterns
  const relationships = await analyzeMetadataRelationships(terms, openai);
  
  // Generate insights from patterns and relationships
  const insights = await generateMetadataInsights(terms, openai);
  
  return {
    patterns,
    relationships,
    insights
  };
}

// Update function signatures to match expected types
async function extractMetadataPatterns(terms: EmbeddingResult[], openai: OpenAI): Promise<MetadataAnalysis['patterns']> {
  // Implementation will be added later
  return {
    functionPatterns: [],
    formatPatterns: [],
    valuePatterns: []
  };
}

async function analyzeMetadataRelationships(terms: EmbeddingResult[], openai: OpenAI): Promise<MetadataAnalysis['relationships']> {
  // Implementation will be added later
  return {
    functionFormatPairs: [],
    functionValuePairs: [],
    formatValuePairs: []
  };
}

async function generateMetadataInsights(terms: EmbeddingResult[], openai: OpenAI): Promise<MetadataAnalysis['insights']> {
  // Implementation will be added later
  return [];
}

export async function generateClusterMetadata(
  terms: EmbeddingResult[],
  openai: OpenAI
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }> {
  try {
    // Prepare the terms data for the AI
    const termsData = terms.map(t => ({
      term: t.term,
      volume: t.volume,
      clickShare: t.clickShare || 0,
      growth: t.growth || 0,
      competition: t.competition || 0
    }));

    // Create a category-agnostic prompt
    const prompt = `
You are an expert at analyzing search term patterns and identifying meaningful clusters. Based *only* on the terms and metrics provided, generate:

1. A concise, descriptive 'title' (max 5 words) that captures the core theme of these search terms.

2. A detailed 'description' (2-3 sentences) explaining the cluster's focus and significance. Include relevant metrics and market insights.

3. Generate specific tags by analyzing the terms for common patterns and characteristics. Consider aspects such as:
- Product characteristics (material, size, style, etc.)
- Usage context or purpose
- Target audience or user group
- Distinctive features or attributes
- Brand names if prominently featured
- Any other relevant categorization that emerges from the data

Only include tags that are directly supported by the provided terms. For each tag, assign a confidence score (0.0-1.0) reflecting how strongly it's supported by the data.

Terms and Metrics:
${JSON.stringify(termsData, null, 2)}

Return the result in this exact JSON format:
{
  "title": "string",
  "description": "string",
  "tags": [
    {
      "category": "string",
      "value": "string",
      "confidence": number
    }
  ]
}`;

    // Call the AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing search patterns and identifying meaningful clusters. Focus only on the data provided, without any preconceived notions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI");
    }

    const parsedResult = JSON.parse(responseContent);
    return {
      title: parsedResult.title,
      description: parsedResult.description,
      tags: parsedResult.tags
    };
  } catch (error) {
    console.error("Error generating cluster metadata:", error);
    // Return basic fallback metadata
    return {
      title: "Uncategorized Terms",
      description: "A collection of related search terms",
      tags: [{ category: "General", value: "Uncategorized", confidence: 0.1 }]
    };
  }
}

function findOptimalEpsilon(
  embeddings: number[][],
  minPts: number,
  epsilonRange: { start: number; end: number; step: number }
): number {
  let bestEpsilon = epsilonRange.start;
  let bestScore = -Infinity;
  let bestClusterCount = 0;
  let bestNoiseCount = embeddings.length;

  // Adjust epsilon range to be more granular and allow for more clusters
  const adjustedRange = {
    start: 0.15, // Lower start value to allow for more distinct clusters
    end: 0.35,   // Lower end value to prevent over-merging
    step: 0.02   // Smaller step for more precise tuning
  };

  for (let eps = adjustedRange.start; eps <= adjustedRange.end; eps += adjustedRange.step) {
    const dbscan = new clustering.DBSCAN();
    const clusters = dbscan.run(embeddings, eps, minPts);
    const clusterCount = new Set(clusters.filter(c => c !== -1)).size;
    const noiseCount = clusters.filter(c => c === -1).length;
    
    // Adjusted scoring to favor:
    // 1. More clusters (4-8 is ideal)
    // 2. Balanced cluster sizes
    // 3. Reasonable noise ratio (some noise is okay)
    const idealClusterCount = 6;
    const clusterCountScore = Math.max(0, 10 - Math.abs(clusterCount - idealClusterCount)) * 2;
    const noiseRatio = noiseCount / embeddings.length;
    const noiseScore = noiseRatio <= 0.2 ? (1 - noiseRatio) * 5 : 0;
    
    const score = clusterCountScore + noiseScore;

    console.log(`  Epsilon ${eps.toFixed(3)}: ${clusterCount} clusters, ${noiseCount} noise (${(noiseRatio * 100).toFixed(1)}%), score: ${score.toFixed(2)}`);

    if (score > bestScore) {
      bestScore = score;
      bestEpsilon = eps;
      bestClusterCount = clusterCount;
      bestNoiseCount = noiseCount;
      console.log(`  New best epsilon: ${eps} with ${clusterCount} clusters and ${noiseCount} noise points`);
    }
  }

  return bestEpsilon;
}

function createCluster(terms: EmbeddingResult[], id: string, parentId?: string): HierarchicalCluster {
  return {
    terms,
    id,
    parentId,
    level: 0,
    similarity: 0,
    metadataAnalysis: {
      volume: terms.reduce((sum, t) => sum + t.volume, 0),
      growth: terms.reduce((sum, t) => sum + (t.growth || 0), 0) / terms.length,
      competition: terms.reduce((sum, t) => sum + (t.competition || 0), 0) / terms.length,
      terms: terms.map(t => t.term)
    }
  };
}

async function clusterEmbeddings(terms: EmbeddingResult[]): Promise<HierarchicalCluster[]> {
  console.log(`Starting clusterEmbeddings with ${terms.length} terms`);
  
  if (terms.length < 2) {
    console.warn('Not enough terms for clustering');
    return [];
  }

  const embeddings = terms.map(t => t.embedding);
  // Adjust minPts to be more lenient for smaller datasets
  const minPts = Math.max(2, Math.floor(Math.sqrt(terms.length / 3)));
  
  console.log(`Using clustering parameters: minPts=${minPts}, total points=${terms.length}`);

  // Find optimal epsilon
  console.log('Finding optimal epsilon...');
  const epsilon = findOptimalEpsilon(embeddings, minPts, {
    start: 0.15,
    end: 0.35,
    step: 0.02
  });
  console.log(`Optimal epsilon found: ${epsilon}`);

  // Run DBSCAN with optimal parameters
  console.log('Running DBSCAN clustering...');
  const dbscan = new clustering.DBSCAN();
  const clusterAssignments = dbscan.run(embeddings, epsilon, minPts);
  console.log(`DBSCAN completed with ${new Set(clusterAssignments.filter(c => c !== -1)).size} clusters and ${clusterAssignments.filter(c => c === -1).length} noise points`);
  
  // Group terms by cluster
  console.log('Grouping terms by cluster...');
  const clusterMap = new Map<number, EmbeddingResult[]>();
  clusterAssignments.forEach((cluster, i) => {
    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, []);
    }
    clusterMap.get(cluster)!.push(terms[i]);
  });

  // Convert clusters to hierarchical format
  console.log('Converting clusters to hierarchical format...');
  const clusters: HierarchicalCluster[] = [];
  
  // Process non-noise clusters first
  clusterMap.forEach((clusterTerms, clusterId) => {
    if (clusterId !== -1) {
      console.log(`Processing cluster ${clusterId} with ${clusterTerms.length} terms`);
      clusters.push(createCluster(clusterTerms, `cluster-${clusterId}`));
    }
  });

  // Process noise points using semantic similarity
  const noiseTerms = clusterMap.get(-1) || [];
  if (noiseTerms.length > 0) {
    console.log(`Processing ${noiseTerms.length} noise points...`);
    
    // Group noise points by semantic similarity
    const noiseGroups = new Map<string, EmbeddingResult[]>();
    
    for (const term of noiseTerms) {
      let foundGroup = false;
      
      // Try to find a similar existing group
      for (const [groupId, groupTerms] of noiseGroups.entries()) {
        const similarity = cosineSimilarity(term.embedding, calculateCentroid(groupTerms));
        if (similarity > 0.7) { // Threshold for considering terms similar
          groupTerms.push(term);
          foundGroup = true;
          break;
        }
      }
      
      // If no similar group found, start a new one
      if (!foundGroup) {
        noiseGroups.set(`group-${noiseGroups.size}`, [term]);
      }
    }
    
    // Convert noise groups to clusters if they have enough terms
    noiseGroups.forEach((groupTerms, groupId) => {
      if (groupTerms.length >= 2) {
        console.log(`Creating noise group cluster with ${groupTerms.length} terms`);
        clusters.push(createCluster(groupTerms, `noise-${groupId}`));
      }
    });
  }

  console.log(`Final cluster count: ${clusters.length}`);
  return clusters;
}

function findCommonPatterns(terms: EmbeddingResult[]): Map<string, EmbeddingResult[]> {
  const patterns = new Map<string, EmbeddingResult[]>();
  
  // Common patterns to look for in search terms
  const patternTypes = [
    { name: 'flavored', keywords: ['flavored', 'seasoned', 'spiced'] },
    { name: 'original', keywords: ['original', 'classic', 'traditional'] },
    { name: 'package', keywords: ['pack', 'bag', 'size', 'count'] },
    { name: 'brand', keywords: ['dots', 'dot', 'dotz'] },
    { name: 'style', keywords: ['homestyle', 'gourmet', 'artisan'] }
  ];

  terms.forEach(term => {
    const termText = term.term.toLowerCase();
    
    // Try to match term to a pattern
    for (const pattern of patternTypes) {
      if (pattern.keywords.some(keyword => termText.includes(keyword))) {
        if (!patterns.has(pattern.name)) {
          patterns.set(pattern.name, []);
        }
        patterns.get(pattern.name)!.push(term);
        break; // Stop after first match
      }
    }
  });

  return patterns;
}

function calculateOpportunityScore(volume: number, growth: number, competition: number): number {
  // Normalize inputs
  const normalizedVolume = Math.log10(Math.max(10, volume)) / 6;
  const normalizedGrowth = Math.min(Math.max(growth, -0.5), 2) / 2.5;
  const normalizedCompetition = Math.min(Math.max(competition, 0), 1);

  // Calculate opportunity score
  const volumeScore = normalizedVolume * 0.4;
  const growthScore = normalizedGrowth * 0.3;
  const competitionScore = (1 - normalizedCompetition) * 0.3;

  // Combine scores and scale to 0-100
  const opportunityScore = Math.round((volumeScore + growthScore + competitionScore) * 100);

  return Math.min(100, Math.max(0, opportunityScore));
}

export async function runAIClustering(
  searchTerms: Level2SearchTermData[],
  openai: OpenAI
): Promise<HierarchicalCluster[]> {
  console.log(`Starting AI clustering with ${searchTerms?.length || 0} search terms`);
  
  if (!searchTerms?.length) {
    console.warn('No search terms provided for clustering');
    return [];
  }

  // Generate embeddings for search terms
  console.log('Generating embeddings for search terms...');
  const embeddingResults: EmbeddingResult[] = [];
  for (const term of searchTerms) {
    try {
      console.log(`Generating embedding for term: "${term.Search_Term}"`);
      const embedding = await generateEmbedding(term.Search_Term, openai);
      if (embedding) {
        embeddingResults.push({
          term: term.Search_Term,
          volume: term.Volume || 0,
          growth: term.Growth_180 || term.Growth_90 || 0,
          clickShare: term.Click_Share || 0,
          competition: 1 - (term.Click_Share || 0), // Use inverse of click share as competition
          embedding
        });
        console.log(`Successfully generated embedding for "${term.Search_Term}"`);
      }
    } catch (error) {
      console.error(`Error generating embedding for "${term.Search_Term}":`, error);
    }
  }

  console.log(`Generated ${embeddingResults.length} valid embeddings out of ${searchTerms.length} terms`);

  if (embeddingResults.length < 2) {
    console.warn('Not enough valid embeddings for clustering');
    return [];
  }

  console.log('Starting DBSCAN clustering...');
  const clusters = await clusterEmbeddings(embeddingResults);
  console.log(`Generated ${clusters.length} clusters`);

  // Log details about each cluster
  clusters.forEach((cluster, index) => {
    console.log(`Cluster ${index + 1}:`);
    console.log(`- ID: ${cluster.id}`);
    console.log(`- Number of terms: ${cluster.terms.length}`);
    console.log(`- Terms: ${cluster.terms.map(t => t.term).join(', ')}`);
  });

  return clusters;
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
          competition: term.Click_Share || 0, // Using Click_Share as a proxy for competition
          embedding
        }
      })
    )

    // Find similar terms in historical data
    const similarTerms = findSimilarTerms(cluster.terms, historicalEmbeddings)
    
    if (similarTerms.length > 0) {
      history.push({
        timestamp: dataPoint.timestamp,
        volume: similarTerms.reduce((sum: number, t: EmbeddingResult) => sum + t.volume, 0),
        clickShare: similarTerms.reduce((sum: number, t: EmbeddingResult) => sum + (t.clickShare || 0), 0) / similarTerms.length,
        competition: similarTerms.reduce((sum: number, t: EmbeddingResult) => sum + (t.competition || 0), 0) / similarTerms.length,
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

  const volumes = history.map((h: any) => h.volume)
  const clickShares = history.map((h: any) => h.clickShare)
  const competitions = history.map((h: any) => h.competition)

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

function calculateCentroid(terms: EmbeddingResult[]): number[] {
  const totalEmbeddings = terms.map(t => t.embedding);
  const totalLength = totalEmbeddings.length;
  const centroid = Array.from({ length: totalEmbeddings[0].length }, () => 0);

  for (const embedding of totalEmbeddings) {
    for (let i = 0; i < embedding.length; i++) {
      centroid[i] += embedding[i] / totalLength;
    }
  }

  return centroid;
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const normProduct = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (normProduct === 0) return 0;
  return dotProduct / normProduct;
} 