import type { Level2SearchTermData, Tag } from "@/lib/schemas"
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
 * Run clustering algorithm on Level 2 search term data
 */
export function runClustering(data: Level2SearchTermData[], tags: Tag[]): ClusterResult[] {
  console.log(`Running clustering on ${data.length} search terms with ${tags.length} tags`)

  // Initialize clusters based on function tags
  const functionClusters: Record<string, Level2SearchTermData[]> = {}
  const formatClusters: Record<string, Level2SearchTermData[]> = {}
  const valueClusters: Record<string, Level2SearchTermData[]> = {}

  // First pass: group by explicit tags if available
  data.forEach((item) => {
    // Function tags
    if (item.Function_Inferred) {
      if (!functionClusters[item.Function_Inferred]) {
        functionClusters[item.Function_Inferred] = []
      }
      functionClusters[item.Function_Inferred].push(item)
    }

    // Format tags
    if (item.Format_Inferred) {
      if (!formatClusters[item.Format_Inferred]) {
        formatClusters[item.Format_Inferred] = []
      }
      formatClusters[item.Format_Inferred].push(item)
    }
  })

  // Second pass: apply tag-based clustering for items without explicit tags
  const remainingItems = data.filter((item) => !item.Function_Inferred && !item.Format_Inferred)
  console.log(`${remainingItems.length} items without explicit tags`)

  // Group by inferred tags
  remainingItems.forEach((item) => {
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
    } else if (formatTag && formatTag[1].length > 0) {
      const formatValue = formatTag[1][0]
      if (!formatClusters[formatValue]) {
        formatClusters[formatValue] = []
      }
      formatClusters[formatValue].push(item)
    } else if (valueTag && valueTag[1].length > 0) {
      const valueValue = valueTag[1][0]
      if (!valueClusters[valueValue]) {
        valueClusters[valueValue] = []
      }
      valueClusters[valueValue].push(item)
    }
  })

  // Convert clusters to result format
  const results: ClusterResult[] = []

  // Process function clusters (primary)
  Object.entries(functionClusters).forEach(([functionName, items]) => {
    if (items.length === 0) return

    // Calculate metrics
    const totalVolume = items.reduce((sum, item) => sum + item.Volume, 0)
    const avgVolume = totalVolume / items.length
    const avgGrowth =
      items.reduce((sum, item) => {
        const growth = item.Growth_180 !== undefined ? item.Growth_180 : 0
        return sum + growth
      }, 0) / items.length

    // Calculate click share (weighted average by volume)
    const weightedClickShare =
      items.reduce((sum, item) => {
        const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
        return sum + clickShare * item.Volume
      }, 0) / totalVolume

    // Simple opportunity score calculation
    const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + avgGrowth)) / 1000))

    // Get top keywords by volume
    const topKeywords = items
      .sort((a, b) => b.Volume - a.Volume)
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
    results.push({
      id: functionName.toLowerCase().replace(/\s+/g, "_"),
      name: functionName,
      description: `Keywords focused on ${functionName.toLowerCase()}`,
      opportunityScore,
      searchVolume: totalVolume,
      clickShare: weightedClickShare,
      keywords: topKeywords,
      tags: tagArray,
    })
  })

  // Process format clusters (secondary)
  Object.entries(formatClusters).forEach(([formatName, items]) => {
    if (items.length === 0) return

    // Skip if all items are already in function clusters
    const uniqueItems = items.filter((item) => !Object.values(functionClusters).flat().includes(item))
    if (uniqueItems.length === 0) return

    // Calculate metrics
    const totalVolume = uniqueItems.reduce((sum, item) => sum + item.Volume, 0)
    const avgVolume = totalVolume / uniqueItems.length
    const avgGrowth =
      uniqueItems.reduce((sum, item) => {
        const growth = item.Growth_180 !== undefined ? item.Growth_180 : 0
        return sum + growth
      }, 0) / uniqueItems.length

    // Calculate click share (weighted average by volume)
    const weightedClickShare =
      uniqueItems.reduce((sum, item) => {
        const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
        return sum + clickShare * item.Volume
      }, 0) / totalVolume

    // Simple opportunity score calculation
    const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + avgGrowth)) / 1000))

    // Get top keywords by volume
    const topKeywords = uniqueItems
      .sort((a, b) => b.Volume - a.Volume)
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
  Object.entries(valueClusters).forEach(([valueName, items]) => {
    if (items.length === 0) return

    // Skip if all items are already in function or format clusters
    const uniqueItems = items.filter(
      (item) =>
        !Object.values(functionClusters).flat().includes(item) &&
        !Object.values(formatClusters).flat().includes(item),
    )
    if (uniqueItems.length === 0) return

    // Calculate metrics
    const totalVolume = uniqueItems.reduce((sum, item) => sum + item.Volume, 0)
    const avgVolume = totalVolume / uniqueItems.length
    const avgGrowth =
      uniqueItems.reduce((sum, item) => {
        const growth = item.Growth_180 !== undefined ? item.Growth_180 : 0
        return sum + growth
      }, 0) / uniqueItems.length

    // Calculate click share (weighted average by volume)
    const weightedClickShare =
      uniqueItems.reduce((sum, item) => {
        const clickShare = item.Click_Share !== undefined ? item.Click_Share : 0
        return sum + clickShare * item.Volume
      }, 0) / totalVolume

    // Simple opportunity score calculation
    const opportunityScore = Math.min(100, Math.round((avgVolume * (1 + avgGrowth)) / 1000))

    // Get top keywords by volume
    const topKeywords = uniqueItems
      .sort((a, b) => b.Volume - a.Volume)
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
