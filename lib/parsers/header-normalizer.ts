/**
 * Header normalizer for CSV and Excel files
 * Handles normalization of headers across all data levels
 */

// Common patterns to remove from headers
const PATTERNS_TO_REMOVE = [
  /\s*\(.*?\)/g, // Remove content in parentheses
  /\s*\[.*?\]/g, // Remove content in brackets
  /\s*\{.*?\}/g, // Remove content in braces
  /\s*USD$/i,    // Remove USD suffix
  /\s*%$/i,      // Remove % suffix
  /\s*\(USD\)$/i, // Remove (USD) suffix
  /\s*\(%\)$/i,  // Remove (%) suffix
];

// Common time periods to standardize
const TIME_PERIODS = {
  'Past 360 days': '360d',
  'Past 180 days': '180d',
  'Past 90 days': '90d',
  'Past 30 days': '30d',
  'Past 7 days': '7d',
};

// Header mappings for different data levels
const HEADER_MAPPINGS: Record<string, Record<string, string>> = {
  // Level 1 mappings
  'Level1': {
    'Customer Need': 'customer_need',
    'Search Volume': 'search_volume',
    'Search Volume Growth': 'search_volume_growth',
    'Units Sold Lower Bound': 'units_sold_lower',
    'Units Sold Upper Bound': 'units_sold_upper',
    'Range of Average Units Sold Lower Bound': 'avg_units_sold_lower',
    'Range of Average Units Sold Upper Bound': 'avg_units_sold_upper',
    '# of Top Clicked Products': 'top_clicked_products_count',
    'Average Price': 'avg_price',
    'Minimum Price': 'min_price',
    'Maximum Price': 'max_price',
    'Return Rate': 'return_rate',
  },

  // Level 2 Search Terms mappings
  'Level2SearchTerms': {
    'Search Term': 'search_term',
    'Search Volume': 'search_volume',
    'Search Volume Growth (90d)': 'Growth_90',
    'Search Volume Growth (180d)': 'Growth_180',
    'Growth (90d)': 'Growth_90',
    'Growth (180d)': 'Growth_180',
    'Click Share': 'click_share',
    'Search Conversion Rate': 'search_conversion_rate',
    'Conversion Rate': 'search_conversion_rate',
    'Top Clicked Product 1 (Title)': 'Top_Clicked_Product_1_Title',
    'Top Clicked Product 1 (ASIN)': 'Top_Clicked_Product_1_ASIN',
    'Top Clicked Product 2 (Title)': 'Top_Clicked_Product_2_Title', 
    'Top Clicked Product 2 (ASIN)': 'Top_Clicked_Product_2_ASIN',
    'Top Clicked Product 3 (Title)': 'Top_Clicked_Product_3_Title',
    'Top Clicked Product 3 (ASIN)': 'Top_Clicked_Product_3_ASIN',
    'Format': 'Format_Inferred',
    'Function': 'Function_Inferred',
    'Values': 'Values_Inferred',
    'Competition': 'Competition',
  },

  // Level 2 Products mappings
  'Level2Products': {
    'Product Name': 'product_name',
    'ASIN': 'asin',
    'Brand': 'brand',
    'Category': 'category',
    'Launch Date': 'launch_date',
    'Niche Click Count': 'niche_click_count',
    'Click Share': 'click_share',
    'Average Selling Price': 'avg_selling_price',
    'Total Ratings': 'total_ratings',
    'Average Customer Rating': 'avg_customer_rating',
    'Average BSR': 'avg_bsr',
    'Average # of Sellers and Vendors': 'avg_sellers_count',
  },

  // Level 3 mappings
  'Level3': {
    'Keyword Phrase': 'keyword_phrase',
    'ABA Total Click Share': 'aba_click_share',
    'ABA Total Conv. Share': 'aba_conversion_share',
    'Keyword Sales': 'keyword_sales',
    'Search Volume': 'search_volume',
    'Search Volume Trend': 'search_volume_trend',
    'H10 PPC Sugg. Bid': 'ppc_suggested_bid',
    'H10 PPC Sugg. Min Bid': 'ppc_min_bid',
    'H10 PPC Sugg. Max Bid': 'ppc_max_bid',
    'Sponsored ASINs': 'sponsored_asins',
    'CPR': 'cpr',
    'Amazon Recommended': 'amazon_recommended',
    'Sponsored': 'sponsored',
    'Organic': 'organic',
    'Amazon Rec. Rank': 'amazon_rec_rank',
    'Sponsored Rank': 'sponsored_rank',
    'Organic Rank': 'organic_rank',
  },
};

/**
 * Clean a header string by removing common patterns and standardizing time periods
 */
function cleanHeaderText(header: string): string {
  let cleaned = header.trim();

  // Remove common patterns
  PATTERNS_TO_REMOVE.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Standardize time periods
  Object.entries(TIME_PERIODS).forEach(([period, standardized]) => {
    cleaned = cleaned.replace(period, standardized);
  });

  return cleaned;
}

/**
 * Normalize a header string to a consistent format
 * @param header The original header string
 * @param dataLevel Optional data level to use specific mappings
 * @returns Normalized header string
 */
export function normalizeHeader(header: string, dataLevel?: keyof typeof HEADER_MAPPINGS): string {
  const originalTrimmedHeader = header.trim(); // Use trimmed original for mapping keys

  // If dataLevel is provided and exists in HEADER_MAPPINGS, use those mappings
  if (dataLevel && HEADER_MAPPINGS[dataLevel]) {
    const levelMappings = HEADER_MAPPINGS[dataLevel];
    // Try direct match first
    if (levelMappings[originalTrimmedHeader]) {
        return levelMappings[originalTrimmedHeader];
    }
    // Try cleaned header match
    const cleanedHeader = cleanHeaderText(originalTrimmedHeader);
    if (levelMappings[cleanedHeader]) {
      return levelMappings[cleanedHeader];
    }
  }

  // Default normalization if no specific mapping found
  // Remove any content in parentheses first
  let normalized = originalTrimmedHeader.replace(/\([^)]*\)/g, '');

  // Convert to lowercase and trim
  normalized = normalized.toLowerCase().trim();
  
  // Handle specific cases for Level 2 search terms
  if (normalized.includes('180') && normalized.includes('growth')) {
    return 'Growth_180';
  }
  if (normalized.includes('90') && normalized.includes('growth')) {
    return 'Growth_90';
  }
  
  // Replace non-alphanumeric characters (except underscore) with underscore
  normalized = normalized.replace(/[^a-z0-9_]+/g, '_');

  // Collapse multiple underscores
  normalized = normalized.replace(/_+/g, '_');

  // Remove leading/trailing underscores
  normalized = normalized.replace(/^_+|_+$/g, '');

  // Fallback generic mapping (optional, can be expanded)
  const genericMappings: Record<string, string> = {
      'search_term': 'search_term',
      'search_volume': 'search_volume',
      'volume': 'search_volume',
      'click_share': 'click_share',
      'conversion_rate': 'search_conversion_rate', // Map generic to specific if common
      'asin': 'ASIN', // Maintain case for ASIN if needed by schema
      'keyword': 'Keyword', // Maintain case for Keyword if needed
      'format': 'Format_Inferred',
      'function': 'Function_Inferred',
      'values': 'Values_Inferred',
      'competition': 'Competition',
      'top_clicked_product_1_title': 'Top_Clicked_Product_1_Title',
      'top_clicked_product_1_asin': 'Top_Clicked_Product_1_ASIN',
      'top_clicked_product_2_title': 'Top_Clicked_Product_2_Title',
      'top_clicked_product_2_asin': 'Top_Clicked_Product_2_ASIN',
      'top_clicked_product_3_title': 'Top_Clicked_Product_3_Title',
      'top_clicked_product_3_asin': 'Top_Clicked_Product_3_ASIN'
  }

  return genericMappings[normalized] || normalized;
}

/**
 * Normalize an array of headers
 * @param headers Array of header strings
 * @param dataLevel Optional data level to use specific mappings
 * @returns Array of normalized header strings
 */
export function normalizeHeaders(headers: string[], dataLevel?: keyof typeof HEADER_MAPPINGS): string[] {
  return headers.map(header => normalizeHeader(header, dataLevel));
}

/**
 * Extract metadata from CSV content
 * @param content CSV content as string
 * @returns Object containing metadata and the index where actual data starts
 */
export function extractMetadata(content: string): { metadata: Record<string, string>; dataStartIndex: number } {
  const lines = content.split('\n');
  const metadata: Record<string, string> = {};
  let dataStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;

    // Check for metadata patterns
    if (line.includes('Niche Name:')) {
      metadata['niche_name'] = line.split('Niche Name:')[1].trim();
    } else if (line.includes('Last updated on')) {
      metadata['last_updated'] = line.split('Last updated on')[1].trim();
    } else if (line.includes('Niche Details -')) {
      metadata['details_tab'] = line.split('Niche Details -')[1].trim();
    } else {
      // If we find a line that doesn't match metadata patterns, 
      // it's likely the start of the actual data
      dataStartIndex = i;
      break;
    }
  }

  return { metadata, dataStartIndex };
} 