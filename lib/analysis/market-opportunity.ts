/**
 * Market Opportunity Analysis for Level 1
 * Provides functions for calculating opportunity scores and market signals
 */

export interface NicheMetrics {
  name: string
  searchVolume: number
  growthRate: number
  numTopClickedProducts: number
  avgUnitsSold: number
  unitsSoldTotal: number
}

/**
 * Calculates a refined opportunity score based on the following formula:
 * Opportunity Score = (Search Volume × Growth Rate × # of Top Clicked Products)
 * With normalization to prevent distortion from extreme values
 */
export function calculateRefinedOpportunityScore(metrics: NicheMetrics): number {
  const { searchVolume, growthRate, numTopClickedProducts } = metrics
  
  // Normalize inputs using log scaling for volume to prevent distortion
  const normalizedVolume = Math.log10(Math.max(10, searchVolume)) / 6 // Log10 scale capped at 1,000,000
  const normalizedGrowth = Math.min(1, Math.max(0, (growthRate + 0.5) / 1.5)) // Convert -50% to 100% range to 0-1
  const normalizedProducts = Math.min(1, numTopClickedProducts / 50) // Cap at 50 products
  
  // Calculate weighted score with normalization to 0-100 scale
  const rawScore = normalizedVolume * normalizedGrowth * normalizedProducts * 100
  return Math.round(Math.min(100, Math.max(0, rawScore)))
}

/**
 * Determines if a niche is emerging based on high recent growth combined with low search volume
 * Returns a 0-1 score representing emergence strength
 */
export function calculateEmergenceFlag(
  searchVolume: number, 
  growth90d: number,
  growth180d: number
): number {
  // Emerging niches have high recent growth but may not have high volume yet
  if (searchVolume > 500000) return 0 // Already established
  
  // Calculate emergence as a function of growth and inverse volume
  const volumeFactor = Math.max(0, 1 - (searchVolume / 500000))
  const growthFactor = Math.max(0, Math.min(1, growth90d / 2)) // Cap at 200% growth
  
  // Acceleration indicates higher emergence (90d growth > 180d growth)
  const accelerationFactor = growth90d > growth180d ? 1.2 : 1
  
  const emergenceScore = volumeFactor * growthFactor * accelerationFactor
  return Math.min(1, emergenceScore)
}

/**
 * Calculates a seasonality index (0-1) to identify seasonal vs. behavioral patterns
 * High score indicates strong seasonal pattern
 */
export function calculateSeasonalityIndex(
  growth90d: number,
  growth180d: number,
  volume90d: number,
  totalVolume: number
): number {
  // Check for sharp 90-day spikes that don't appear in the 180-day window
  const spikeDetection = Math.max(0, growth90d - growth180d)
  
  // Check volume concentration in recent period
  const recentConcentration = Math.min(1, (volume90d / totalVolume) * 4) // Scaled to flag 25%+ in 90d
  
  // Combine metrics (customizable weights)
  const seasonalityScore = (spikeDetection * 0.7) + (recentConcentration * 0.3)
  return Math.min(1, seasonalityScore)
}

/**
 * Processes raw Level 1 CSV data and returns a structured dataset with calculated metrics
 */
export function processLevel1Data(rawData: any[]): any[] {
  if (!rawData || rawData.length === 0) return []
  
  return rawData.map(item => {
    // Extract metrics from raw data
    const searchVolume = Number(item["Search Volume (Past 360 days)"]) || 0
    const searchVolumeGrowth = Number(item["Search Volume Growth (Past 180 days)"]) || 0
    const searchVolume90d = Number(item["Search Volume (Past 90 days)"]) || 0
    const searchVolumeGrowth90d = Number(item["Search Volume Growth (Past 90 days)"]) || 0
    const unitsSoldLowerBound = Number(item["Units Sold Lower Bound (Past 360 days)"]) || 0
    const unitsSoldUpperBound = Number(item["Units Sold Upper Bound (Past 360 days)"]) || 0
    const unitsSoldAvgLower = Number(item["Range of Average Units Sold Lower Bound (Past 360 days)"]) || 0
    const unitsSoldAvgUpper = Number(item["Range of Average Units Sold Upper Bound (Past 360 days)"]) || 0
    const numTopClickedProducts = Number(item["# of Top Clicked Products"]) || 0
    
    // Calculate average metrics when ranges are provided
    const avgUnitsSold = (unitsSoldAvgLower + unitsSoldAvgUpper) / 2
    const totalUnitsSold = (unitsSoldLowerBound + unitsSoldUpperBound) / 2
    
    // Calculate emergence and seasonality signals
    const emergenceScore = calculateEmergenceFlag(
      searchVolume,
      searchVolumeGrowth90d,
      searchVolumeGrowth
    )
    
    const seasonalityScore = calculateSeasonalityIndex(
      searchVolumeGrowth90d,
      searchVolumeGrowth,
      searchVolume90d,
      searchVolume
    )
    
    // Calculate opportunity score
    const opportunityScore = calculateRefinedOpportunityScore({
      name: item["Customer Need"],
      searchVolume,
      growthRate: searchVolumeGrowth,
      numTopClickedProducts,
      avgUnitsSold,
      unitsSoldTotal: totalUnitsSold
    })
    
    return {
      customerNeed: item["Customer Need"],
      topSearchTerms: [
        item["Top Search Term 1"],
        item["Top Search Term 2"],
        item["Top Search Term 3"]
      ].filter(Boolean),
      metrics: {
        searchVolume,
        searchVolumeGrowth,
        searchVolume90d,
        searchVolumeGrowth90d,
        unitsSold: totalUnitsSold,
        avgUnitsSold,
        numTopClickedProducts,
        averagePrice: Number(item["Average Price (USD)"]) || 0,
        minPrice: Number(item["Minimum Price (Past 360 days) (USD)"]) || 0,
        maxPrice: Number(item["Maximum Price (Past 360 days) (USD)"]) || 0,
        returnRate: Number(item["Return Rate (Past 360 days)"]) || 0
      },
      scores: {
        opportunity: opportunityScore,
        emergence: emergenceScore,
        seasonality: seasonalityScore
      },
      flags: {
        isEmerging: emergenceScore > 0.6,
        isSeasonal: seasonalityScore > 0.7
      }
    }
  }).sort((a, b) => b.scores.opportunity - a.scores.opportunity)
} 