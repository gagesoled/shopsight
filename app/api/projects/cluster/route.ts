import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Level2SearchTermData, 
  Level2ProductData,
  ClusterResult,
  ProductClusterResult
} from "@/lib/types";
import { createSearchClusters } from "@/lib/analysis/search-clustering";
import { OpenAI } from "openai";

// Define the request body schema
const ClusterRequestSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(['search_terms', 'products']),
  data: z.array(z.any()), // We'll validate the specific structure in the handler
  settings: z.object({
    maxClusters: z.number().min(1).max(20),
    minClusterSize: z.number().min(1).max(10),
    similarityThreshold: z.number().min(0).max(1),
  }),
});

// Helper function to calculate similarity between search terms
function calculateSearchTermSimilarity(term1: Level2SearchTermData, term2: Level2SearchTermData): number {
  // Convert terms to lowercase for comparison
  const t1 = term1.Search_Term.toLowerCase();
  const t2 = term2.Search_Term.toLowerCase();
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(t1, t2);
  const maxLength = Math.max(t1.length, t2.length);
  
  // Convert distance to similarity score (0 to 1)
  return 1 - (distance / maxLength);
}

// Helper function to calculate similarity between products
function calculateProductSimilarity(product1: Level2ProductData, product2: Level2ProductData): number {
  // Calculate similarity based on multiple factors
  const factors = [
    // Category similarity
    product1.category === product2.category ? 1 : 0,
    // Price similarity (normalized)
    calculatePriceSimilarity(product1.average_selling_price, product2.average_selling_price),
    // Rating similarity (normalized)
    calculateRatingSimilarity(product1.Average_Customer_Rating, product2.Average_Customer_Rating),
    // BSR similarity (normalized)
    calculateBSRSimilarity(product1.Average_BSR, product2.Average_BSR),
  ];
  
  // Return average similarity
  return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
}

// Helper function to calculate price similarity
function calculatePriceSimilarity(price1: number, price2: number): number {
  const maxPrice = Math.max(price1, price2);
  const minPrice = Math.min(price1, price2);
  return 1 - (Math.abs(price1 - price2) / maxPrice);
}

// Helper function to calculate rating similarity
function calculateRatingSimilarity(rating1: number, rating2: number): number {
  return 1 - (Math.abs(rating1 - rating2) / 5); // Assuming 5-star rating system
}

// Helper function to calculate BSR similarity
function calculateBSRSimilarity(bsr1: number, bsr2: number): number {
  const maxBSR = Math.max(bsr1, bsr2);
  const minBSR = Math.min(bsr1, bsr2);
  return 1 - (Math.abs(bsr1 - bsr2) / maxBSR);
}

// Levenshtein distance implementation
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // substitution
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1      // insertion
        );
      }
    }
  }

  return dp[m][n];
}

// Clustering algorithm for search terms
function clusterSearchTerms(
  terms: Level2SearchTermData[],
  settings: { maxClusters: number; minClusterSize: number; similarityThreshold: number }
): ClusterResult[] {
  const clusters: ClusterResult[] = [];
  const unassignedTerms = [...terms];

  while (unassignedTerms.length > 0 && clusters.length < settings.maxClusters) {
    // Start a new cluster with the first unassigned term
    const seedTerm = unassignedTerms.shift()!;
    const clusterTerms: Level2SearchTermData[] = [seedTerm];
    const clusterKeywords: string[] = [seedTerm.Search_Term];

    // Find similar terms
    for (let i = unassignedTerms.length - 1; i >= 0; i--) {
      const term = unassignedTerms[i];
      const similarity = calculateSearchTermSimilarity(seedTerm, term);

      if (similarity >= settings.similarityThreshold) {
        clusterTerms.push(term);
        clusterKeywords.push(term.Search_Term);
        unassignedTerms.splice(i, 1);
      }
    }

    // Only create cluster if it meets minimum size
    if (clusterTerms.length >= settings.minClusterSize) {
      // Calculate cluster metrics
      const totalVolume = clusterTerms.reduce((sum, term) => sum + (term.Volume || 0), 0);
      const avgClickShare = clusterTerms.reduce((sum, term) => sum + (term.Click_Share || 0), 0) / clusterTerms.length;

      // Create cluster result
      clusters.push({
        id: uuidv4(),
        name: generateClusterName(clusterKeywords),
        description: generateClusterDescription(clusterTerms),
        opportunityScore: calculateOpportunityScore(clusterTerms),
        keywords: clusterKeywords,
        tags: generateClusterTags(clusterTerms),
        searchVolume: totalVolume,
        clickShare: avgClickShare,
      });
    }
  }

  return clusters;
}

// Clustering algorithm for products
function clusterProducts(
  products: Level2ProductData[],
  settings: { maxClusters: number; minClusterSize: number; similarityThreshold: number }
): ProductClusterResult[] {
  const clusters: ProductClusterResult[] = [];
  const unassignedProducts = [...products];

  while (unassignedProducts.length > 0 && clusters.length < settings.maxClusters) {
    // Start a new cluster with the first unassigned product
    const seedProduct = unassignedProducts.shift()!;
    const clusterProducts: Level2ProductData[] = [seedProduct];

    // Find similar products
    for (let i = unassignedProducts.length - 1; i >= 0; i--) {
      const product = unassignedProducts[i];
      const similarity = calculateProductSimilarity(seedProduct, product);

      if (similarity >= settings.similarityThreshold) {
        clusterProducts.push(product);
        unassignedProducts.splice(i, 1);
      }
    }

    // Only create cluster if it meets minimum size
    if (clusterProducts.length >= settings.minClusterSize) {
      // Calculate cluster metrics
      const avgPrice = clusterProducts.reduce((sum, p) => sum + p.average_selling_price, 0) / clusterProducts.length;
      const avgRating = clusterProducts.reduce((sum, p) => sum + p.Average_Customer_Rating, 0) / clusterProducts.length;
      const totalReviews = clusterProducts.reduce((sum, p) => sum + p.total_ratings, 0);
      const marketShare = clusterProducts.reduce((sum, p) => sum + p.Click_Share, 0) / clusterProducts.length;

      // Create cluster result
      clusters.push({
        id: uuidv4(),
        name: generateProductClusterName(clusterProducts),
        description: generateProductClusterDescription(clusterProducts),
        products: clusterProducts.map(p => ({
          ASIN: p.ASIN,
          Product_Name: p.Product_Name,
          Brand: p.Brand,
          Price: p.average_selling_price,
          Rating: p.Average_Customer_Rating,
          Review_Count: p.total_ratings,
          Market_Share: p.Click_Share,
          BSR: p.Average_BSR,
        })),
        metrics: {
          averagePrice: avgPrice,
          averageRating: avgRating,
          totalReviews,
          marketShare,
        },
      });
    }
  }

  return clusters;
}

// Helper function to generate cluster name
function generateClusterName(keywords: string[]): string {
  // Find common words or patterns
  const words = keywords.map(k => k.toLowerCase().split(/\s+/));
  const commonWords = findCommonWords(words);
  
  if (commonWords.length > 0) {
    return commonWords.join(' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // Fallback to first keyword
  return keywords[0];
}

// Helper function to generate cluster description
function generateClusterDescription(terms: Level2SearchTermData[]): string {
  const volumes = terms.map(t => t.Volume || 0);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const maxVolume = Math.max(...volumes);
  
  return `Cluster of ${terms.length} search terms with average volume of ${Math.round(avgVolume)} and maximum volume of ${maxVolume}`;
}

// Helper function to generate product cluster name
function generateProductClusterName(products: Level2ProductData[]): string {
  // Use most common category
  const categories = products.map(p => p.category);
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostCommonCategory = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  return `${mostCommonCategory} Products`;
}

// Helper function to generate product cluster description
function generateProductClusterDescription(products: Level2ProductData[]): string {
  const avgPrice = products.reduce((sum, p) => sum + p.average_selling_price, 0) / products.length;
  const avgRating = products.reduce((sum, p) => sum + p.Average_Customer_Rating, 0) / products.length;
  
  return `Cluster of ${products.length} products with average price of $${avgPrice.toFixed(2)} and average rating of ${avgRating.toFixed(1)}`;
}

// Helper function to calculate opportunity score
function calculateOpportunityScore(terms: Level2SearchTermData[]): number {
  const volumes = terms.map(t => t.Volume || 0);
  const clickShares = terms.map(t => t.Click_Share || 0);
  const growthRates = terms.map(t => t.Growth_180 || 0);
  
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const avgClickShare = clickShares.reduce((sum, c) => sum + c, 0) / clickShares.length;
  const avgGrowth = growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length;
  
  // Normalize and weight factors
  const volumeScore = Math.min(avgVolume / 10000, 1) * 0.4;
  const clickShareScore = (1 - avgClickShare) * 0.3;
  const growthScore = Math.max(avgGrowth, 0) * 0.3;
  
  return (volumeScore + clickShareScore + growthScore) * 100;
}

// Helper function to generate cluster tags
function generateClusterTags(terms: Level2SearchTermData[]): { category: string; value: string }[] {
  const tags: { category: string; value: string }[] = [];
  
  // Add volume tag
  const avgVolume = terms.reduce((sum, t) => sum + (t.Volume || 0), 0) / terms.length;
  tags.push({
    category: 'Volume',
    value: avgVolume > 10000 ? 'High' : avgVolume > 1000 ? 'Medium' : 'Low',
  });
  
  // Add growth tag
  const avgGrowth = terms.reduce((sum, t) => sum + (t.Growth_180 || 0), 0) / terms.length;
  tags.push({
    category: 'Growth',
    value: avgGrowth > 0.1 ? 'High' : avgGrowth > 0 ? 'Stable' : 'Declining',
  });
  
  return tags;
}

// Helper function to find common words
function findCommonWords(wordArrays: string[][]): string[] {
  if (wordArrays.length === 0) return [];
  
  const firstArray = wordArrays[0];
  return firstArray.filter(word => 
    wordArrays.every(array => array.includes(word))
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = ClusterRequestSchema.parse(body);
    
    const { project_id, type, data, settings } = validatedData;
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    if (type === 'search_terms') {
      // Validate search term data structure
      const searchTerms = data as Level2SearchTermData[];
      
      // Use AI-based clustering
      const clusters = await createSearchClusters(searchTerms, openai);
      
      return NextResponse.json({
        success: true,
        data: clusters
      });
    } else if (type === 'products') {
      // Validate product data structure
      const products = data as Level2ProductData[];
      
      // Use product clustering
      const clusters = clusterProducts(products, settings);
      
      return NextResponse.json({
        success: true,
        data: clusters
      });
    }
    
    return NextResponse.json({
      success: false,
      message: "Invalid cluster type"
    }, { status: 400 });
    
  } catch (error) {
    console.error("Error processing cluster request:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred"
    }, { status: 500 });
  }
} 