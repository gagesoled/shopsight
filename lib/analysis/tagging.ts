import type { Tag } from "@/lib/schemas"

/**
 * Apply tags to a keyword based on the provided tag rules
 */
export function applyTags(keyword: string, tags: Tag[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const k = keyword.toLowerCase()

  console.log(`Applying tags to keyword: "${keyword}"`)

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
    categoryTags.forEach((tag) => {
      // Split trigger by pipe to get individual trigger words/phrases
      const triggers = tag.trigger.split("|").map((t) => t.trim().toLowerCase())

      // Check if any trigger matches the keyword
      if (triggers.some((trigger) => k.includes(trigger))) {
        result[category].push(tag.tag)
        console.log(`Tag applied: ${category} - ${tag.tag} (matched trigger: ${triggers.find((t) => k.includes(t))})`)
      }
    })
  })

  console.log(`Tags applied to "${keyword}":`, result)
  return result
}

/**
 * Parse tag ontology from JSON
 */
export function parseTagOntology(jsonData: any[]): Tag[] {
  const tags = jsonData.map((item) => ({
    category: item.Category,
    tag: item.Tag,
    trigger: item.Trigger,
  }))

  console.log(`Parsed ${tags.length} tags from ontology`)
  return tags
}
