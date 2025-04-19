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
    'Search Volume Growth': 'search_volume_growth',
    'Click Share': 'click_share',
    'Search Conversion Rate': 'conversion_rate',
    'Top Clicked Product 1 (Title)': 'top_clicked_product_1_title',
    'Top Clicked Product 1 (Asin)': 'top_clicked_product_1_asin',
    'Top Clicked Product 2 (Title)': 'top_clicked_product_2_title',
    'Top Clicked Product 2 (Asin)': 'top_clicked_product_2_asin',
    'Top Clicked Product 3 (Title)': 'top_clicked_product_3_title',
    'Top Clicked Product 3 (Asin)': 'top_clicked_product_3_asin',
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
  const originalHeader = header.trim();
  const cleanedHeader = cleanHeaderText(originalHeader);

  // Check for direct mapping if data level is provided
  if (dataLevel && HEADER_MAPPINGS[dataLevel]) {
    const directMapping = HEADER_MAPPINGS[dataLevel][originalHeader];
    if (directMapping) {
      return directMapping;
    }
  }

  // Try to find a match in any of the mappings
  for (const levelMappings of Object.values(HEADER_MAPPINGS)) {
    const mapping = levelMappings[originalHeader];
    if (mapping) {
      return mapping;
    }
  }

  // If no direct mapping found, convert to snake_case
  return cleanedHeader
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '')      // Remove leading/trailing underscores
    .replace(/_+/g, '_');         // Collapse multiple underscores
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