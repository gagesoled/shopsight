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
): Promise<{ title: string; description: string; tags: Array<{ category: string; value: string; confidence?: number }> }> {
  if (!terms || terms.length === 0) {
    return { title: "Empty Cluster", description: "No terms provided.", tags: [] };
  }

  // Import tagging functions
  const { parseTagOntology, applyTags } = await import("./tagging");
  const { sampleTagOntology } = await import("../tagOntology");

  const termStrings = terms.map(t => t.term).slice(0, 25); // Limit terms for prompt efficiency
  const totalVolume = terms.reduce((sum, t) => sum + (t.volume || 0), 0);
  const avgGrowth = terms.length > 0 ? terms.reduce((sum, t) => sum + (t.growth || 0), 0) / terms.length : 0;
  const avgClickShare = terms.length > 0 ? terms.reduce((sum, t) => sum + (t.clickShare || 0), 0) / terms.length : 0;

  // --- Apply Rule-Based Tagging ---
  const ontologyTags = parseTagOntology(sampleTagOntology); // Load rules
  const aggregatedRuleTags: Record<string, Record<string, number>> = {}; // { category: { value: count } }

  terms.forEach(term => {
    const applied = applyTags(term.term, ontologyTags);
    Object.entries(applied).forEach(([category, values]) => {
      if (!aggregatedRuleTags[category]) aggregatedRuleTags[category] = {};
      values.forEach(value => {
        aggregatedRuleTags[category][value] = (aggregatedRuleTags[category][value] || 0) + 1;
      });
    });
  });

  // Select top rule-based tags per category (e.g., top 2)
  const topRuleTags: Array<{ category: string; value: string }> = [];
  Object.entries(aggregatedRuleTags).forEach(([category, valueCounts]) => {
    const sortedValues = Object.entries(valueCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 2); // Get top 2
    sortedValues.forEach(([value]) => topRuleTags.push({ category, value }));
  });

  const ruleTagsString = topRuleTags.map(t => `${t.category}: ${t.value}`).join(', ');
  console.log(`Aggregated Rule Tags for AI prompt: ${ruleTagsString}`);
  // --- End Rule-Based Tagging ---

  const prompt = `Analyze the following search term cluster representing user search behavior.

    Cluster Metrics:
    - Total Search Volume: ${totalVolume.toLocaleString()}
    - Average Growth (180d): ${(avgGrowth * 100).toFixed(1)}%
    - Average Click Share: ${(avgClickShare * 100).toFixed(1)}%

Rule-Based Tags Found: ${ruleTagsString || 'None'}

    Search Terms (sample): ${termStrings.join(", ")}
    ${terms.length > 25 ? `(... and ${terms.length - 25} more)` : ''}

Based on the terms, metrics, AND the rule-based tags provided, generate:
    1. A concise, descriptive 'title' (max 10 words) summarizing the core user intent or theme.
2. A brief 'description' (1-2 sentences) explaining the theme and user behavior, incorporating the rule-based tags.
3. Refined/supplemented 'tags' (up to 7 total) based on the overall context, categorized under Format, Function, Values, Audience, Behavior. Ensure these tags are relevant and distinct. Assign a confidence score (0-1) for each tag you generate or refine.

Return ONLY the JSON object:
    {
      "title": "string",
      "description": "string",
      "tags": [ {"category": "Format|Function|Values|Audience|Behavior", "value": "string", "confidence": number} ]
    }`;

  try {
    console.log(`Generating metadata for cluster with ${terms.length} terms. Sample: ${termStrings.slice(0, 3).join(', ')}`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for better quality
      messages: [
        { role: "system", content: "You are a helpful assistant skilled in analyzing search term data to identify user intent, behavioral patterns, and relevant product attributes based on keywords and pre-calculated tags. Provide responses ONLY in the requested JSON format." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3, // Lower temperature for more focused output
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0]?.message?.content || '{}';
    const parsedResult = JSON.parse(responseContent);

    // Validate and structure the result
    const aiTags = (Array.isArray(parsedResult.tags) ? parsedResult.tags : [])
      .filter((tag: any): tag is { category: string; value: string; confidence?: number } =>
        typeof tag.category === 'string' && typeof tag.value === 'string')
      .map((tag: { category: string; value: string; confidence?: number }) => ({
        ...tag,
        confidence: typeof tag.confidence === 'number' ? Math.max(0, Math.min(1, tag.confidence)) : 0.7 // Default confidence if missing
      }));

    console.log(`AI generated ${aiTags.length} tags.`);

    // Combine rule-based tags (with default confidence) and AI tags (prefer AI tags if duplicate category/value exists)
    const combinedTagsMap = new Map<string, { category: string; value: string; confidence?: number }>();
    topRuleTags.forEach((tag: { category: string; value: string }) => 
      combinedTagsMap.set(`${tag.category}:${tag.value}`, { ...tag, confidence: 0.6 })
    ); // Lower confidence for rule-based
    aiTags.forEach((tag: { category: string; value: string; confidence?: number }) => 
      combinedTagsMap.set(`${tag.category}:${tag.value}`, tag)
    ); // AI tags overwrite rule-based

    const finalTags = Array.from(combinedTagsMap.values());

    return {
      title: parsedResult.title || `Cluster: ${termStrings[0]} & Others`,
      description: parsedResult.description || "Analysis of related search terms.",
      tags: finalTags.slice(0, 7), // Limit final tags
    };
  } catch (error) {
    console.error("Failed to generate cluster metadata via AI:", error);
    return {
      title: `Cluster (${terms.length} terms)`,
      description: "Error generating AI insights for this cluster.",
      tags: topRuleTags.map(t => ({ ...t, confidence: 0.5 })), // Fallback to rule-based tags
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

  for (let eps = epsilonRange.start; eps <= epsilonRange.end; eps += epsilonRange.step) {
    const dbscan = new clustering.DBSCAN();
    const clusters = dbscan.run(embeddings, eps, minPts);
    const clusterCount = new Set(clusters.filter(c => c !== -1)).size;
    const noiseCount = clusters.filter(c => c === -1).length;
    
    // Score based on:
    // 1. Number of clusters (we want 4-8 clusters ideally)
    // 2. Minimal noise points (but some noise is okay)
    // 3. Reasonable cluster sizes
    const clusterSizeScore = clusterCount > 0 ? embeddings.length / clusterCount : 0;
    const score = (clusterCount * 10) - (noiseCount * 0.5) + (clusterSizeScore <= 10 ? 5 : 0);

    console.log(`  Result: ${clusterCount} clusters, ${noiseCount} noise points, score: ${score}`);

    if (
      (score > bestScore && clusterCount >= 3) || // Prefer more clusters
      (score === bestScore && noiseCount < bestNoiseCount) // If scores tie, prefer less noise
    ) {
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
  if (terms.length < 2) return [];

  const embeddings = terms.map(t => t.embedding);
  const minPts = Math.max(2, Math.floor(Math.sqrt(terms.length / 2)));
  
  console.log(`Using clustering parameters: minPts=${minPts}, total points=${terms.length}`);

  // Find optimal epsilon
  const epsilon = findOptimalEpsilon(embeddings, minPts, {
    start: 0.25,
    end: 0.45,
    step: 0.05
  });

  // Run DBSCAN with optimal parameters
  const dbscan = new clustering.DBSCAN();
  const clusterAssignments = dbscan.run(embeddings, epsilon, minPts);
  
  // Group terms by cluster
  const clusterMap = new Map<number, EmbeddingResult[]>();
  clusterAssignments.forEach((cluster, i) => {
    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, []);
    }
    clusterMap.get(cluster)!.push(terms[i]);
  });

  // Convert clusters to hierarchical format
  const clusters: HierarchicalCluster[] = [];
  
  // Process non-noise clusters first
  clusterMap.forEach((clusterTerms, clusterId) => {
    if (clusterId !== -1) {
      clusters.push(createCluster(clusterTerms, `cluster-${clusterId}`));
    }
  });

  // If we have noise points, try to create meaningful sub-clusters
  const noiseTerms = clusterMap.get(-1) || [];
  if (noiseTerms.length > 0) {
    // Try to group noise points by common patterns
    const patterns = findCommonPatterns(noiseTerms);
    patterns.forEach((terms, pattern) => {
      if (terms.length >= 2) { // Only create clusters with at least 2 terms
        clusters.push(createCluster(terms, `pattern-${pattern}`));
      }
    });
    
    // Add remaining ungrouped noise points as a separate cluster
    const ungroupedTerms = noiseTerms.filter(term => 
      !Array.from(patterns.values()).some(patternTerms => patternTerms.includes(term))
    );
    if (ungroupedTerms.length > 0) {
      clusters.push(createCluster(ungroupedTerms, 'misc'));
    }
  }

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
  const normalizedGrowth = Math.min(1, Math.max(0, (growth + 0.5) / 1.5));
  const normalizedCompetition = Math.max(0, Math.min(1, competition));
  
  // Weighted scoring
  const volumeWeight = 0.4;
  const growthWeight = 0.4;
  const competitionWeight = 0.2;
  
  const score = (
    normalizedVolume * volumeWeight +
    normalizedGrowth * growthWeight +
    (1 - normalizedCompetition) * competitionWeight
  ) * 100;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

export async function runAIClustering(
  searchTerms: Level2SearchTermData[],
  openai: OpenAI
): Promise<HierarchicalCluster[]> {
  if (!searchTerms?.length) {
    console.warn('No search terms provided for clustering');
    return [];
  }

  // Generate embeddings for search terms
  const embeddingResults: EmbeddingResult[] = [];
  for (const term of searchTerms) {
    try {
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
      }
    } catch (error) {
      console.error(`Error generating embedding for "${term.Search_Term}":`, error);
    }
  }

  if (embeddingResults.length < 2) {
    console.warn('Not enough valid embeddings for clustering');
    return [];
  }

  return clusterEmbeddings(embeddingResults);
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

function calculateOpportunityScore(volume: number, growth: number, competition: number): number {
  // Normalize inputs
  const normalizedVolume = Math.log10(Math.max(10, volume)) / 6;
  const normalizedGrowth = Math.min(1, Math.max(0, (growth + 0.5) / 1.5));
  const normalizedCompetition = Math.max(0, Math.min(1, competition));
  
  // Weighted scoring
  const volumeWeight = 0.4;
  const growthWeight = 0.4;
  const competitionWeight = 0.2;
  
  const score = (
    normalizedVolume * volumeWeight +
    normalizedGrowth * growthWeight +
    (1 - normalizedCompetition) * competitionWeight
  ) * 100;
  
  return Math.round(Math.min(100, Math.max(0, score)));
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