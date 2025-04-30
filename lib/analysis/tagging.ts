import type { Tag } from "../validation"
import { sampleTagOntology } from "../tagOntology"

/**
 * Apply tags to a keyword based on the provided tag rules
 */
export function applyTags(keyword: string, tags: Tag[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const k = keyword.toLowerCase()
  
  if (!tags || tags.length === 0) {
    return result
  }

  // Group tags by category only once
  const tagsByCategory = tags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = []
      }
      acc[tag.category].push(tag)
      return acc
    },
    {} as Record<string, Tag[]>
  )

  // Initialize result with empty arrays for each category found in the ontology
  Object.keys(tagsByCategory).forEach((category) => {
    result[category] = []
  })

  // Apply tags for each category
  Object.entries(tagsByCategory).forEach(([category, categoryTags]) => {
    categoryTags.forEach((tag) => {
      if (!tag.trigger || typeof tag.trigger !== 'string' || tag.trigger.trim() === '') {
        return
      }
      
      // Split trigger by pipe or comma to get individual trigger words/phrases
      const triggers = tag.trigger.split(/[|,]/).map((t) => t.trim().toLowerCase()).filter(t => t.length > 0)
      
      if (triggers.length === 0) {
        return
      }

      // Check if any trigger matches the keyword
      const matchedTrigger = triggers.find(trigger => k.includes(trigger))
      if (matchedTrigger) {
        // Add tag only if not already present for this category
        if (!result[category].includes(tag.tag)) {
        result[category].push(tag.tag)
        }
      }
    })
  })

  // Clean up empty categories
  Object.keys(result).forEach(category => {
    if (result[category].length === 0) {
      delete result[category]
    }
  })

  const totalTagsApplied = Object.values(result).flat().length
  return result
}

/**
 * Parse tag ontology from JSON
 */
export function parseTagOntology(jsonData: any[]): Tag[] {
  if (!jsonData || !Array.isArray(jsonData)) {
    console.error("Invalid tag ontology data provided - expected array")
    return []
  }
  
  const tags = jsonData.map((item, index) => {
    // Basic validation for each tag item
    if (!item || typeof item.Category !== 'string' || typeof item.Tag !== 'string' || typeof item.Trigger !== 'string') {
      console.warn(`Invalid tag structure at index ${index}:`, item)
      return null // Mark as null to filter out later
    }
    return {
    category: item.Category,
    tag: item.Tag,
    trigger: item.Trigger,
    } as Tag // Assert type after validation
  }).filter((tag): tag is Tag => tag !== null) // Filter out invalid entries

  console.log(`Parsed ${tags.length} valid tags from ontology data containing ${jsonData.length} items.`)
  return tags
}
