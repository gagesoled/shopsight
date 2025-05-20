import type { Level2SearchTermData } from "../validation"

interface ClusterResult {
  id: string
  name: string
  description: string
  opportunityScore: number
  searchVolume: number
  clickShare: number
  keywords: string[]
  tags: {
    category: string
    value: string
  }[]
}

/**
 * @deprecated Use AI-based clustering from ai-clustering.ts instead
 */
export function createClusterData(searchTerms: Level2SearchTermData[]): ClusterResult[] {
  console.log(`Creating cluster data from ${searchTerms.length} search terms`);
  
  // Extract some example terms for debugging
  const sampleTerms = searchTerms.slice(0, 3).map(t => t.Search_Term);
  console.log("Sample search terms:", sampleTerms);
  
  // Run clustering without default tags
  const clusters = runClustering(searchTerms);
  
  // Log the result for debugging
  console.log(`Generated ${clusters.length} clusters`);
  if (clusters.length > 0) {
    console.log("Cluster names:", clusters.map(c => c.name));
  } else {
    console.log("No clusters were generated - check runClustering function and its internal processing");
  }
  
  return clusters;
}

/**
 * @deprecated Use AI-based clustering from ai-clustering.ts instead
 */
export function runClustering(data: Level2SearchTermData[]): ClusterResult[] {
  console.log(`Running clustering on ${data.length} search terms`);
  
  // Debug data
  if (data.length > 0) {
    console.log("First search term:", JSON.stringify(data[0]));
  }

  // Initialize clusters based on function tags
  const functionClusters: Record<string, Level2SearchTermData[]> = {}
  const formatClusters: Record<string, Level2SearchTermData[]> = {}
  const valueClusters: Record<string, Level2SearchTermData[]> = {}

  // First pass: group by explicit tags if available
  console.log("Starting first pass - grouping by explicit tags");
  let firstPassCount = 0;
  data.forEach((item) => {
    // Function tags
    if (item.Function_Inferred) {
      if (!functionClusters[item.Function_Inferred]) {
        functionClusters[item.Function_Inferred] = []
      }
      functionClusters[item.Function_Inferred].push(item)
      firstPassCount++;
    }

    // Format tags
    if (item.Format_Inferred) {
      if (!formatClusters[item.Format_Inferred]) {
        formatClusters[item.Format_Inferred] = []
      }
      formatClusters[item.Format_Inferred].push(item)
      firstPassCount++;
    }
  })
  console.log(`First pass grouped ${firstPassCount} items by explicit tags`);
  console.log("Function clusters:", Object.keys(functionClusters));
  console.log("Format clusters:", Object.keys(formatClusters));

  // Second pass: apply tag-based clustering for items without explicit tags
  const remainingItems = data.filter((item) => !item.Function_Inferred && !item.Format_Inferred)
  console.log(`${remainingItems.length} items without explicit tags for second pass`);

  // Group by inferred tags
  let secondPassCount = 0;
  remainingItems.forEach((item) => {
    try {
      // Prioritize Function tags for clustering
      if (item.Function_Inferred) {
        const functionValue = item.Function_Inferred
        if (!functionClusters[functionValue]) {
          functionClusters[functionValue] = []
        }
        functionClusters[functionValue].push(item)
        secondPassCount++;
      } else if (item.Format_Inferred) {
        const formatValue = item.Format_Inferred
        if (!formatClusters[formatValue]) {
          formatClusters[formatValue] = []
        }
        formatClusters[formatValue].push(item)
        secondPassCount++;
      } else if (item.Values_Inferred) {
        const valueValue = item.Values_Inferred
        if (!valueClusters[valueValue]) {
          valueClusters[valueValue] = []
        }
        valueClusters[valueValue].push(item)
        secondPassCount++;
      }
    } catch (error) {
      console.error(`Error processing search term "${item.Search_Term}":`, error);
    }
  })
  console.log(`Second pass grouped ${secondPassCount} items by inferred tags`);
  console.log("Function clusters after second pass:", Object.keys(functionClusters));
  console.log("Format clusters after second pass:", Object.keys(formatClusters));
  console.log("Value clusters after second pass:", Object.keys(valueClusters));

  // Convert clusters to result format
  const results: ClusterResult[] = []

  // Process function clusters (primary)
  console.log("Processing function clusters into result format");
  Object.entries(functionClusters).forEach(([functionName, items]) => {
    if (items.length === 0) return

    try {
      // Calculate metrics
      const totalVolume = items.reduce((sum, item) => sum + (item.Volume || 0), 0)
      const avgVolume = totalVolume / items.length || 0
      const avgGrowth =
        items.reduce((sum, item) => {
          const growth = item.Growth_180 !== undefined ? item.Growth_180 : (item.Growth_90 !== undefined ? item.Growth_90 : 0)
          return sum + (growth || 0)
        }, 0) / items.length || 0

      // Calculate click share (weighted average by volume)
      const weightedClickShare = totalVolume === 0 ? 0 :
        items.reduce((sum, item) => {
          const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
          return sum + (clickShare * (item.Volume || 0))
        }, 0) / totalVolume

      // Simple opportunity score calculation
      const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + (avgGrowth || 0))) / 1000) || 0)

      // Get top keywords by volume
      const topKeywords = items
        .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
        .slice(0, 5)
        .map((item) => item.Search_Term)

      // Create cluster result
      const clusterResult = {
        id: functionName.toLowerCase().replace(/\s+/g, "_"),
        name: functionName,
        description: `Keywords focused on ${functionName.toLowerCase()}`,
        opportunityScore,
        searchVolume: totalVolume,
        clickShare: weightedClickShare,
        keywords: topKeywords,
        tags: [], // Empty tags array as we're moving to AI-based tagging
      };
      
      console.log(`Created cluster: ${clusterResult.name} with ${items.length} items, ${topKeywords.length} keywords`);
      results.push(clusterResult);
    } catch (error) {
      console.error(`Error processing function cluster "${functionName}":`, error);
    }
  })

  // Process format clusters (secondary)
  console.log("Processing format clusters into result format");
  Object.entries(formatClusters).forEach(([formatName, items]) => {
    if (items.length === 0) return

    try {
      // Calculate metrics
      const totalVolume = items.reduce((sum, item) => sum + (item.Volume || 0), 0)
      const avgVolume = totalVolume / items.length || 0
      const avgGrowth =
        items.reduce((sum, item) => {
          const growth = item.Growth_180 !== undefined ? item.Growth_180 : (item.Growth_90 !== undefined ? item.Growth_90 : 0)
          return sum + (growth || 0)
        }, 0) / items.length || 0

      // Calculate click share (weighted average by volume)
      const weightedClickShare = totalVolume === 0 ? 0 :
        items.reduce((sum, item) => {
          const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
          return sum + (clickShare * (item.Volume || 0))
        }, 0) / totalVolume

      // Simple opportunity score calculation
      const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + (avgGrowth || 0))) / 1000) || 0)

      // Get top keywords by volume
      const topKeywords = items
        .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
        .slice(0, 5)
        .map((item) => item.Search_Term)

      // Create cluster result
      const clusterResult = {
        id: formatName.toLowerCase().replace(/\s+/g, "_"),
        name: formatName,
        description: `Keywords focused on ${formatName.toLowerCase()}`,
        opportunityScore,
        searchVolume: totalVolume,
        clickShare: weightedClickShare,
        keywords: topKeywords,
        tags: [], // Empty tags array as we're moving to AI-based tagging
      };
      
      console.log(`Created cluster: ${clusterResult.name} with ${items.length} items, ${topKeywords.length} keywords`);
      results.push(clusterResult);
    } catch (error) {
      console.error(`Error processing format cluster "${formatName}":`, error);
    }
  })

  return results;
}

/**
 * Calculate opportunity score based on volume, growth, and competition
 */
export function calculateOpportunityScore(volume: number, growth: number, competition: number): number {
  // Normalize inputs
  const normalizedVolume = Math.min(volume / 1000, 1) // Cap at 1000
  const normalizedGrowth = Math.min(growth, 1) // Cap at 100%
  const normalizedCompetition = Math.min(competition / 100, 1) // Cap at 100%

  // Calculate base score
  const baseScore = (normalizedVolume * (1 + normalizedGrowth)) * (1 - normalizedCompetition)

  // Scale to 0-100 range
  return Math.round(baseScore * 100)
}
