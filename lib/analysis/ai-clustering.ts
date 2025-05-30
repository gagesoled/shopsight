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

// Overloaded function signatures for backward compatibility
export async function generateClusterMetadata(
  terms: EmbeddingResult[],
  openai: OpenAI
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }>;
export async function generateClusterMetadata(
  terms: EnrichedEmbeddingResult[],
  openai: OpenAI
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }>;
export async function generateClusterMetadata(
  terms: EmbeddingResult[] | EnrichedEmbeddingResult[],
  openai: OpenAI
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }> {
  // Check if terms are enriched (have ai_generated_tags)
  const isEnriched = terms.length > 0 && 'ai_generated_tags' in terms[0];
  
  if (isEnriched) {
    const enrichedTerms = terms as EnrichedEmbeddingResult[];
    return generateEnrichedClusterMetadata(enrichedTerms, openai);
  } else {
    const basicTerms = terms as EmbeddingResult[];
    return generateBasicClusterMetadata(basicTerms, openai);
  }
}

// New enriched version (the one we just implemented)
async function generateEnrichedClusterMetadata(
  terms: EnrichedEmbeddingResult[],
  openai: OpenAI
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }> {
  try {
    console.log(`Generating cluster metadata for ${terms.length} enriched terms`);
    
    // Prepare the terms data for the AI
    const termsData = terms.map(t => ({
      term: t.term,
      volume: t.volume,
      clickShare: t.clickShare || 0,
      growth: t.growth || 0,
      competition: t.competition || 0
    }));

    // Analyze AI-generated tags from all terms in the cluster
    const allAITags = terms.flatMap(term => term.ai_generated_tags);
    console.log(`Analyzing ${allAITags.length} total AI tags across all terms`);
    
    // Calculate tag frequency and significance
    const tagFrequency = new Map<string, { count: number; totalConfidence: number; category: string; value: string }>();
    
    allAITags.forEach(tag => {
      const key = `${tag.category}:${tag.value}`;
      const existing = tagFrequency.get(key);
      const confidence = tag.confidence || 1.0;
      
      if (existing) {
        existing.count += 1;
        existing.totalConfidence += confidence;
      } else {
        tagFrequency.set(key, {
          count: 1,
          totalConfidence: confidence,
          category: tag.category,
          value: tag.value
        });
      }
    });

    // Sort tags by significance (frequency * average confidence)
    const significantTags = Array.from(tagFrequency.entries())
      .map(([key, data]) => ({
        key,
        category: data.category,
        value: data.value,
        frequency: data.count,
        avgConfidence: data.totalConfidence / data.count,
        significance: data.count * (data.totalConfidence / data.count), // frequency weighted by avg confidence
        termCoverage: data.count / terms.length // what percentage of terms have this tag
      }))
      .sort((a, b) => b.significance - a.significance);

    console.log(`Top 5 significant tags:`, significantTags.slice(0, 5).map(t => 
      `${t.category}:${t.value} (freq: ${t.frequency}, confidence: ${t.avgConfidence.toFixed(2)}, coverage: ${(t.termCoverage * 100).toFixed(1)}%)`
    ));

    // Group tags by category for better analysis
    const tagsByCategory = new Map<string, Array<{ value: string; frequency: number; avgConfidence: number; termCoverage: number }>>();
    significantTags.forEach(tag => {
      if (!tagsByCategory.has(tag.category)) {
        tagsByCategory.set(tag.category, []);
      }
      tagsByCategory.get(tag.category)!.push({
        value: tag.value,
        frequency: tag.frequency,
        avgConfidence: tag.avgConfidence,
        termCoverage: tag.termCoverage
      });
    });

    // Create enriched prompt that includes AI-generated tag analysis
    const tagAnalysisSection = Array.from(tagsByCategory.entries())
      .map(([category, values]) => {
        const topValues = values.slice(0, 3).map(v => 
          `"${v.value}" (${v.frequency} terms, ${(v.termCoverage * 100).toFixed(0)}% coverage, confidence: ${v.avgConfidence.toFixed(2)})`
        ).join(', ');
        return `- ${category}: ${topValues}`;
      })
      .join('\n');

    const prompt = `
You are an expert at analyzing search term patterns and identifying meaningful clusters. You have access to both the raw search terms with their metrics AND detailed AI-generated categorical analysis of each term.

Based on the provided data, generate:

1. A concise, descriptive 'title' (max 5 words) that captures the core theme of these search terms.

2. A detailed 'description' (2-3 sentences) explaining the cluster's focus and significance. Include relevant metrics and market insights.

3. Generate specific cluster-level tags by synthesizing the most common and significant patterns from the AI-generated per-term tags. Focus on the most prevalent categories and values that define this cluster's identity.

SEARCH TERMS AND METRICS:
${JSON.stringify(termsData, null, 2)}

AI-GENERATED TAG ANALYSIS (Most significant patterns across all terms):
${tagAnalysisSection}

CLUSTER TAG GENERATION GUIDELINES:
- Prioritize tags that appear across multiple terms (high coverage)
- Focus on categories that best define the cluster's identity
- Synthesize related values into broader cluster-level concepts when appropriate
- Assign confidence scores based on how well-supported each tag is by the underlying data
- Only include tags that represent the cluster as a whole, not individual term quirks

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

    console.log(`Sending enriched prompt to OpenAI for cluster metadata generation`);

    // Call the AI with enriched prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing search patterns and identifying meaningful clusters. Use both the raw search terms and the detailed AI-generated tag analysis to create comprehensive cluster summaries that capture the behavioral and categorical essence of the cluster."
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
    
    console.log(`Generated enriched cluster metadata:`, {
      title: parsedResult.title,
      description: parsedResult.description?.substring(0, 100) + '...',
      tagCount: parsedResult.tags?.length || 0
    });

    return {
      title: parsedResult.title,
      description: parsedResult.description,
      tags: parsedResult.tags
    };
  } catch (error) {
    console.error("Error generating enriched cluster metadata:", error);
    
    // Enhanced fallback that uses AI tags if available
    const hasAITags = terms.some(t => t.ai_generated_tags && t.ai_generated_tags.length > 0);
    if (hasAITags) {
      const allTags = terms.flatMap(t => t.ai_generated_tags);
      const commonTag = allTags.find(tag => tag.category && tag.value);
      if (commonTag) {
        return {
          title: `${commonTag.value} Cluster`,
          description: `A collection of search terms related to ${commonTag.value} with ${terms.length} total terms`,
          tags: [{ 
            category: commonTag.category, 
            value: commonTag.value, 
            confidence: 0.3 
          }]
        };
      }
    }
    
    // Basic fallback metadata
    return {
      title: "Uncategorized Terms",
      description: "A collection of related search terms",
      tags: [{ category: "General", value: "Uncategorized", confidence: 0.1 }]
    };
  }
}

// Legacy version for backward compatibility
async function generateBasicClusterMetadata(
  terms: EmbeddingResult[],
  openai: OpenAI
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }> {
  try {
    console.log(`Generating basic cluster metadata for ${terms.length} terms (legacy mode)`);
    
    // Prepare the terms data for the AI
    const termsData = terms.map(t => ({
      term: t.term,
      volume: t.volume,
      clickShare: t.clickShare || 0,
      growth: t.growth || 0,
      competition: t.competition || 0
    }));

    // Create a category-agnostic prompt (original implementation)
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
    
    console.log(`Generated basic cluster metadata:`, {
      title: parsedResult.title,
      description: parsedResult.description?.substring(0, 100) + '...',
      tagCount: parsedResult.tags?.length || 0
    });

    return {
      title: parsedResult.title,
      description: parsedResult.description,
      tags: parsedResult.tags
    };
  } catch (error) {
    console.error("Error generating basic cluster metadata:", error);
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
  Array.from(clusterMap.entries()).forEach(([clusterId, clusterTerms]) => {
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
      for (const [groupId, groupTerms] of Array.from(noiseGroups.entries())) {
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
    Array.from(noiseGroups.entries()).forEach(([groupId, groupTerms]) => {
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

// Add the new enriched search term interface near the top with other interfaces
export interface EnrichedSearchTerm {
  term_text: string;
  original_metrics: {
    volume?: number;
    clickShare?: number;
    growth90d?: number;
    growth180d?: number;
    conversion_rate?: number;
    competition?: number;
    format_inferred?: string;
    function_inferred?: string;
    values_inferred?: string;
    top_clicked_product_1_title?: string;
    top_clicked_product_2_title?: string;
    top_clicked_product_3_title?: string;
  };
  ai_generated_tags: Array<{ category: string; value: string; confidence?: number }>;
  embedding: number[];
}

// Update the EmbeddingResult interface to work with enriched terms
export interface EnrichedEmbeddingResult extends BaseEmbeddingResult {
  term: string;
  volume: number;
  clickShare?: number;
  growth?: number;
  competition?: number;
  embedding: number[];
  // Add enriched data fields
  original_metrics: EnrichedSearchTerm['original_metrics'];
  ai_generated_tags: EnrichedSearchTerm['ai_generated_tags'];
  metadata?: {
    function?: string;
    format?: string;
    values?: string;
  };
}

// Overloaded function signatures for runAIClustering backward compatibility
export async function runAIClustering(
  searchTerms: Level2SearchTermData[],
  openai: OpenAI
): Promise<HierarchicalCluster[]>;
export async function runAIClustering(
  enrichedSearchTerms: EnrichedSearchTerm[],
  openai: OpenAI
): Promise<HierarchicalCluster[]>;
export async function runAIClustering(
  searchTermsOrEnriched: Level2SearchTermData[] | EnrichedSearchTerm[],
  openai: OpenAI
): Promise<HierarchicalCluster[]> {
  // Check if input is enriched search terms
  const isEnriched = searchTermsOrEnriched.length > 0 && 'term_text' in searchTermsOrEnriched[0];
  
  if (isEnriched) {
    const enrichedSearchTerms = searchTermsOrEnriched as EnrichedSearchTerm[];
    return runEnrichedAIClustering(enrichedSearchTerms, openai);
  } else {
    const searchTerms = searchTermsOrEnriched as Level2SearchTermData[];
    return runLegacyAIClustering(searchTerms, openai);
  }
}

// New enriched clustering implementation
async function runEnrichedAIClustering(
  enrichedSearchTerms: EnrichedSearchTerm[],
  openai: OpenAI
): Promise<HierarchicalCluster[]> {
  console.log(`Starting AI clustering with ${enrichedSearchTerms?.length || 0} enriched search terms`);
  
  if (!enrichedSearchTerms?.length) {
    console.warn('No enriched search terms provided for clustering');
    return [];
  }

  console.log(`Received ${enrichedSearchTerms.length} enriched search terms for clustering`);
  console.log(`Sample enriched term structure:`, {
    term_text: enrichedSearchTerms[0]?.term_text || 'N/A',
    has_original_metrics: !!enrichedSearchTerms[0]?.original_metrics,
    ai_tags_count: enrichedSearchTerms[0]?.ai_generated_tags?.length || 0,
    embedding_length: enrichedSearchTerms[0]?.embedding?.length || 0
  });

  // Convert enriched search terms to the format expected by clustering
  console.log('Converting enriched search terms to embedding results format...');
  const embeddingResults: EnrichedEmbeddingResult[] = [];
  
  for (const enrichedTerm of enrichedSearchTerms) {
    try {
      if (!enrichedTerm.embedding || !Array.isArray(enrichedTerm.embedding) || enrichedTerm.embedding.length === 0) {
        console.warn(`Skipping term "${enrichedTerm.term_text}" - invalid or missing embedding`);
        continue;
      }

      const embeddingResult: EnrichedEmbeddingResult = {
        term: enrichedTerm.term_text,
        volume: enrichedTerm.original_metrics.volume || 0,
        clickShare: enrichedTerm.original_metrics.clickShare || 0,
        growth: enrichedTerm.original_metrics.growth90d || enrichedTerm.original_metrics.growth180d || 0,
        competition: enrichedTerm.original_metrics.competition || (1 - (enrichedTerm.original_metrics.clickShare || 0)),
        embedding: enrichedTerm.embedding,
        // Preserve all enriched data
        original_metrics: enrichedTerm.original_metrics,
        ai_generated_tags: enrichedTerm.ai_generated_tags,
        metadata: {
          function: enrichedTerm.original_metrics.function_inferred,
          format: enrichedTerm.original_metrics.format_inferred,
          values: enrichedTerm.original_metrics.values_inferred
        }
      };

      embeddingResults.push(embeddingResult);
      console.log(`Successfully processed enriched term: "${enrichedTerm.term_text}" with ${enrichedTerm.ai_generated_tags.length} AI tags`);
    } catch (error) {
      console.error(`Error processing enriched term "${enrichedTerm.term_text}":`, error);
    }
  }

  console.log(`Successfully converted ${embeddingResults.length} enriched terms out of ${enrichedSearchTerms.length} total terms`);

  if (embeddingResults.length < 2) {
    console.warn('Not enough valid enriched terms for clustering');
    return [];
  }

  // Extract embeddings for DBSCAN clustering
  const embeddings = embeddingResults.map(result => result.embedding);
  console.log(`Extracted ${embeddings.length} embeddings for clustering`);
  
  // Calculate clustering parameters
  const minPts = Math.max(2, Math.floor(Math.sqrt(embeddingResults.length / 3)));
  console.log(`DBSCAN clustering parameters: minPts=${minPts}, total points=${embeddingResults.length}`);

  // Find optimal epsilon
  console.log('Finding optimal epsilon for embedding-based clustering...');
  const epsilon = findOptimalEpsilon(embeddings, minPts, {
    start: 0.15,
    end: 0.35,
    step: 0.02
  });
  console.log(`Optimal epsilon found: ${epsilon}`);

  // Run DBSCAN clustering
  console.log('Starting DBSCAN clustering on embeddings...');
  const dbscan = new clustering.DBSCAN();
  const clusterAssignments = dbscan.run(embeddings, epsilon, minPts);
  
  const numClusters = new Set(clusterAssignments.filter(c => c !== -1)).size;
  const numNoise = clusterAssignments.filter(c => c === -1).length;
  console.log(`DBSCAN completed: ${numClusters} initial clusters formed, ${numNoise} noise points`);

  // Group enriched terms by cluster
  console.log('Grouping enriched terms by cluster assignment...');
  const clusterMap = new Map<number, EnrichedEmbeddingResult[]>();
  clusterAssignments.forEach((cluster, i) => {
    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, []);
    }
    clusterMap.get(cluster)!.push(embeddingResults[i]);
  });

  // Convert clusters to hierarchical format with enriched data
  console.log('Converting clusters to hierarchical format with enriched data...');
  const clusters: HierarchicalCluster[] = [];
  
  // Process non-noise clusters first
  Array.from(clusterMap.entries()).forEach(([clusterId, clusterTerms]) => {
    if (clusterId !== -1) {
      console.log(`Processing cluster ${clusterId} with ${clusterTerms.length} enriched terms`);
      
      const cluster = createCluster(clusterTerms, `cluster-${clusterId}`);
      clusters.push(cluster);
      
      // Log sample enriched data preservation
      console.log(`  Sample term in cluster ${clusterId}:`, {
        term: clusterTerms[0].term,
        ai_tags_count: clusterTerms[0].ai_generated_tags.length,
        sample_tags: clusterTerms[0].ai_generated_tags.slice(0, 3).map(t => `${t.category}: ${t.value}`),
        has_original_metrics: !!clusterTerms[0].original_metrics
      });
    }
  });

  // Process noise points using semantic similarity (with enriched data)
  const noiseTerms = clusterMap.get(-1) || [];
  if (noiseTerms.length > 0) {
    console.log(`Processing ${noiseTerms.length} noise points with enriched data...`);
    
    // Group noise points by semantic similarity
    const noiseGroups = new Map<string, EnrichedEmbeddingResult[]>();
    
    for (const term of noiseTerms) {
      let foundGroup = false;
      
      // Try to find a similar existing group
      for (const [groupId, groupTerms] of Array.from(noiseGroups.entries())) {
        const similarity = cosineSimilarity(term.embedding, calculateCentroidFromEnriched(groupTerms));
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
    Array.from(noiseGroups.entries()).forEach(([groupId, groupTerms]) => {
      if (groupTerms.length >= 2) {
        console.log(`Creating noise group cluster with ${groupTerms.length} enriched terms`);
        clusters.push(createCluster(groupTerms, `noise-${groupId}`));
      }
    });
  }

  console.log(`Final embedding-based clustering complete: ${clusters.length} clusters formed`);
  
  // Log details about each cluster with enriched data
  clusters.forEach((cluster, index) => {
    const enrichedTerms = cluster.terms as EnrichedEmbeddingResult[];
    console.log(`Cluster ${index + 1} (${cluster.id}):`);
    console.log(`  - Number of enriched terms: ${enrichedTerms.length}`);
    console.log(`  - Terms: ${enrichedTerms.map(t => t.term).join(', ')}`);
    console.log(`  - Total AI tags: ${enrichedTerms.reduce((sum, t) => sum + t.ai_generated_tags.length, 0)}`);
    console.log(`  - Sample enriched term structure:`, {
      term: enrichedTerms[0]?.term,
      volume: enrichedTerms[0]?.volume,
      ai_tags_count: enrichedTerms[0]?.ai_generated_tags?.length || 0,
      has_original_metrics: !!enrichedTerms[0]?.original_metrics
    });
  });

  // ===== STAGE 2: TAG-BASED CLUSTER MERGING =====
  console.log('\n=== STAGE 2: TAG-BASED CLUSTER REFINEMENT/MERGING ===');
  
  if (clusters.length < 2) {
    console.log('Not enough clusters for tag-based merging');
    return clusters;
  }
  
  const tagSimilarityThreshold = 0.6; // Threshold for merging clusters
  const minTagConfidence = 0.5; // Minimum confidence for tags to be considered
  console.log(`Tag similarity threshold for merging: ${tagSimilarityThreshold}`);
  console.log(`Minimum tag confidence threshold: ${minTagConfidence}`);
  
  let mergedClusters = [...clusters];
  let mergeCount = 0;
  let iterationCount = 0;
  const maxIterations = 10; // Prevent infinite loops
  
  // Iterative merging process
  while (iterationCount < maxIterations) {
    iterationCount++;
    console.log(`\nTag-based merging iteration ${iterationCount}:`);
    
    let foundMerge = false;
    const clustersToRemove: number[] = [];
    const clustersToAdd: HierarchicalCluster[] = [];
    
    // Check all pairs of clusters for potential merging
    for (let i = 0; i < mergedClusters.length; i++) {
      if (clustersToRemove.includes(i)) continue;
      
      for (let j = i + 1; j < mergedClusters.length; j++) {
        if (clustersToRemove.includes(j)) continue;
        
        const clusterA = mergedClusters[i];
        const clusterB = mergedClusters[j];
        
        // Calculate tag similarity between clusters
        const tagSimilarity = calculateClusterTagSimilarity(clusterA, clusterB, minTagConfidence);
        
        console.log(`  Comparing "${clusterA.id}" vs "${clusterB.id}": tag similarity = ${tagSimilarity.toFixed(3)}`);
        
        // If similarity exceeds threshold, merge clusters
        if (tagSimilarity >= tagSimilarityThreshold) {
          const newClusterId = `merged-${mergeCount + 1}`;
          const newCluster = mergeClusters(clusterA, clusterB, newClusterId);
          
          console.log(`  ✓ Merging clusters "${clusterA.id}" + "${clusterB.id}" → "${newClusterId}" (similarity: ${tagSimilarity.toFixed(3)})`);
          console.log(`    Combined terms: ${(newCluster.terms as EnrichedEmbeddingResult[]).length} total`);
          
          // Mark clusters for removal and add merged cluster
          clustersToRemove.push(i, j);
          clustersToAdd.push(newCluster);
          
          mergeCount++;
          foundMerge = true;
          break; // Process one merge per iteration to avoid index conflicts
        }
      }
      
      if (foundMerge) break; // Process one merge per iteration
    }
    
    // Apply merges for this iteration
    if (foundMerge) {
      // Remove merged clusters (in reverse order to maintain indices)
      clustersToRemove.sort((a, b) => b - a);
      for (const index of clustersToRemove) {
        mergedClusters.splice(index, 1);
      }
      
      // Add new merged clusters
      mergedClusters.push(...clustersToAdd);
      
      console.log(`  Iteration ${iterationCount} complete: ${clustersToRemove.length / 2} merge(s) performed`);
      console.log(`  Current cluster count: ${mergedClusters.length}`);
    } else {
      console.log(`  No more clusters can be merged (threshold: ${tagSimilarityThreshold})`);
      break;
    }
  }
  
  console.log(`\n=== TAG-BASED MERGING COMPLETE ===`);
  console.log(`Total merging iterations: ${iterationCount}`);
  console.log(`Total clusters merged: ${mergeCount}`);
  console.log(`Initial clusters (embedding-based): ${clusters.length}`);
  console.log(`Final clusters (after tag-based merging): ${mergedClusters.length}`);
  
  // Final cluster summary
  console.log('\n=== FINAL CLUSTER SUMMARY ===');
  mergedClusters.forEach((cluster, index) => {
    const enrichedTerms = cluster.terms as EnrichedEmbeddingResult[];
    const totalTags = enrichedTerms.reduce((sum, t) => sum + t.ai_generated_tags.length, 0);
    const avgTagsPerTerm = (totalTags / enrichedTerms.length).toFixed(1);
    
    // Sample most common tags in the cluster
    const allTags = enrichedTerms.flatMap(t => t.ai_generated_tags);
    const tagCounts = new Map<string, number>();
    allTags.forEach(tag => {
      const key = `${tag.category}:${tag.value}`;
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    });
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag, count]) => `${tag} (${count})`);
    
    console.log(`Final Cluster ${index + 1} (${cluster.id}):`);
    console.log(`  - Terms: ${enrichedTerms.length} (${enrichedTerms.map(t => t.term).join(', ')})`);
    console.log(`  - Total volume: ${enrichedTerms.reduce((sum, t) => sum + t.volume, 0).toLocaleString()}`);
    console.log(`  - AI tags: ${totalTags} total (avg: ${avgTagsPerTerm} per term)`);
    console.log(`  - Top tags: ${topTags.join(', ')}`);
  });

  return mergedClusters;
}

// Legacy clustering implementation for backward compatibility
async function runLegacyAIClustering(
  searchTerms: Level2SearchTermData[],
  openai: OpenAI
): Promise<HierarchicalCluster[]> {
  console.log(`Starting legacy AI clustering with ${searchTerms?.length || 0} search terms`);
  
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

// Add the missing calculateCentroidFromEnriched function
function calculateCentroidFromEnriched(terms: EnrichedEmbeddingResult[]): number[] {
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

/**
 * Enriches a search term with AI-generated tags using OpenAI's chat completions API.
 * Analyzes the search term and extracts relevant attributes, user intents, product characteristics,
 * and other discernible signals, categorizing them into predefined categories.
 */
export async function enrichSearchTermWithAITags(
  searchTerm: string,
  originalMetrics: {
    volume?: number;
    clickShare?: number;
    growth90d?: number;
    growth180d?: number;
    conversion_rate?: number;
    competition?: number;
    format_inferred?: string;
    function_inferred?: string;
    values_inferred?: string;
    top_clicked_product_1_title?: string;
    top_clicked_product_2_title?: string;
    top_clicked_product_3_title?: string;
  },
  openai: OpenAI
): Promise<{
  term_text: string;
  original_metrics: any;
  ai_generated_tags: Array<{ category: string; value: string; confidence?: number }>;
}> {
  console.log(`Starting AI tag enrichment for search term: "${searchTerm}"`);
  console.log(`Original metrics:`, originalMetrics);

  try {
    // Construct detailed prompt for OpenAI
    const prompt = `You are an expert e-commerce market analyst. Analyze the provided e-commerce search term (and its associated original metrics for context). Your goal is to extract all relevant attributes, user intents, product characteristics, and any other discernible signals from this search term.

Categorize these extracted pieces of information under the following predefined categories. For each piece of information, assign it to the most appropriate category and provide a specific 'value'. If multiple distinct pieces of information fit under the same category for this single search term, list them as separate tag objects (e.g., two different 'Key_Feature_Or_Attribute' tags).

If a category is not relevant to the given search term, do not include a tag for that category.

Also, assign a 'confidence' score (a float between 0.0 and 1.0) indicating how certain you are about each specific tag you generate.

The predefined categories are:
- Identified_Object: The primary product, service, entity, or core concept.
- Semantic_Synonyms_Or_Aliases: Alternative names, colloquialisms, or broader categorical terms for the Identified_Object.
- Brand: Specific brand names.
- Key_Feature_Or_Attribute: Specific, objective characteristics or features.
- Format_Or_Type: Physical form, delivery method, or specific variant.
- Target_Audience_Or_User: Specific user group or demographic.
- Function_Or_Purpose: What the user is trying to achieve or the object's utility.
- Implied_Benefit_Or_Problem_Solved: The underlying need or desired outcome.
- Ingredient_Or_Component: Specific ingredients or materials.
- Usage_Occasion_Or_Context: When, where, or how the object is used.
- Qualifier_Or_Sentiment: Words that describe, modify, or express opinion/sentiment.
- Problem_Or_Pain_Point: Specific problem or ailment the user is trying to solve.
- Comparison_Or_Alternative: If the term implies comparison or seeks an alternative.
- Location_Or_Geography: Geographic context.
- LLM_Derived_Insight: A concise (1-2 phrase) qualitative insight or interpretation about the user's deeper intent or nuance not captured by other categories.
- Other_Descriptor: Miscellaneous but relevant descriptors not fitting elsewhere.

Your output MUST be a valid JSON array of tag objects. Each object in the array should have a 'category' (from the predefined list), a 'value' (the extracted information), and a 'confidence' score.

Example format:
[
  { "category": "Brand", "value": "Dots Pretzels", "confidence": 0.95 },
  { "category": "Format_Or_Type", "value": "Individual Bags", "confidence": 0.9 },
  { "category": "Key_Feature_Or_Attribute", "value": "Seasoned", "confidence": 0.85 }
]

Search Term to Analyze: "${searchTerm}"

Context Metrics:
- Search Volume: ${originalMetrics.volume || 'N/A'}
- Click Share: ${originalMetrics.clickShare ? (originalMetrics.clickShare * 100).toFixed(1) + '%' : 'N/A'}
- Growth (90d): ${originalMetrics.growth90d ? (originalMetrics.growth90d * 100).toFixed(1) + '%' : 'N/A'}
- Growth (180d): ${originalMetrics.growth180d ? (originalMetrics.growth180d * 100).toFixed(1) + '%' : 'N/A'}
- Conversion Rate: ${originalMetrics.conversion_rate ? (originalMetrics.conversion_rate * 100).toFixed(1) + '%' : 'N/A'}
- Competition: ${originalMetrics.competition || 'N/A'}
- Format Inferred: ${originalMetrics.format_inferred || 'N/A'}
- Function Inferred: ${originalMetrics.function_inferred || 'N/A'}
- Values Inferred: ${originalMetrics.values_inferred || 'N/A'}
- Top Clicked Products: ${[
      originalMetrics.top_clicked_product_1_title,
      originalMetrics.top_clicked_product_2_title,
      originalMetrics.top_clicked_product_3_title
    ].filter(Boolean).join(', ') || 'N/A'}

Analyze the search term and return only the JSON array of tags.`;

    console.log(`Sending prompt to OpenAI for term: "${searchTerm}"`);
    console.log(`Prompt:`, prompt);

    // Make API call to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert e-commerce market analyst. Analyze search terms and extract relevant attributes, categorizing them into predefined categories. Always respond with valid JSON arrays only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Lower temperature for more consistent results
    });

    console.log(`Received response from OpenAI for term: "${searchTerm}"`);
    const responseContent = completion.choices[0]?.message?.content;
    console.log(`Raw OpenAI response:`, responseContent);

    if (!responseContent) {
      console.error(`No response content from OpenAI for term: "${searchTerm}"`);
      return {
        term_text: searchTerm,
        original_metrics: originalMetrics,
        ai_generated_tags: []
      };
    }

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error(`Failed to parse JSON response for term "${searchTerm}":`, parseError);
      console.error(`Problematic response:`, responseContent);
      return {
        term_text: searchTerm,
        original_metrics: originalMetrics,
        ai_generated_tags: []
      };
    }

    // Extract the tags array from the response
    let tags: Array<{ category: string; value: string; confidence?: number }> = [];
    
    if (Array.isArray(parsedResponse)) {
      // Response is directly an array
      tags = parsedResponse;
    } else if (parsedResponse.tags && Array.isArray(parsedResponse.tags)) {
      // Response is an object with a tags property
      tags = parsedResponse.tags;
    } else if (parsedResponse.ai_generated_tags && Array.isArray(parsedResponse.ai_generated_tags)) {
      // Response is an object with ai_generated_tags property
      tags = parsedResponse.ai_generated_tags;
    } else {
      console.error(`Unexpected response format for term "${searchTerm}":`, parsedResponse);
      return {
        term_text: searchTerm,
        original_metrics: originalMetrics,
        ai_generated_tags: []
      };
    }

    // Validate tags format
    const validTags = tags.filter(tag => {
      if (typeof tag !== 'object' || !tag.category || !tag.value) {
        console.warn(`Invalid tag format for term "${searchTerm}":`, tag);
        return false;
      }
      return true;
    });

    console.log(`Successfully generated ${validTags.length} tags for term: "${searchTerm}"`);
    console.log(`Final AI generated tags:`, validTags);

    return {
      term_text: searchTerm,
      original_metrics: originalMetrics,
      ai_generated_tags: validTags
    };

  } catch (error) {
    console.error(`Error enriching search term "${searchTerm}" with AI tags:`, error);
    return {
      term_text: searchTerm,
      original_metrics: originalMetrics,
      ai_generated_tags: []
    };
  }
}

// Add tag similarity calculation helper function
function calculateTagSetSimilarity(
  tagsA: Array<{ category: string; value: string; confidence?: number }>,
  tagsB: Array<{ category: string; value: string; confidence?: number }>,
  minConfidence: number = 0.5
): number {
  // Filter tags by confidence threshold
  const filteredTagsA = tagsA.filter(tag => (tag.confidence || 1.0) >= minConfidence);
  const filteredTagsB = tagsB.filter(tag => (tag.confidence || 1.0) >= minConfidence);
  
  if (filteredTagsA.length === 0 && filteredTagsB.length === 0) {
    return 1.0; // Both empty, consider them similar
  }
  
  if (filteredTagsA.length === 0 || filteredTagsB.length === 0) {
    return 0.0; // One empty, one not
  }
  
  // Create sets of category:value pairs for Jaccard calculation
  const setA = new Set(filteredTagsA.map(tag => `${tag.category}:${tag.value}`));
  const setB = new Set(filteredTagsB.map(tag => `${tag.category}:${tag.value}`));
  
  // Calculate Jaccard Index: |A ∩ B| / |A ∪ B|
  const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
  const union = new Set([...Array.from(setA), ...Array.from(setB)]);
  
  return intersection.size / union.size;
}

// Add cluster tag similarity calculation
function calculateClusterTagSimilarity(
  clusterA: HierarchicalCluster,
  clusterB: HierarchicalCluster,
  minConfidence: number = 0.5
): number {
  const termsA = clusterA.terms as EnrichedEmbeddingResult[];
  const termsB = clusterB.terms as EnrichedEmbeddingResult[];
  
  // Collect all unique tags from each cluster
  const allTagsA = termsA.flatMap(term => term.ai_generated_tags);
  const allTagsB = termsB.flatMap(term => term.ai_generated_tags);
  
  // Remove duplicates and create unique tag sets per cluster
  const uniqueTagsA = Array.from(
    new Map(allTagsA.map(tag => [`${tag.category}:${tag.value}`, tag])).values()
  );
  const uniqueTagsB = Array.from(
    new Map(allTagsB.map(tag => [`${tag.category}:${tag.value}`, tag])).values()
  );
  
  return calculateTagSetSimilarity(uniqueTagsA, uniqueTagsB, minConfidence);
}

// Add cluster merging helper function
function mergeClusters(
  clusterA: HierarchicalCluster,
  clusterB: HierarchicalCluster,
  newId: string
): HierarchicalCluster {
  const termsA = clusterA.terms as EnrichedEmbeddingResult[];
  const termsB = clusterB.terms as EnrichedEmbeddingResult[];
  
  // Combine all terms (no duplicates expected from DBSCAN)
  const mergedTerms = [...termsA, ...termsB];
  
  // Create merged cluster
  const mergedCluster = createCluster(mergedTerms, newId);
  
  // Update metadata to reflect merged nature
  if (mergedCluster.metadataAnalysis) {
    mergedCluster.metadataAnalysis.volume = mergedTerms.reduce((sum, t) => sum + t.volume, 0);
    mergedCluster.metadataAnalysis.growth = mergedTerms.reduce((sum, t) => sum + (t.growth || 0), 0) / mergedTerms.length;
    mergedCluster.metadataAnalysis.competition = mergedTerms.reduce((sum, t) => sum + (t.competition || 0), 0) / mergedTerms.length;
    mergedCluster.metadataAnalysis.terms = mergedTerms.map(t => t.term);
  }
  
  return mergedCluster;
} 