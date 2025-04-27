/**
 * Market Opportunity Analysis for Level 1
 * Provides functions for calculating opportunity scores and market signals
 */

import { Level1Data } from "../validation";

export interface NicheMetrics {
  name: string
  searchVolume: number
  growthRate: number
  numTopClickedProducts: number
  avgUnitsSold: number
  unitsSoldTotal: number
}

export interface ProcessedLevel1Data {
  customerNeed: string;
  topSearchTerms: string[];
  metrics: {
    searchVolume: number;
    searchVolumeGrowth: number;
    searchVolume90d: number;
    searchVolumeGrowth90d: number;
    unitsSold: number;
    avgUnitsSold: number;
    numTopClickedProducts: number;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    returnRate: number;
  };
  scores: {
    opportunity: number;
    emergence: number;
    seasonality: number;
  };
  flags: {
    isEmerging: boolean;
    isSeasonal: boolean;
  };
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
 * Process raw level 1 data into structured format with scoring
 * @param data Raw level 1 data from CSV or API
 * @returns Processed data with metrics and scoring
 */
export function processLevel1Data(data: any[]): ProcessedLevel1Data[] {
  console.log("Starting processLevel1Data with", data.length, "records");
  // Debug the data to understand its structure
  if (data.length > 0) {
    console.log("Sample record keys:", Object.keys(data[0]));
  }

  try {
    return data.map((item) => {
      // Get the customer need (different possible field names)
      const customerNeed = 
        item.Customer_Need || 
        item.CustomerNeed || 
        item.customer_need || 
        item["Customer Need"] || 
        "Unknown";
      
      // Extract search volume with fallbacks for different field names
      const searchVolume = getNumberValue(
        item.Search_Volume || 
        item.SearchVolume || 
        item["Search Volume"] ||
        item["Search Volume (Past 360 days)"]
      );
      
      // Extract search volume growth with fallbacks
      const searchVolumeGrowth = getNumberValue(
        item.Search_Volume_Growth_180 || 
        item.SearchVolumeGrowth || 
        item["Search Volume Growth"] ||
        item["Search Volume Growth (Past 180 days)"]
      ) / 100; // Convert from percentage to decimal if needed
      
      // Extract 90-day metrics with fallbacks
      const searchVolume90d = getNumberValue(
        item.Search_Volume_90 || 
        item["Search Volume (Past 90 days)"]
      );
      
      const searchVolumeGrowth90d = getNumberValue(
        item.Search_Volume_Growth_90 || 
        item["Search Volume Growth (Past 90 days)"]
      ) / 100; // Convert from percentage to decimal if needed
      
      // Extract units sold data with fallbacks
      let unitsSold = 0;
      if (item.Units_Sold !== undefined) {
        unitsSold = getNumberValue(item.Units_Sold);
      } else if (item.Units_Sold_Lower !== undefined && item.Units_Sold_Upper !== undefined) {
        const lower = getNumberValue(item.Units_Sold_Lower);
        const upper = getNumberValue(item.Units_Sold_Upper);
        unitsSold = (lower + upper) / 2; // Use the average
      } else if (item["Units Sold Lower Bound (Past 360 days)"] !== undefined && 
                 item["Units Sold Upper Bound (Past 360 days)"] !== undefined) {
        const lower = getNumberValue(item["Units Sold Lower Bound (Past 360 days)"]);
        const upper = getNumberValue(item["Units Sold Upper Bound (Past 360 days)"]);
        unitsSold = (lower + upper) / 2;
      }
      
      // Number of top clicked products
      const numTopClickedProducts = getNumberValue(
        item.Top_Clicked_Products || 
        item.TopClickedProducts || 
        item["# of Top Clicked Products"] || 
        0
      );
      
      // Average units sold
      const avgUnitsSold = unitsSold / Math.max(1, numTopClickedProducts);
      
      // Extract price data
      const averagePrice = getNumberValue(item.Average_Price || item.AveragePrice || 0);
      const minPrice = getNumberValue(item.Min_Price || item.MinPrice || 0);
      const maxPrice = getNumberValue(item.Max_Price || item.MaxPrice || 0);
      
      // Get return rate if available
      const returnRate = getNumberValue(item.Return_Rate || item.ReturnRate || 0) / 100;
      
      // Get top search terms (different possible field naming patterns)
      const topSearchTerms = [];
      for (let i = 1; i <= 3; i++) {
        const term = 
          item[`Top_Search_Term_${i}`] || 
          item[`TopSearchTerm${i}`] || 
          item[`Top Search Term ${i}`];
        if (term) topSearchTerms.push(term);
      }
      
      // Calculate scores
      const opportunityScore = calculateOpportunityScore(
      searchVolume,
        searchVolumeGrowth, 
        unitsSold, 
        numTopClickedProducts
      );
      
      const emergenceScore = calculateEmergenceScore(searchVolumeGrowth, searchVolumeGrowth90d);
      const seasonalityScore = calculateSeasonalityScore(searchVolume, searchVolume90d);
      
      // Determine flags
      const isEmerging = emergenceScore > 70;
      const isSeasonal = seasonalityScore > 70;
    
    return {
        customerNeed,
        topSearchTerms,
      metrics: {
        searchVolume,
        searchVolumeGrowth,
        searchVolume90d,
        searchVolumeGrowth90d,
          unitsSold,
        avgUnitsSold,
        numTopClickedProducts,
          averagePrice,
          minPrice,
          maxPrice,
          returnRate
      },
      scores: {
        opportunity: opportunityScore,
        emergence: emergenceScore,
        seasonality: seasonalityScore
      },
      flags: {
          isEmerging,
          isSeasonal
        }
      };
    });
  } catch (error) {
    console.error("Error in processLevel1Data:", error);
    throw error;
  }
}

/**
 * Helper to extract a number value safely from potentially non-numeric data
 */
function getNumberValue(value: any): number {
  if (value === undefined || value === null) return 0;
  
  // Handle string percentage values (e.g., "45%")
  if (typeof value === 'string' && value.endsWith('%')) {
    const numValue = parseFloat(value.replace('%', ''));
    return isNaN(numValue) ? 0 : numValue;
  }
  
  // Handle string number values or already numeric values
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(numValue) ? 0 : numValue;
}

/**
 * Calculate opportunity score based on key metrics
 */
function calculateOpportunityScore(
  searchVolume: number,
  searchVolumeGrowth: number,
  unitsSold: number,
  numTopClickedProducts: number
): number {
  // Normalize inputs to 0-100 scale
  const volumeScore = Math.min(100, searchVolume / 10000);
  const growthScore = Math.min(100, (searchVolumeGrowth * 100) * 2); // Double weight for growth
  
  // Calculate competition score (inverse of top clicked products)
  // Fewer competing products = higher score
  const competitionScore = Math.max(0, 100 - Math.min(100, numTopClickedProducts * 5));
  
  // Calculate demand score based on units sold
  const demandScore = Math.min(100, unitsSold / 1000);
  
  // Weighted average of all scores
  const weightedScore = (
    (volumeScore * 0.3) +
    (growthScore * 0.4) +
    (competitionScore * 0.2) +
    (demandScore * 0.1)
  );
  
  return Math.round(weightedScore);
}

/**
 * Calculate emergence score based on growth patterns
 */
function calculateEmergenceScore(overallGrowth: number, recentGrowth: number): number {
  // If recent growth is higher than overall, it's more likely to be emerging
  if (recentGrowth > overallGrowth && recentGrowth > 0.1) {
    // Convert growth to percentage for scoring
    const recentGrowthPct = recentGrowth * 100;
    return Math.min(100, Math.round(recentGrowthPct * 1.5));
  }
  
  // Basic emergence score based on overall growth
  const baseScore = Math.min(100, Math.round((overallGrowth * 100) * 1.2));
  return baseScore;
}

/**
 * Calculate seasonality score based on volume patterns
 */
function calculateSeasonalityScore(overallVolume: number, recentVolume: number): number {
  if (overallVolume === 0) return 0;
  
  // Calculate ratio of recent to overall volume
  const ratio = recentVolume / overallVolume;
  
  // If recent volume is significantly different from overall, might be seasonal
  if (ratio > 1.3 || ratio < 0.7) {
    const deviation = Math.abs(1 - ratio);
    return Math.min(100, Math.round(deviation * 150));
  }
  
  return 0;
} 