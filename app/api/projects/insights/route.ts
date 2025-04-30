import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { 
  ClusterResult,
  ProductClusterResult,
  OpportunityResult,
  CompetitionResult,
  TrendAnalysis
} from "@/lib/types";

// Define the request body schema
const InsightsRequestSchema = z.object({
  project_id: z.string().uuid(),
  searchTermClusters: z.array(z.any()),
  productClusters: z.array(z.any()),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Request body:", body);

    // Validate the request body
    const validation = InsightsRequestSchema.safeParse(body);
    if (!validation.success) {
      console.error("Validation failed:", validation.error.format());
      return NextResponse.json({ 
        success: false, 
        message: "Invalid input data", 
        errors: validation.error.format() 
      }, { status: 400 });
    }

    const { project_id, searchTermClusters, productClusters } = validation.data;

    // Generate market opportunities
    const opportunities = generateMarketOpportunities(searchTermClusters, productClusters);

    // Generate competition analysis
    const competition = generateCompetitionAnalysis(productClusters);

    // Generate trend analysis
    const trends = generateTrendAnalysis(searchTermClusters, productClusters);

    // Check if supabaseAdmin is initialized
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error" 
      }, { status: 500 });
    }

    // Store the results in the analysis_results table
    const { error: storeError } = await supabaseAdmin
      .from('analysis_results')
      .upsert({
        project_id,
        type: 'combined_insights',
        results: {
          marketOpportunities: opportunities,
          competitionAnalysis: competition,
          trends: trends,
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project_id,type'
      });

    if (storeError) {
      console.error("Error storing insights results:", storeError);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to store insights results", 
        error: storeError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Insights analysis completed successfully", 
      data: {
        marketOpportunities: opportunities,
        competitionAnalysis: competition,
        trends: trends,
      }
    });

  } catch (error) {
    console.error("Error in insights analysis:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to perform insights analysis", 
      error: message 
    }, { status: 500 });
  }
}

// Helper function to generate market opportunities
function generateMarketOpportunities(
  searchTermClusters: ClusterResult[],
  productClusters: ProductClusterResult[]
): OpportunityResult[] {
  const opportunities: OpportunityResult[] = [];

  // Analyze each search term cluster for opportunities
  searchTermClusters.forEach(cluster => {
    // Find related product clusters
    const relatedProducts = productClusters.filter(productCluster => {
      // Check if any product in the cluster matches the search terms
      return productCluster.products.some(product => 
        cluster.keywords.some(keyword => 
          product.Product_Name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    });

    if (relatedProducts.length > 0) {
      // Calculate opportunity metrics
      const avgProductPrice = relatedProducts.reduce((sum, p) => sum + p.metrics.averagePrice, 0) / relatedProducts.length;
      const avgProductRating = relatedProducts.reduce((sum, p) => sum + p.metrics.averageRating, 0) / relatedProducts.length;
      const totalMarketShare = relatedProducts.reduce((sum, p) => sum + p.metrics.marketShare, 0);

      // Calculate opportunity score
      const opportunityScore = calculateOpportunityScore(
        cluster.searchVolume,
        cluster.clickShare,
        avgProductPrice,
        avgProductRating,
        totalMarketShare
      );

      // Only include high-opportunity clusters
      if (opportunityScore > 70) {
        opportunities.push({
          id: uuidv4(),
          title: `Opportunity in ${cluster.name}`,
          description: generateOpportunityDescription(cluster, relatedProducts),
          opportunityScore,
          supportingData: {
            searchTerms: cluster.keywords,
            products: relatedProducts.map(p => p.products.map(prod => prod.Product_Name)).flat(),
            metrics: {
              searchVolume: cluster.searchVolume,
              competition: totalMarketShare,
              growth: cluster.tags.find(t => t.category === 'Growth')?.value === 'High' ? 0.2 : 0.1,
            }
          }
        });
      }
    }
  });

  return opportunities;
}

// Helper function to generate competition analysis
function generateCompetitionAnalysis(productClusters: ProductClusterResult[]): CompetitionResult[] {
  const competition: CompetitionResult[] = [];

  // Analyze each product cluster for competition
  productClusters.forEach(cluster => {
    // Group products by brand
    const brandGroups = cluster.products.reduce((acc, product) => {
      if (!product.Brand) return acc;
      if (!acc[product.Brand]) {
        acc[product.Brand] = [];
      }
      acc[product.Brand].push(product);
      return acc;
    }, {} as Record<string, typeof cluster.products>);

    // Calculate brand metrics
    const competitors = Object.entries(brandGroups).map(([brand, products]) => {
      const marketShare = products.reduce((sum, p) => sum + (p.Market_Share || 0), 0);
      const avgRating = products.reduce((sum, p) => sum + (p.Rating || 0), 0) / products.length;
      const avgPrice = products.reduce((sum, p) => sum + (p.Price || 0), 0) / products.length;

      return {
        name: brand,
        marketShare,
        strengths: [
          avgRating > 4 ? 'High Customer Satisfaction' : null,
          marketShare > 0.3 ? 'Strong Market Presence' : null,
          avgPrice < cluster.metrics.averagePrice ? 'Competitive Pricing' : null,
        ].filter(Boolean) as string[],
        weaknesses: [
          avgRating < 3.5 ? 'Low Customer Satisfaction' : null,
          marketShare < 0.1 ? 'Weak Market Presence' : null,
          avgPrice > cluster.metrics.averagePrice * 1.2 ? 'Premium Pricing' : null,
        ].filter(Boolean) as string[],
      };
    });

    if (competitors.length > 0) {
      competition.push({
        id: uuidv4(),
        title: `Competition in ${cluster.name}`,
        description: generateCompetitionDescription(cluster, competitors),
        competitors: competitors.sort((a, b) => b.marketShare - a.marketShare),
      });
    }
  });

  return competition;
}

// Helper function to generate trend analysis
function generateTrendAnalysis(
  searchTermClusters: ClusterResult[],
  productClusters: ProductClusterResult[]
): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];

  // Analyze search term trends
  searchTermClusters.forEach(cluster => {
    const growthTag = cluster.tags.find(t => t.category === 'Growth');
    if (growthTag) {
      const trend = growthTag.value === 'High' ? 'up' : growthTag.value === 'Declining' ? 'down' : 'stable';
      const confidence = calculateTrendConfidence(cluster);

      if (confidence > 0.7) {
        trends.push({
          id: uuidv4(),
          title: `Trend in ${cluster.name}`,
          description: generateTrendDescription(cluster, trend),
          trend,
          confidence,
          supportingData: {
            searchTerms: cluster.keywords,
            products: productClusters
              .filter(pc => pc.products.some(p => 
                cluster.keywords.some(k => 
                  p.Product_Name.toLowerCase().includes(k.toLowerCase())
                )
              ))
              .map(pc => pc.products.map(p => p.Product_Name))
              .flat(),
            metrics: {
              growth: growthTag.value === 'High' ? 0.2 : growthTag.value === 'Declining' ? -0.1 : 0,
              volume: cluster.searchVolume,
            }
          }
        });
      }
    }
  });

  return trends;
}

// Helper function to calculate opportunity score
function calculateOpportunityScore(
  searchVolume: number,
  clickShare: number,
  avgProductPrice: number,
  avgProductRating: number,
  totalMarketShare: number
): number {
  // Normalize and weight factors
  const volumeScore = Math.min(searchVolume / 10000, 1) * 0.3;
  const clickShareScore = (1 - clickShare) * 0.2;
  const priceScore = (avgProductPrice > 0 ? Math.min(avgProductPrice / 100, 1) : 0) * 0.2;
  const ratingScore = (avgProductRating / 5) * 0.15;
  const marketShareScore = (1 - totalMarketShare) * 0.15;

  return (volumeScore + clickShareScore + priceScore + ratingScore + marketShareScore) * 100;
}

// Helper function to calculate trend confidence
function calculateTrendConfidence(cluster: ClusterResult): number {
  const volumeWeight = Math.min(cluster.searchVolume / 10000, 1);
  const growthWeight = cluster.tags.find(t => t.category === 'Growth')?.value === 'High' ? 1 : 0.5;
  const clickShareWeight = 1 - cluster.clickShare;

  return (volumeWeight * 0.4 + growthWeight * 0.4 + clickShareWeight * 0.2);
}

// Helper function to generate opportunity description
function generateOpportunityDescription(
  cluster: ClusterResult,
  relatedProducts: ProductClusterResult[]
): string {
  const avgPrice = relatedProducts.reduce((sum, p) => sum + p.metrics.averagePrice, 0) / relatedProducts.length;
  const avgRating = relatedProducts.reduce((sum, p) => sum + p.metrics.averageRating, 0) / relatedProducts.length;
  const totalMarketShare = relatedProducts.reduce((sum, p) => sum + p.metrics.marketShare, 0);

  return `High-potential opportunity in ${cluster.name} with ${cluster.searchVolume.toLocaleString()} monthly searches. ` +
    `Current products average $${avgPrice.toFixed(2)} with ${avgRating.toFixed(1)} star ratings. ` +
    `Market share is ${(totalMarketShare * 100).toFixed(1)}%, indicating room for growth.`;
}

// Helper function to generate competition description
function generateCompetitionDescription(
  cluster: ProductClusterResult,
  competitors: { name: string; marketShare: number; strengths: string[]; weaknesses: string[] }[]
): string {
  const topCompetitor = competitors[0];
  const totalMarketShare = competitors.reduce((sum, c) => sum + c.marketShare, 0);

  return `Analysis of ${competitors.length} competitors in ${cluster.name}. ` +
    `Top competitor ${topCompetitor.name} holds ${(topCompetitor.marketShare * 100).toFixed(1)}% market share. ` +
    `Total market concentration is ${(totalMarketShare * 100).toFixed(1)}%.`;
}

// Helper function to generate trend description
function generateTrendDescription(cluster: ClusterResult, trend: 'up' | 'down' | 'stable'): string {
  const trendDirection = trend === 'up' ? 'growing' : trend === 'down' ? 'declining' : 'stable';
  const volume = cluster.searchVolume.toLocaleString();

  return `Search interest in ${cluster.name} is ${trendDirection} with ${volume} monthly searches. ` +
    `Click share is ${(cluster.clickShare * 100).toFixed(1)}%, indicating ${trend === 'up' ? 'increasing' : 'decreasing'} competition.`;
} 