import type { Level2SearchTermData, Tag } from "../validation"
import { applyTags } from "@/lib/analysis/tagging"

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
 * Create clusters from search terms data
 * Uses default tags for clustering when specific tags are not provided
 */
export function createClusterData(searchTerms: Level2SearchTermData[]): ClusterResult[] {
  console.log(`Creating cluster data from ${searchTerms.length} search terms`);
  
  // Extract some example terms for debugging
  const sampleTerms = searchTerms.slice(0, 3).map(t => t.Search_Term);
  console.log("Sample search terms:", sampleTerms);
  
  // Default tags for common functions, formats, and values
  const defaultTags: Tag[] = [
    // Function tags
    { category: "Function", tag: "Snack", trigger: "snack,snacks,snacking,treat,treats" },
    { category: "Function", tag: "Meal", trigger: "meal,meals,dinner,lunch,breakfast" },
    { category: "Function", tag: "Supplement", trigger: "supplement,supplements,vitamin,vitamins,nutrition" },
    { category: "Function", tag: "Sleep Aid", trigger: "sleep,melatonin,relaxation,rest,insomnia,night" },
    { category: "Function", tag: "Energy", trigger: "energy,boost,caffeine,alertness,focus" },
    { category: "Function", tag: "Health", trigger: "health,wellness,immune,immunity,healthy" },
    
    // Format tags
    { category: "Format", tag: "Gummies", trigger: "gummy,gummies" },
    { category: "Format", tag: "Capsules", trigger: "capsule,capsules,pill,pills" },
    { category: "Format", tag: "Powder", trigger: "powder,powdered" },
    { category: "Format", tag: "Liquid", trigger: "liquid,drink,beverage" },
    { category: "Format", tag: "Bar", trigger: "bar,bars" },
    { category: "Format", tag: "Chews", trigger: "chew,chews,chewable" },
    
    // Values tags
    { category: "Values", tag: "Organic", trigger: "organic,natural,clean" },
    { category: "Values", tag: "Vegan", trigger: "vegan,plant-based,plant based" },
    { category: "Values", tag: "Non-GMO", trigger: "non-gmo,non gmo" },
    { category: "Values", tag: "Gluten-Free", trigger: "gluten-free,gluten free,no gluten" },
    { category: "Values", tag: "Sugar-Free", trigger: "sugar-free,sugar free,no sugar,zero sugar" },
    { category: "Values", tag: "High Strength", trigger: "high strength,maximum strength,extra strength,strong" },
    
    // Brand tags - add popular brands in the domain
    { category: "Brand", tag: "Nature Made", trigger: "nature made" },
    { category: "Brand", tag: "Olly", trigger: "olly" },
    { category: "Brand", tag: "Natrol", trigger: "natrol" },
    { category: "Brand", tag: "Vitafusion", trigger: "vitafusion" },
    { category: "Brand", tag: "ZzzQuil", trigger: "zzzquil" },
    { category: "Brand", tag: "Dots", trigger: "dots" },
  ];
  
  // Print tag info for debugging
  console.log(`Created ${defaultTags.length} default tags`);
  console.log(`First few tags:`, defaultTags.slice(0, 3));
  
  // Run clustering using default tags
  const clusters = runClustering(searchTerms, defaultTags);
  
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
 * Run clustering algorithm on Level 2 search term data
 */
export function runClustering(data: Level2SearchTermData[], tags: Tag[]): ClusterResult[] {
  console.log(`Running clustering on ${data.length} search terms with ${tags.length} tags`);
  
  // Debug data
  if (data.length > 0) {
    console.log("First search term:", JSON.stringify(data[0]));
  }
  if (tags.length > 0) {
    console.log("First tag:", JSON.stringify(tags[0]));
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
      const appliedTags = applyTags(item.Search_Term, tags)
      
      // Prioritize Function tags for clustering
      const functionTag = Object.entries(appliedTags).find(([category]) => category === "Function")
      const formatTag = Object.entries(appliedTags).find(([category]) => category === "Format")
      const valueTag = Object.entries(appliedTags).find(([category]) => category === "Values")

      if (functionTag && functionTag[1].length > 0) {
        const functionValue = functionTag[1][0]
        if (!functionClusters[functionValue]) {
          functionClusters[functionValue] = []
        }
        functionClusters[functionValue].push(item)
        secondPassCount++;
      } else if (formatTag && formatTag[1].length > 0) {
        const formatValue = formatTag[1][0]
        if (!formatClusters[formatValue]) {
          formatClusters[formatValue] = []
        }
        formatClusters[formatValue].push(item)
        secondPassCount++;
      } else if (valueTag && valueTag[1].length > 0) {
        const valueValue = valueTag[1][0]
        if (!valueClusters[valueValue]) {
          valueClusters[valueValue] = []
        }
        valueClusters[valueValue].push(item)
        secondPassCount++;
      }
    } catch (error) {
      console.error(`Error applying tags to search term "${item.Search_Term}":`, error);
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

      // Collect all tags from items
      const allTags: Record<string, Set<string>> = {}

      items.forEach((item) => {
        const itemTags = applyTags(item.Search_Term, tags)

        Object.entries(itemTags).forEach(([category, values]) => {
          if (!allTags[category]) {
            allTags[category] = new Set()
          }

          values.forEach((value) => allTags[category].add(value))
        })
      })

      // Convert tags to array format
      const tagArray = Object.entries(allTags).flatMap(([category, values]) =>
        Array.from(values).map((value) => ({ category, value })),
      )

      // Create cluster result
      const clusterResult = {
        id: functionName.toLowerCase().replace(/\s+/g, "_"),
        name: functionName,
        description: `Keywords focused on ${functionName.toLowerCase()}`,
        opportunityScore,
        searchVolume: totalVolume,
        clickShare: weightedClickShare,
        keywords: topKeywords,
        tags: tagArray,
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

    // Skip if all items are already in function clusters
    const uniqueItems = items.filter((item) => !Object.values(functionClusters).flat().includes(item))
    if (uniqueItems.length === 0) return

    // Calculate metrics
    const totalVolume = uniqueItems.reduce((sum, item) => sum + (item.Volume || 0), 0)
    const avgVolume = totalVolume / uniqueItems.length || 0
    const avgGrowth =
      uniqueItems.reduce((sum, item) => {
        const growth = item.Growth_180 !== undefined ? item.Growth_180 : (item.Growth_90 !== undefined ? item.Growth_90 : 0)
        return sum + (growth || 0)
      }, 0) / uniqueItems.length || 0

    // Calculate click share (weighted average by volume)
    const weightedClickShare = totalVolume === 0 ? 0 :
      uniqueItems.reduce((sum, item) => {
        const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
        return sum + (clickShare * (item.Volume || 0))
      }, 0) / totalVolume

    // Simple opportunity score calculation
    const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + (avgGrowth || 0))) / 1000) || 0)

    // Get top keywords by volume
    const topKeywords = uniqueItems
      .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
      .slice(0, 5)
      .map((item) => item.Search_Term)

    // Collect all tags from items
    const allTags: Record<string, Set<string>> = {}

    uniqueItems.forEach((item) => {
      const itemTags = applyTags(item.Search_Term, tags)

      Object.entries(itemTags).forEach(([category, values]) => {
        if (!allTags[category]) {
          allTags[category] = new Set()
        }

        values.forEach((value) => allTags[category].add(value))
      })
    })

    // Convert tags to array format
    const tagArray = Object.entries(allTags).flatMap(([category, values]) =>
      Array.from(values).map((value) => ({ category, value })),
    )

    // Create cluster result
    results.push({
      id: formatName.toLowerCase().replace(/\s+/g, "_"),
      name: formatName,
      description: `Keywords related to ${formatName.toLowerCase()} format`,
      opportunityScore,
      searchVolume: totalVolume,
      clickShare: weightedClickShare,
      keywords: topKeywords,
      tags: tagArray,
    })
  })

  // Process value clusters (tertiary)
  console.log("Processing value clusters into result format");
  Object.entries(valueClusters).forEach(([valueName, items]) => {
    if (items.length === 0) return

    // Skip if all items are already in function or format clusters
    const uniqueItems = items.filter(
      (item) =>
        !Object.values(functionClusters).flat().includes(item) &&
        !Object.values(formatClusters).flat().includes(item)
    )
    if (uniqueItems.length === 0) return

    // Calculate metrics
    const totalVolume = uniqueItems.reduce((sum, item) => sum + (item.Volume || 0), 0)
    const avgVolume = totalVolume / uniqueItems.length || 0
    const avgGrowth =
      uniqueItems.reduce((sum, item) => {
        const growth = item.Growth_180 !== undefined ? item.Growth_180 : (item.Growth_90 !== undefined ? item.Growth_90 : 0)
        return sum + (growth || 0)
      }, 0) / uniqueItems.length || 0

    // Calculate click share (weighted average by volume)
    const weightedClickShare = totalVolume === 0 ? 0 :
      uniqueItems.reduce((sum, item) => {
        const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
        return sum + (clickShare * (item.Volume || 0))
      }, 0) / totalVolume

    // Simple opportunity score calculation
    const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + (avgGrowth || 0))) / 1000) || 0)

    // Get top keywords by volume
    const topKeywords = uniqueItems
      .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
      .slice(0, 5)
      .map((item) => item.Search_Term)

    // Collect all tags from items
    const allTags: Record<string, Set<string>> = {}

    uniqueItems.forEach((item) => {
      const itemTags = applyTags(item.Search_Term, tags)

      Object.entries(itemTags).forEach(([category, values]) => {
        if (!allTags[category]) {
          allTags[category] = new Set()
        }

        values.forEach((value) => allTags[category].add(value))
      })
    })

    // Convert tags to array format
    const tagArray = Object.entries(allTags).flatMap(([category, values]) =>
      Array.from(values).map((value) => ({ category, value })),
    )

    // Create cluster result
    results.push({
      id: valueName.toLowerCase().replace(/\s+/g, "_"),
      name: valueName,
      description: `Keywords related to ${valueName.toLowerCase()} values`,
      opportunityScore,
      searchVolume: totalVolume,
      clickShare: weightedClickShare,
      keywords: topKeywords,
      tags: tagArray,
    })
  })
  
  // Fallback: If no clusters were created, create a generic one with all terms
  if (results.length === 0 && data.length > 0) {
    console.log("No clusters generated, creating a fallback generic cluster with all terms");
    
    try {
      const totalVolume = data.reduce((sum, item) => sum + (item.Volume || 0), 0);
      const avgGrowth = data.reduce((sum, item) => {
        const growth = item.Growth_180 !== undefined ? item.Growth_180 : (item.Growth_90 !== undefined ? item.Growth_90 : 0);
        return sum + (growth || 0);
      }, 0) / data.length || 0;
      
      // Get top keywords by volume
      const topKeywords = data
        .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
        .slice(0, 10)
        .map((item) => item.Search_Term);
        
      let clusterName = "All Terms";
      
      // Try to infer a more specific name from top terms
      if (topKeywords.length > 0) {
        const firstTerm = topKeywords[0].toLowerCase();
        if (firstTerm.includes("melatonin")) {
          clusterName = "Melatonin Products";
        } else if (firstTerm.includes("vitamin")) {
          clusterName = "Vitamin Supplements";
        } else if (firstTerm.includes("protein")) {
          clusterName = "Protein Products";
        }
      }
      
      results.push({
        id: "generic_cluster",
        name: clusterName,
        description: "Collection of all search terms in this dataset",
        opportunityScore: Math.min(100, Math.round((totalVolume * (1 + avgGrowth)) / 1000) || 50),
        searchVolume: totalVolume,
        clickShare: 0.1, // Default value
        keywords: topKeywords,
        tags: [{category: "Format", value: "Various"}]
      });
      
      console.log("Created fallback generic cluster with all terms");
    } catch (error) {
      console.error("Error creating fallback generic cluster:", error);
    }
  }

  console.log(`Total clusters created: ${results.length}`);
  return results
}

/**
 * Calculate opportunity score for a cluster
 */
export function calculateOpportunityScore(volume: number, growth: number, competition: number): number {
  // Simple algorithm: (volume * growth) / competition
  // Normalized to a 0-100 scale
  const rawScore = (volume * growth) / competition
  return Math.min(100, Math.max(0, Math.round(rawScore)))
}
