import { OpenAI } from "openai";
import { Level2SearchTermData } from "@/lib/types";
import { runAIClustering, generateClusterMetadata, EmbeddingResult } from "./ai-clustering";

interface SearchCluster {
  id: string;
  name: string;
  description: string;
  searchVolume: number;
  clickShare: number;
  opportunityScore: number;
  terms: string[];
  tags: {
    category: string;
    value: string;
    confidence?: number;
  }[];
}

function calculateClusterMetrics(terms: Level2SearchTermData[]): { searchVolume: number; clickShare: number; opportunityScore: number } {
  const totalVolume = terms.reduce((sum, term) => sum + (term.Volume || 0), 0);
  const weightedClickShare = totalVolume > 0 
    ? terms.reduce((sum, term) => sum + ((term.Click_Share || 0) * (term.Volume || 0)), 0) / totalVolume
    : 0;
  
  // Calculate opportunity score based on volume, growth, and competition
  const avgGrowth = terms.reduce((sum, term) => sum + (term.Growth_180 || term.Growth_90 || 0), 0) / terms.length;
  const avgClickShare = terms.reduce((sum, term) => sum + (term.Click_Share || 0), 0) / terms.length;
  
  // Enhanced opportunity score calculation with safety checks
  const volumeFactor = totalVolume > 0 ? Math.log10(totalVolume) / 5 : 0;
  const growthFactor = 1 + (isFinite(avgGrowth) ? avgGrowth : 0);
  const clickShareFactor = isFinite(avgClickShare) ? avgClickShare * 100 : 0;
  
  const opportunityScore = Math.round(volumeFactor * growthFactor * clickShareFactor);

  return {
    searchVolume: totalVolume,
    clickShare: weightedClickShare,
    opportunityScore: Math.min(100, Math.max(0, opportunityScore))
  };
}

export async function createSearchClusters(searchTerms: Level2SearchTermData[], openai: OpenAI): Promise<SearchCluster[]> {
  if (!searchTerms?.length) {
    console.log("No search terms provided for clustering");
    return [];
  }

  console.log(`Starting clustering for ${searchTerms.length} search terms`);

  try {
    // Use the AI-based clustering approach
    const clusters = await runAIClustering(searchTerms, openai);
    console.log(`Generated ${clusters.length} clusters using AI-based approach`);

    // Convert AI clusters to search clusters
    const searchClusters: SearchCluster[] = await Promise.all(
      clusters.map(async (cluster) => {
        try {
          // Generate metadata for the cluster
          const metadata = await generateClusterMetadata(cluster.terms as EmbeddingResult[], openai);
          
          // Map the terms to Level2SearchTermData format with proper type handling
          const clusterTerms = cluster.terms.map(t => {
            const term = t as EmbeddingResult;
            return {
              Search_Term: term.term,
              Volume: term.volume,
              Click_Share: term.clickShare || 0,
              Growth_180: term.growth || 0,
              Growth_90: term.growth || 0
            } as Level2SearchTermData;
          });
          
          // Calculate metrics
          const metrics = calculateClusterMetrics(clusterTerms);

          return {
            id: cluster.id,
            name: metadata.title,
            description: metadata.description,
            searchVolume: metrics.searchVolume,
            clickShare: metrics.clickShare,
            opportunityScore: metrics.opportunityScore,
            terms: cluster.terms.map(t => (t as EmbeddingResult).term),
            tags: metadata.tags
          };
        } catch (error) {
          console.error(`Error processing cluster ${cluster.id}:`, error);
          // Return a basic cluster if metadata generation fails
          return {
            id: cluster.id,
            name: "Uncategorized Group",
            description: `A group of ${cluster.terms.length} related search terms`,
            searchVolume: 0,
            clickShare: 0,
            opportunityScore: 0,
            terms: cluster.terms.map(t => (t as EmbeddingResult).term),
            tags: []
          };
        }
      })
    );

    console.log(`Returning ${searchClusters.length} search clusters`);
    return searchClusters;
  } catch (error) {
    console.error("Error in createSearchClusters:", error);
    return [];
  }
} 