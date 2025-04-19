import { normalizeHeader, normalizeHeaders } from '../header-normalizer';

describe('Header Normalization', () => {
  describe('normalizeHeader', () => {
    it('should remove content in parentheses', () => {
      expect(normalizeHeader('Search Volume (Past 360 days)')).toBe('search_volume');
      expect(normalizeHeader('Growth (Past 180 days)')).toBe('growth');
    });

    it('should remove content in brackets', () => {
      expect(normalizeHeader('Search Volume [USD]')).toBe('search_volume');
      expect(normalizeHeader('Growth [%]')).toBe('growth');
    });

    it('should remove content in braces', () => {
      expect(normalizeHeader('Search Volume {USD}')).toBe('search_volume');
      expect(normalizeHeader('Growth {%}')).toBe('growth');
    });

    it('should remove USD suffix', () => {
      expect(normalizeHeader('Search Volume USD')).toBe('search_volume');
      expect(normalizeHeader('Price USD')).toBe('price');
    });

    it('should remove % suffix', () => {
      expect(normalizeHeader('Growth %')).toBe('growth');
      expect(normalizeHeader('Click Share %')).toBe('click_share');
    });

    it('should standardize time periods', () => {
      expect(normalizeHeader('Search Volume Past 360 days')).toBe('search_volume_360d');
      expect(normalizeHeader('Growth Past 180 days')).toBe('growth_180d');
      expect(normalizeHeader('Growth Past 90 days')).toBe('growth_90d');
      expect(normalizeHeader('Growth Past 30 days')).toBe('growth_30d');
      expect(normalizeHeader('Growth Past 7 days')).toBe('growth_7d');
    });

    it('should handle special mappings for Level1 data', () => {
      expect(normalizeHeader('Customer Need', 'Level1')).toBe('customer_need');
      expect(normalizeHeader('Search Volume', 'Level1')).toBe('search_volume');
      expect(normalizeHeader('Search Volume Growth', 'Level1')).toBe('search_volume_growth');
    });

    it('should handle special mappings for Level2SearchTerms data', () => {
      expect(normalizeHeader('Search Term', 'Level2SearchTerms')).toBe('search_term');
      expect(normalizeHeader('Click Share', 'Level2SearchTerms')).toBe('click_share');
      expect(normalizeHeader('Search Conversion Rate', 'Level2SearchTerms')).toBe('conversion_rate');
    });

    it('should handle special mappings for Level2Products data', () => {
      expect(normalizeHeader('Product Name', 'Level2Products')).toBe('product_name');
      expect(normalizeHeader('ASIN', 'Level2Products')).toBe('asin');
      expect(normalizeHeader('Brand', 'Level2Products')).toBe('brand');
    });

    it('should handle special mappings for Level3 data', () => {
      expect(normalizeHeader('Keyword Phrase', 'Level3')).toBe('keyword_phrase');
      expect(normalizeHeader('ABA Total Click Share', 'Level3')).toBe('aba_click_share');
      expect(normalizeHeader('ABA Total Conv. Share', 'Level3')).toBe('aba_conversion_share');
    });

    it('should convert to snake_case when no special mapping exists', () => {
      expect(normalizeHeader('Some Random Header')).toBe('some_random_header');
      expect(normalizeHeader('Another Header With Numbers 123')).toBe('another_header_with_numbers_123');
    });
  });

  describe('normalizeHeaders', () => {
    it('should normalize an array of headers', () => {
      const headers = [
        'Search Volume (Past 360 days)',
        'Growth [%]',
        'Customer Need',
        'Some Random Header'
      ];
      
      const expected = [
        'search_volume',
        'growth',
        'customer_need',
        'some_random_header'
      ];

      expect(normalizeHeaders(headers)).toEqual(expected);
    });

    it('should normalize headers with data level', () => {
      const headers = [
        'Search Term',
        'Search Volume',
        'Click Share',
        'Search Conversion Rate'
      ];
      
      const expected = [
        'search_term',
        'search_volume',
        'click_share',
        'conversion_rate'
      ];

      expect(normalizeHeaders(headers, 'Level2SearchTerms')).toEqual(expected);
    });
  });
}); 