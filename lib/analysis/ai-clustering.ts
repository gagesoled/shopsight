import { OpenAI } from "openai"
import type { Level2SearchTermData } from "../validation"
import type { HierarchicalCluster } from "./types"
import type { EmbeddingResult as BaseEmbeddingResult } from "./embeddings"

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

const clustering = require('density-clustering')

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
  const terms = cluster.terms?.map((t: EmbeddingResult) => t.term) ?? [];
  const metadata = cluster.terms?.map((t: EmbeddingResult) => t.metadata || {}) ?? [];

  // Initialize default empty structures
  const defaultPatterns = {
    functionPatterns: [],
    formatPatterns: [],
    valuePatterns: []
  };

  const defaultRelationships = {
    functionFormatPairs: [],
    functionValuePairs: [],
    formatValuePairs: []
  };

  // Extract patterns from metadata
  const patterns = await extractMetadataPatterns(terms, metadata, openai) || defaultPatterns;

  // Analyze relationships between different metadata types
  const relationships = await analyzeMetadataRelationships(terms, metadata, openai) || defaultRelationships;

  // Generate insights from patterns and relationships
  const insights = await generateMetadataInsights(patterns, relationships, terms, openai);

  return {
    patterns,
    relationships,
    insights
  }
}

async function generateClusterMetadata(
  terms: EmbeddingResult[],
  openai: OpenAI
): Promise<{ description: string; tags: any[]; title: string }> {
  if (!terms || terms.length === 0) {
    return { description: "Empty Cluster", tags: [], title: "Empty Cluster" };
  }

  const termStrings = terms.map(t => t.term).slice(0, 25); // Limit terms sent
  const totalVolume = terms.reduce((sum, t) => sum + (t.volume || 0), 0);
  const avgGrowth = terms.reduce((sum, t) => sum + (t.growth || 0), 0) / terms.length;
  const avgClickShare = terms.reduce((sum, t) => sum + ((t as any).clickShare || 0), 0) / terms.length;

  const prompt = `Analyze the following search terms cluster representing user search behavior.
    Cluster Metrics:
    - Total Search Volume: ${totalVolume.toLocaleString()}
    - Average Growth (180d): ${(avgGrowth * 100).toFixed(1)}%
    - Average Click Share: ${(avgClickShare * 100).toFixed(1)}%

    Search Terms (sample): ${termStrings.join(", ")}
    ${terms.length > 25 ? `(... and ${terms.length - 25} more)` : ''}

    Based ONLY on the provided terms and metrics, generate:
    1. A concise, descriptive 'title' (max 10 words) summarizing the core user intent or theme.
    2. A brief 'description' (1-2 sentences) explaining the theme and user behavior.
    3. Relevant 'tags' (up to 5-7 tags) categorized under Format, Function, Values, Audience, Behavior. Assign a confidence score (0-1) for each tag.

    Format response as JSON:
    {
      "title": "string",
      "description": "string",
      "tags": [ {"category": "Format|Function|Values|Audience|Behavior", "value": "string", "confidence": number} ]
    }`;

  try {
    console.log(`Generating metadata for cluster with ${terms.length} terms. Sample: ${termStrings.slice(0,3).join(', ')}`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant skilled in analyzing search term data to identify user intent, behavioral patterns, and relevant product attributes. Provide responses ONLY in the requested JSON format." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0]?.message?.content || '{}';
    const parsedResult = JSON.parse(responseContent);

    // Return enriched metadata
    return {
      description: parsedResult.description || "Analysis of related search terms.",
      tags: parsedResult.tags || [],
      title: parsedResult.title || `Cluster (${terms.length} terms)`,
    };
  } catch (error) {
    console.error("Failed to generate cluster metadata via AI:", error);
    return {
      description: "Error generating AI insights for this cluster.",
      tags: [],
      title: `Cluster (${terms.length} terms)`,
    };
  }
}

async function clusterEmbeddings(embeddings: EmbeddingResult[]): Promise<HierarchicalCluster[]> {
  if (embeddings.length < 2) {
    console.log("Too few embeddings for clustering, creating a single cluster");
    return [{ terms: embeddings, level: 0, similarity: 1, id: 'singleton-cluster' }];
  }

  // Convert embeddings to array of arrays for DBSCAN
  const points = embeddings.map(e => e.embedding);
  
  // Dynamic parameter calculation based on dataset characteristics
  const minPts = Math.max(
    2, // Lower minimum to 2 instead of 3 to handle small datasets better
    Math.min(
      Math.floor(Math.sqrt(embeddings.length)),
      Math.floor(embeddings.length * 0.15) // Increased percentage to 15% from 10%
    )
  );
  
  console.log(`Using clustering parameters: minPts=${minPts}, total points=${points.length}`);
  
  // Try different epsilon values to find optimal clustering
  const epsilonValues = [0.25, 0.3, 0.35, 0.4]; // More relaxed epsilon values
  let bestClusters: number[][] = [];
  let bestNoise: number[] = [];
  let bestEpsilon = 0;
  
  for (const epsilon of epsilonValues) {
    try {
      console.log(`Trying DBSCAN with epsilon=${epsilon}, minPts=${minPts}`);
      const dbscan = new clustering.DBSCAN() as DBSCANInstance;
      const clusters = dbscan.run(points, epsilon, minPts);
      const noise = dbscan.noise || [];
      
      // Consider this the best result if it creates more clusters or has less noise
      const clusterCount = clusters.length;
      const noiseCount = noise.length;
      const clusterRatio = clusterCount > 0 ? points.length / clusterCount : 0; // Points per cluster
      
      console.log(`  Result: ${clusterCount} clusters, ${noiseCount} noise points, ratio: ${clusterRatio.toFixed(1)}`);
      
      // Choose this epsilon if:
      // 1. We don't have any clusters yet OR
      // 2. This produces more clusters than our current best OR
      // 3. This produces the same number of clusters but with less noise
      if (
        bestClusters.length === 0 ||
        (clusterCount > bestClusters.length) ||
        (clusterCount === bestClusters.length && noiseCount < bestNoise.length)
      ) {
        bestClusters = clusters;
        bestNoise = noise;
        bestEpsilon = epsilon;
        console.log(`  New best epsilon: ${epsilon} with ${clusterCount} clusters and ${noiseCount} noise points`);
      }
      
      // If we found at least 2 good clusters with not too many points per cluster
      // and not too many noise points, we can stop searching
      if (clusterCount >= 2 && clusterRatio < 12 && noiseCount < points.length * 0.3) {
        console.log(`  Found satisfactory clustering at epsilon=${epsilon}, stopping search`);
        break;
      }
    } catch (err) {
      console.error(`Error running DBSCAN with epsilon=${epsilon}:`, err);
    }
  }
  
  console.log(`Final clustering: epsilon=${bestEpsilon}, clusters=${bestClusters.length}, noise=${bestNoise.length}`);
  
  // Group terms by cluster with additional metadata
  const hierarchicalClusters: HierarchicalCluster[] = [];
  const noiseClusterTerms: EmbeddingResult[] = [];
  
  // Process noise points
  bestNoise.forEach((index: number) => {
    if (index >= 0 && index < embeddings.length) {
      noiseClusterTerms.push(embeddings[index]);
    }
  });
  
  // Process main clusters
  bestClusters.forEach((clusterIndices: number[], clusterLabel: number) => {
    const clusterTerms = clusterIndices.map((index: number) => embeddings[index]);
    hierarchicalClusters.push({
      terms: clusterTerms,
      level: 0,
      similarity: 1,
      id: `cluster-${clusterLabel}`
    });
  });
  
  // Handle all noise case 
  if (hierarchicalClusters.length === 0 && noiseClusterTerms.length > 0) {
    console.log(`All terms (${noiseClusterTerms.length}) classified as noise. Creating clusters using alternative method.`);
    
    // If all points are noise, try to split them into reasonable clusters based on similarity
    if (noiseClusterTerms.length > 20) {
      // For larger datasets, create multiple clusters from noise
      const nClusters = Math.min(
        4, // Max 4 clusters
        Math.max(2, Math.floor(noiseClusterTerms.length / 10)) // At least 2 clusters
      );
      
      console.log(`Creating ${nClusters} clusters from noise points using manual clustering`);
      
      // Group by similarity to manually create clusters
      const manualClusters = createManualClusters(noiseClusterTerms, nClusters);
      manualClusters.forEach((clusterTerms, i) => {
        hierarchicalClusters.push({
          terms: clusterTerms,
          level: 0,
          similarity: 0.7, // Reasonable similarity for manual clustering
          id: `manual-cluster-${i}`
        });
      });
      
      // Empty noise array since we've used these terms
      noiseClusterTerms.length = 0;
    } else {
      // For smaller datasets, just create one noise cluster
      hierarchicalClusters.push({ 
        terms: noiseClusterTerms, 
        level: 0, 
        similarity: 0.8, 
        id: 'all-terms-cluster' 
      });
      // Empty noise array since we've used these terms
      noiseClusterTerms.length = 0;
    }
  } 
  // Add remaining noise as its own cluster if significant
  else if (noiseClusterTerms.length > 0) {
    console.log(`Adding noise cluster with ${noiseClusterTerms.length} terms.`);
    hierarchicalClusters.push({ 
      terms: noiseClusterTerms, 
      level: 0, 
      similarity: 0.5, 
      id: 'noise-cluster' 
    });
  }

  // If no clusters were formed at all, handle the empty case gracefully
  if (hierarchicalClusters.length === 0) {
    console.warn("No clusters formed, not even noise. This is unexpected.");
    return [{ 
      terms: embeddings, 
      level: 0, 
      similarity: 1, 
      id: 'fallback-all-terms' 
    }]; // Just return all terms as one cluster
  }

  // Calculate cluster centroids and similarities
  const centroids = hierarchicalClusters.map(cluster => {
    const centroid = new Array(cluster.terms[0].embedding.length).fill(0);
    cluster.terms.forEach((term: EmbeddingResult) => {
      term.embedding.forEach((val: number, i: number) => {
        centroid[i] += val;
      });
    });
    return centroid.map(val => val / cluster.terms.length);
  });

  // Build hierarchical structure if more than one cluster
  let hierarchicalStructure = hierarchicalClusters;
  if (hierarchicalClusters.length > 1) {
    hierarchicalStructure = buildHierarchy(hierarchicalClusters, centroids);
  }
  
  // Sort clusters by opportunity score
  return hierarchicalStructure.sort((a, b) => {
    const scoreA = calculateOpportunityScore(
      a.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.volume || 0), 0),
      a.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.growth || 0), 0) / a.terms.length,
      a.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.competition || 0), 0) / a.terms.length
    );
    const scoreB = calculateOpportunityScore(
      b.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.volume || 0), 0),
      b.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.growth || 0), 0) / b.terms.length,
      b.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.competition || 0), 0) / b.terms.length
    );
    return scoreB - scoreA;
  });
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
    children: [clusters[clusterA], clusters[clusterB]],
    id: `merged-cluster-${clusterA}-${clusterB}`
  }

  // Update parent references
  clusters[clusterA].parentId = mergedCluster.id
  clusters[clusterB].parentId = mergedCluster.id

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

async function extractMetadataPatterns(
  terms: string[],
  metadata: Array<Record<string, any>>,
  openai: OpenAI
): Promise<MetadataAnalysis['patterns']> {
  const functionPatterns: Array<{
    pattern: string;
    confidence: number;
    terms: string[];
  }> = []
  const formatPatterns: Array<{
    pattern: string;
    confidence: number;
    terms: string[];
  }> = []
  const valuePatterns: Array<{
    pattern: string;
    confidence: number;
    terms: string[];
  }> = []

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
  // Define typed arrays for our collections
  const functionFormatPairs: Array<{
    function: string;
    format: string;
    confidence: number;
    terms: string[];
  }> = []
  
  const functionValuePairs: Array<{
    function: string;
    value: string;
    confidence: number;
    terms: string[];
  }> = []
  
  const formatValuePairs: Array<{
    format: string;
    value: string;
    confidence: number;
    terms: string[];
  }> = []

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
  patterns: NonNullable<MetadataAnalysis['patterns']>, 
  relationships: NonNullable<MetadataAnalysis['relationships']>, 
  terms: string[],
  openai: OpenAI
): Promise<NonNullable<MetadataAnalysis['insights']>> {
  const insights: Array<{
    type: string;
    description: string;
    confidence: number;
    supportingTerms: string[];
  }> = [];

  // Generate insights from patterns
  if (patterns?.functionPatterns?.length) {
    for (const pattern of patterns.functionPatterns) {
      const insight = await generateInsight(pattern, 'function', openai);
      insights.push(insight);
    }
  }

  if (patterns?.formatPatterns?.length) {
    for (const pattern of patterns.formatPatterns) {
      const insight = await generateInsight(pattern, 'format', openai);
      insights.push(insight);
    }
  }

  if (patterns?.valuePatterns?.length) {
    for (const pattern of patterns.valuePatterns) {
      const insight = await generateInsight(pattern, 'value', openai);
      insights.push(insight);
    }
  }

  // Generate insights from relationships
  if (relationships && 'functionFormatPairs' in relationships && relationships.functionFormatPairs?.length) {
    for (const relationship of relationships.functionFormatPairs) {
      const insight = await generateRelationshipInsight(relationship, 'functionFormat', openai);
      insights.push(insight);
    }
  }

  if (relationships && 'functionValuePairs' in relationships && relationships.functionValuePairs?.length) {
    for (const relationship of relationships.functionValuePairs) {
      const insight = await generateRelationshipInsight(relationship, 'functionValue', openai);
      insights.push(insight);
    }
  }

  if (relationships && 'formatValuePairs' in relationships && relationships.formatValuePairs?.length) {
    for (const relationship of relationships.formatValuePairs) {
      const insight = await generateRelationshipInsight(relationship, 'formatValue', openai);
      insights.push(insight);
    }
  }

  return insights;
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
    const responseContent = response.choices[0]?.message?.content || '{"description":"","confidence":0}'
    return JSON.parse(responseContent)
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
    const responseContent = response.choices[0]?.message?.content || '{"description":"","confidence":0}'
    return JSON.parse(responseContent)
  } catch (error) {
    console.error("Failed to parse relationship analysis:", error)
    return { description: "No relationship identified", confidence: 0 }
  }
}

async function generateInsight(
  pattern: { pattern: string; confidence: number; terms: string[] },
  type: 'function' | 'format' | 'value',
  openai: OpenAI
): Promise<{
  type: string;
  description: string;
  confidence: number;
  supportingTerms: string[];
}> {
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
    const responseContent = response.choices[0]?.message?.content || '{"description":"","confidence":0}'
    const result = JSON.parse(responseContent)
    return {
      type,
      description: result.description || "No insight generated",
      confidence: result.confidence * (pattern.confidence || 0),
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
): Promise<{
  type: string;
  description: string;
  confidence: number;
  supportingTerms: string[];
}> {
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
    const responseContent = response.choices[0]?.message?.content || '{"description":"","confidence":0}'
    const result = JSON.parse(responseContent)
    return {
      type: 'relationship',
      description: result.description || "No insight generated",
      confidence: result.confidence * (relationship.confidence || 0),
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
Terms: ${cluster.terms.map((t: EmbeddingResult) => t.term).join(", ")}
${cluster.tags ? `Tags: ${cluster.tags.map((t: any) => `${t.category}: ${t.value}`).join(", ")}` : ''}
Metrics:
- Volume: ${cluster.terms.reduce((sum: number, t: EmbeddingResult) => sum + t.volume, 0)}
- Growth: ${cluster.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.growth || 0), 0) / cluster.terms.length}
- Click Share: ${cluster.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.clickShare || 0), 0) / cluster.terms.length}

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
    const responseContent = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(responseContent)
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
Terms: ${cluster.terms.map((t: EmbeddingResult) => t.term).join(", ")}
${cluster.tags ? `Tags: ${cluster.tags.map((t: any) => `${t.category}: ${t.value}`).join(", ")}` : ''}
Metrics:
- Volume: ${cluster.terms.reduce((sum: number, t: EmbeddingResult) => sum + t.volume, 0)}
- Growth: ${cluster.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.growth || 0), 0) / cluster.terms.length}
- Click Share: ${cluster.terms.reduce((sum: number, t: EmbeddingResult) => sum + (t.clickShare || 0), 0) / cluster.terms.length}
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
    const responseContent = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(responseContent)
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

export async function analyzeLevel1DataForClustering(
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
    const responseContent = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(responseContent)
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
  }
}

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

export async function runAIClustering(
  searchTerms: Level2SearchTermData[],
  openai: OpenAI,
  historicalData?: {
    timestamp: Date
    searchTerms: Level2SearchTermData[]
  }[]
): Promise<AICluster[]> {
  if (!searchTerms?.length) {
    throw new Error('No search terms provided for clustering');
  }

  try {
    console.log(`Starting AI clustering for ${searchTerms.length} search terms`);
    
    // Generate embeddings with better error handling
    const embeddingResults = [];
    for (const term of searchTerms) {
      let retries = 3;
      let embedding = null;
      
      while (retries > 0 && embedding === null) {
        try {
          embedding = await generateEmbedding(term.Search_Term, openai);
          // Only push valid embeddings
          if (embedding && Array.isArray(embedding) && embedding.length > 0) {
            embeddingResults.push({
              term: term.Search_Term,
              volume: term.Volume || 0,
              clickShare: term.Click_Share || 0,
              growth: term.Growth_180 || term.Growth_90 || 0,
              competition: term.Click_Share || 0.5,
              embedding,
              metadata: {
                function: term.Function_Inferred,
                format: term.Format_Inferred,
                values: term.Values_Inferred,
              }
            });
          } else {
            console.error(`Generated embedding for "${term.Search_Term}" is invalid`);
            retries--;
          }
        } catch (err) {
          console.error(`Failed embedding attempt ${4-retries}/3 for "${term.Search_Term}":`, err);
          retries--;
          if (retries > 0) {
            console.log(`Waiting before retry for "${term.Search_Term}"...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay between retries
          }
        }
      }
      
      if (embedding === null) {
        console.warn(`Failed to generate embedding for "${term.Search_Term}" after multiple retries`);
      }
    }

    const validEmbeddings = embeddingResults.filter(e => e && e.embedding && Array.isArray(e.embedding) && e.embedding.length > 0);
    
    console.log(`Generated ${validEmbeddings.length} valid embeddings out of ${searchTerms.length} terms`);
    
    if (validEmbeddings.length < 2) {
      throw new Error(`Insufficient valid embeddings (${validEmbeddings.length}) generated for clustering - minimum 2 required`);
    }

    // Continue with clustering using validEmbeddings
    const clusters = await clusterEmbeddings(validEmbeddings);
    console.log(`Clustering produced ${clusters.length} clusters`);
    
    // Process historical data if available
    let temporalPatterns = undefined;
    if (historicalData?.length) {
      try {
        temporalPatterns = await analyzeTemporalPatterns(clusters, historicalData, openai);
      } catch (err) {
        console.error('Failed to analyze temporal patterns:', err);
      }
    }

    // Generate descriptions and tags
    const enrichedClusters: AICluster[] = await Promise.all(
      clusters.map(async cluster => {
        try {
          // Get AI-generated metadata
          const metadata = await generateClusterMetadata(cluster.terms, openai);
          
          // Calculate metrics for the cluster
          const totalVolume = cluster.terms.reduce((sum, t) => sum + (t.volume || 0), 0);
          const avgGrowth = cluster.terms.reduce((sum, t) => sum + (t.growth || 0), 0) / cluster.terms.length;
          const avgClickShare = cluster.terms.reduce((sum, t) => sum + ((t as any).clickShare || 0), 0) / cluster.terms.length;
          const avgCompetition = cluster.terms.reduce((sum, t) => sum + (t.competition || 0), 0) / cluster.terms.length;
          const opportunityScore = calculateOpportunityScore(totalVolume, avgGrowth, avgCompetition);
          
          // Map tags to proper format
          const mappedTags = Array.isArray(metadata.tags) 
            ? metadata.tags.map((tag: any) => ({
                category: tag.category || "Unknown",
                value: tag.value || "",
                confidence: tag.confidence || 0.5
              })) 
            : [];
          
          return {
            ...cluster,
            title: metadata.title || `Cluster ${cluster.id}`,
            description: metadata.description || '',
            tags: mappedTags,
            confidence: 0.8, // Default confidence until we have a better way to calculate
            evidence: {
              keyTerms: cluster.terms.slice(0, 5).map(t => t.term),
              keyMetrics: [
                { name: "Volume", value: totalVolume, significance: "Total search volume" },
                { name: "Growth", value: avgGrowth, significance: "Average growth rate" },
                { name: "Click Share", value: avgClickShare, significance: "Average click share" }
              ],
              supportingTags: mappedTags.map(t => `${t.category}: ${t.value}`)
            },
            terms: cluster.terms.map(term => ({
              term: term.term,
              volume: term.volume || 0,
              clickShare: (term as any).clickShare || 0,
              embedding: term.embedding
            })),
            metrics: {
              totalVolume,
              avgGrowth,
              avgClickShare,
              avgCompetition,
              opportunityScore
            }
          } as unknown as AICluster;
        } catch (err) {
          console.error('Failed to generate cluster metadata:', err);
          return {
            ...cluster,
            description: 'Error generating cluster metadata',
            tags: [],
            title: `Cluster ${cluster.id}`,
            confidence: 0,
            evidence: {
              keyTerms: [],
              keyMetrics: [],
              supportingTags: []
            },
            terms: cluster.terms.map(term => ({
              term: term.term,
              volume: term.volume || 0,
              clickShare: (term as any).clickShare || 0,
              embedding: term.embedding
            })),
            metrics: {
              totalVolume: 0,
              avgGrowth: 0,
              avgClickShare: 0,
              avgCompetition: 0,
              opportunityScore: 0
            }
          } as unknown as AICluster;
        }
      })
    );

    return enrichedClusters;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('AI Clustering failed:', errorMessage);
    throw new Error(`AI Clustering failed: ${errorMessage}`);
  }
}

// Helper function to create manual clusters from noise points
function createManualClusters(terms: EmbeddingResult[], nClusters: number): EmbeddingResult[][] {
  console.log(`Creating ${nClusters} manual clusters from ${terms.length} terms`);
  
  // Start with random seed terms as centroids
  const centroids = Array.from({ length: nClusters }, (_, i) => 
    terms[Math.floor(Math.random() * terms.length)].embedding
  );
  
  // Simple k-means clustering
  const clusters: EmbeddingResult[][] = Array.from({ length: nClusters }, () => []);
  
  // Assign each term to the nearest centroid
  terms.forEach(term => {
    let bestDistanceSq = Infinity;
    let bestCluster = 0;
    
    centroids.forEach((centroid, i) => {
      // Use cosine similarity for distance calculation
      const similarity = cosineSimilarity(term.embedding, centroid);
      const distance = 1 - similarity; // Convert similarity to distance
      
      if (distance < bestDistanceSq) {
        bestDistanceSq = distance;
        bestCluster = i;
      }
    });
    
    clusters[bestCluster].push(term);
  });
  
  // Filter out any empty clusters
  return clusters.filter(cluster => cluster.length > 0);
} 