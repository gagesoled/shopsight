import {
  Level2SearchTermData,
  Level2ProductData,
  ClusterResult,
} from "@/lib/types";
import { OpenAI } from "openai";
import { runAIClustering, generateClusterMetadata, EmbeddingResult } from "./ai-clustering";

// Define the structure for combined results
interface CombinedCluster extends ClusterResult {
  linkedProductMetrics?: {
    avgPrice?: number;
    avgRating?: number;
    totalReviews?: number;
    dominantBrands?: string[];
  };
}

interface NicheAnalysisResult {
  clusters: CombinedCluster[];
  overallInsights: string[];
}

export async function analyzeNicheData(
  searchTerms: Level2SearchTermData[],
  products: Level2ProductData[]
): Promise<NicheAnalysisResult> {
  console.log(`Starting combined analysis: ${searchTerms.length} terms, ${products.length} products`);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // --- 1. Data Linking (Example: ASIN matching) ---
  console.log("Linking search terms to products via ASIN...");
  const productMap = new Map(products.map(p => [p.ASIN, p]));
  const termToProductsMap = new Map<string, Level2ProductData[]>();

  searchTerms.forEach(term => {
    const linkedProducts: Level2ProductData[] = [];
    const asins = [
      term.Top_Clicked_Product_1_ASIN,
      term.Top_Clicked_Product_2_ASIN,
      term.Top_Clicked_Product_3_ASIN
    ].filter(Boolean) as string[];

    asins.forEach(asin => {
      if (productMap.has(asin)) {
        linkedProducts.push(productMap.get(asin)!);
      }
    });
    if (linkedProducts.length > 0) {
      termToProductsMap.set(term.Search_Term, linkedProducts);
    }
  });
  console.log(`Linked ${termToProductsMap.size} terms to products.`);

  // --- 2. Cluster Search Terms (Using the dynamic AI method) ---
  console.log("Clustering search terms...");
  const searchTermsForClustering: Level2SearchTermData[] = searchTerms.map(st => ({
    ...st,
  }));
  const initialClusters = await runAIClustering(searchTermsForClustering, openai);
  console.log(`Generated ${initialClusters.length} initial search term clusters.`);

  // --- 3. Enrich Clusters with Product Data ---
  console.log("Enriching clusters with product data...");
  const enrichedClusters: CombinedCluster[] = await Promise.all(initialClusters.map(async cluster => {
    // Regenerate metadata dynamically based on *this* cluster's terms
    const metadata = await generateClusterMetadata(cluster.terms as EmbeddingResult[], openai);

    const clusterTermsData = cluster.terms as EmbeddingResult[];
    const linkedProductsInCluster: Level2ProductData[] = [];
    clusterTermsData.forEach(termResult => {
      const productsForTerm = termToProductsMap.get(termResult.term);
      if (productsForTerm) {
        linkedProductsInCluster.push(...productsForTerm);
      }
    });

    // Calculate aggregate product metrics for this cluster
    let linkedProductMetrics: CombinedCluster['linkedProductMetrics'] = {};
    if (linkedProductsInCluster.length > 0) {
      const uniqueProducts = Array.from(new Map(linkedProductsInCluster.map(p => [p.ASIN, p])).values()); // Deduplicate
      const prices = uniqueProducts.map(p => p.Price).filter(p => p !== undefined) as number[];
      const ratings = uniqueProducts.map(p => p.Rating).filter(r => r !== undefined) as number[];
      const reviews = uniqueProducts.map(p => p.Review_Count).filter(rc => rc !== undefined) as number[];
      const brands = uniqueProducts.map(p => p.Brand).filter(b => b !== undefined) as string[];

      linkedProductMetrics = {
        avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : undefined,
        avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
        totalReviews: reviews.reduce((a, b) => a + b, 0),
        dominantBrands: getDominantItems(brands, 3) // Get top 3 brands
      };
    }

    // Calculate combined opportunity score
    const baseMetrics = calculateClusterMetrics(searchTerms.filter(st => clusterTermsData.some(ct => ct.term === st.Search_Term)));
    let finalOpportunityScore = baseMetrics.opportunityScore;
    if (linkedProductMetrics.avgRating && linkedProductMetrics.avgRating < 3.5) {
      finalOpportunityScore = Math.min(100, finalOpportunityScore * 1.2); // Boost score if linked products have low ratings (gap)
    }

    return {
      id: cluster.id,
      name: metadata.title,
      description: metadata.description,
      searchVolume: baseMetrics.searchVolume,
      clickShare: baseMetrics.clickShare,
      opportunityScore: finalOpportunityScore,
      keywords: clusterTermsData.map(t => t.term),
      tags: metadata.tags,
      linkedProductMetrics: linkedProductMetrics
    };
  }));

  // --- 4. Generate Overall Insights ---
  const overallInsights = [
    `Analysis complete for ${searchTerms.length} search terms and ${products.length} products.`,
    `Identified ${enrichedClusters.length} distinct clusters.`,
    // Add more sophisticated AI-driven insights here later
  ];

  console.log("Combined analysis finished.");
  return {
    clusters: enrichedClusters,
    overallInsights,
  };
}

// Helper to get dominant items (e.g., brands)
function getDominantItems(items: string[], topN: number): string[] {
  if (!items || items.length === 0) return [];
  const counts: Record<string, number> = {};
  items.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
  return Object.entries(counts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, topN)
    .map(([item]) => item);
}

// Reuse the basic cluster metric calculation
function calculateClusterMetrics(terms: Level2SearchTermData[]): { searchVolume: number; clickShare: number; opportunityScore: number } {
  const totalVolume = terms.reduce((sum, term) => sum + (term.Volume || 0), 0);
  const weightedClickShare = totalVolume > 0 ? terms.reduce((sum, term) => sum + ((term.Click_Share || 0) * (term.Volume || 0)), 0) / totalVolume : 0;
  const avgGrowth = terms.reduce((sum, term) => sum + (term.Growth_180 || term.Growth_90 || 0), 0) / (terms.length || 1);
  const opportunityScore = Math.round((totalVolume > 0 ? Math.log10(totalVolume) : 0) * (1 + avgGrowth) * (weightedClickShare * 100) / 5);
  return {
    searchVolume: totalVolume,
    clickShare: weightedClickShare,
    opportunityScore: Math.min(100, Math.max(0, opportunityScore))
  };
} 