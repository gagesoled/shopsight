import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to parse CSV data
export function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split("\n")
  const headers = lines[0].split(",").map((header) => header.trim())

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim())
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index]
      return obj
    }, {} as any)
  })
}

// Function to apply tags based on the ruleset
export function applyTags(keyword: string): Record<string, string[]> {
  const tags: Record<string, string[]> = {
    Format: [],
    Audience: [],
    Function: [],
    Values: [],
    Behavior: [],
  }

  const k = keyword.toLowerCase()

  // Format tags
  if (k.includes("gummy") || k.includes("chews")) {
    tags["Format"].push("Gummies")
  }
  if (k.includes("tea") || k.includes("herbal drink")) {
    tags["Format"].push("Tea")
  }
  if (k.includes("spray")) {
    tags["Format"].push("Spray")
  }
  if (k.includes("capsule") || k.includes("pill") || k.includes("softgel")) {
    tags["Format"].push("Capsule")
  }

  // Audience tags
  if (k.includes("kids") || k.includes("children") || k.includes("toddler")) {
    tags["Audience"].push("Kids")
  }
  if (k.includes("women") || k.includes("female") || k.includes("pregnancy")) {
    tags["Audience"].push("Women")
  }

  // Function tags
  if (k.includes("fall asleep") || k.includes("fast-acting") || k.includes("quick sleep")) {
    tags["Function"].push("Sleep Onset")
  }
  if (k.includes("stay asleep") || k.includes("through the night")) {
    tags["Function"].push("Sleep Maintenance")
  }

  // Values tags
  if (k.includes("melatonin-free") || k.includes("no hormone")) {
    tags["Values"].push("Non-Hormonal")
  }
  if (k.includes("organic") || k.includes("natural") || k.includes("non-gmo") || k.includes("vegan")) {
    tags["Values"].push("Natural")
  }

  // Behavior tags
  if (k.includes("bedtime ritual") || k.includes("nighttime routine") || k.includes("calming ritual")) {
    tags["Behavior"].push("Ritual-Based")
  }
  if (k.includes("multi-ingredient") || k.includes("complex blend") || k.includes("stacked formula")) {
    tags["Behavior"].push("Stacked Formula")
  }

  return tags
}

// Function to calculate opportunity score
export function calculateOpportunityScore(volume: number, growth: number, competition: number): number {
  // Simple algorithm: (volume * growth) / competition
  // Normalized to a 0-100 scale
  const rawScore = (volume * growth) / competition
  return Math.min(100, Math.max(0, Math.round(rawScore)))
}

// Function to run clustering algorithm
export function runClustering(keywords: string[]): Record<string, string[]> {
  // This is a placeholder for a real clustering algorithm
  // In a real implementation, you would use a more sophisticated approach

  const clusters: Record<string, string[]> = {
    sleep_onset: [],
    sleep_maintenance: [],
    natural_sleep: [],
  }

  keywords.forEach((keyword) => {
    const k = keyword.toLowerCase()

    if (k.includes("fall asleep") || k.includes("fast") || k.includes("quick")) {
      clusters["sleep_onset"].push(keyword)
    } else if (k.includes("stay asleep") || k.includes("through the night") || k.includes("no wake")) {
      clusters["sleep_maintenance"].push(keyword)
    } else if (k.includes("natural") || k.includes("organic") || k.includes("herbal")) {
      clusters["natural_sleep"].push(keyword)
    } else {
      // Default to the first cluster if no match
      clusters["sleep_onset"].push(keyword)
    }
  })

  return clusters
}
