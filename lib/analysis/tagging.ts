import type { Tag } from "../validation"

/**
 * Apply tags to a keyword based on the provided tag rules
 */
export function applyTags(keyword: string, tags: Tag[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const k = keyword.toLowerCase()

  console.log(`Applying tags to keyword: "${keyword}"`)
  
  if (!tags || tags.length === 0) {
    console.warn("No tags provided for tagging - returning empty result")
    return result
  }

  // Group tags by category
  const tagsByCategory = tags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = []
      }
      acc[tag.category].push(tag)
      return acc
    },
    {} as Record<string, Tag[]>,
  )

  // Initialize result with empty arrays for each category
  Object.keys(tagsByCategory).forEach((category) => {
    result[category] = []
  })

  // Apply tags for each category
  Object.entries(tagsByCategory).forEach(([category, categoryTags]) => {
    console.log(`Processing category: ${category} with ${categoryTags.length} tags`)
    
    categoryTags.forEach((tag) => {
      if (!tag.trigger || tag.trigger.trim() === '') {
        console.warn(`Tag "${tag.tag}" in category "${category}" has no trigger words - skipping`)
        return
      }
      
      // Split trigger by pipe or comma to get individual trigger words/phrases
      const triggers = tag.trigger.split(/[|,]/).map((t) => t.trim().toLowerCase()).filter(t => t.length > 0)
      
      if (triggers.length === 0) {
        console.warn(`Tag "${tag.tag}" in category "${category}" has no valid triggers after splitting/trimming - skipping`)
        return
      }

      // Check if any trigger matches the keyword
      const matchedTrigger = triggers.find(trigger => k.includes(trigger))
      if (matchedTrigger) {
        result[category].push(tag.tag)
        console.log(`✓ Tag applied: ${category} - ${tag.tag} (matched trigger: "${matchedTrigger}" in "${k}")`)
      }
    })
  })

  const totalTagsApplied = Object.values(result).flat().length
  console.log(`Tags applied to "${keyword}": ${totalTagsApplied} total tags across ${Object.keys(result).length} categories`, result)
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
  
  const tags = jsonData.map((item) => ({
    category: item.Category,
    tag: item.Tag,
    trigger: item.Trigger,
  }))

  console.log(`Parsed ${tags.length} tags from ontology`)
  return tags
}
