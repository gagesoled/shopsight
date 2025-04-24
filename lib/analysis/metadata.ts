export interface MetadataAnalysis {
  patterns?: {
    functionPatterns: Array<{
      pattern: string;
      confidence: number;
      terms: string[];
    }>;
    formatPatterns: Array<{
      pattern: string;
      confidence: number;
      terms: string[];
    }>;
    valuePatterns: Array<{
      pattern: string;
      confidence: number;
      terms: string[];
    }>;
  };
  relationships?: {
    functionFormatPairs: Array<{
      function: string;
      format: string;
      confidence: number;
      terms: string[];
    }>;
    functionValuePairs: Array<{
      function: string;
      value: string;
      confidence: number;
      terms: string[];
    }>;
    formatValuePairs: Array<{
      format: string;
      value: string;
      confidence: number;
      terms: string[];
    }>;
  };
  insights?: Array<{
    type: string;
    description: string;
    confidence: number;
    supportingTerms: string[];
  }>;
  volume?: number;
  growth?: number;
  competition?: number;
  values?: number;
  terms?: string[];
  Values_Inferred?: string;
  Competition?: number;
} 