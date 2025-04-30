import { Level2ProductData } from "@/lib/types";

interface ProductCluster {
  id: string;
  name: string;
  description: string;
  opportunityScore: number;
  searchVolume: number;
  clickShare: number;
  keywords: string[];
  tags: {
    category: string;
    value: string;
  }[];
}

function extractProductAttributes(products: Level2ProductData[]): Map<string, Set<string>> {
  const attributes = new Map<string, Set<string>>();
  
  products.forEach(product => {
    // Extract brand
    if (product.Brand) {
      if (!attributes.has('Brand')) {
        attributes.set('Brand', new Set());
      }
      attributes.get('Brand')!.add(product.Brand);
    }

    // Extract category
    if (product.category) {
      if (!attributes.has('Category')) {
        attributes.set('Category', new Set());
      }
      attributes.get('Category')!.add(product.category);
    }

    // Extract format/type from product name
    const productName = product.Product_Name?.toLowerCase() || '';
    const formats = ['seasoned', 'original', 'honey mustard', 'southwest', 'cinnamon sugar', 'parmesan garlic', 'bbq'];
    formats.forEach(format => {
      if (productName.includes(format)) {
        if (!attributes.has('Format')) {
          attributes.set('Format', new Set());
        }
        attributes.get('Format')!.add(format.charAt(0).toUpperCase() + format.slice(1));
      }
    });

    // Extract package types
    const packageTypes = ['individual bags', 'variety pack', 'family-size', 'grocery sized'];
    packageTypes.forEach(type => {
      if (productName.includes(type.toLowerCase())) {
        if (!attributes.has('Package')) {
          attributes.set('Package', new Set());
        }
        attributes.get('Package')!.add(type.charAt(0).toUpperCase() + type.slice(1));
      }
    });
  });

  return attributes;
}

function calculateClusterMetrics(products: Level2ProductData[]): { searchVolume: number; clickShare: number; opportunityScore: number } {
  const totalVolume = products.reduce((sum, p) => sum + (p.Niche_Click_Count || 0), 0);
  const weightedClickShare = products.reduce((sum, p) => sum + ((p.Click_Share || 0) * (p.Niche_Click_Count || 0)), 0) / totalVolume;
  
  // Calculate opportunity score based on volume, ratings, and competition
  const avgRating = products.reduce((sum, p) => sum + (p.Average_Customer_Rating || 0), 0) / products.length;
  const avgBSR = products.reduce((sum, p) => sum + (p.Average_BSR || 0), 0) / products.length;
  
  // Normalize BSR to 0-1 scale (lower is better)
  const normalizedBSR = Math.max(0, Math.min(1, 1 - (avgBSR / 100000)));
  
  const opportunityScore = Math.round(
    (totalVolume / 10000) * // Volume factor
    (avgRating / 5) * // Rating factor
    normalizedBSR * // Competition factor
    100 // Scale to 0-100
  );

  return {
    searchVolume: totalVolume,
    clickShare: weightedClickShare,
    opportunityScore: Math.min(100, opportunityScore)
  };
}

function getTopProducts(products: Level2ProductData[], limit: number = 5): string[] {
  return products
    .sort((a, b) => {
      // Sort by click share first
      const clickShareDiff = (b.Click_Share || 0) - (a.Click_Share || 0);
      if (clickShareDiff !== 0) return clickShareDiff;
      
      // Then by rating
      const ratingDiff = (b.Average_Customer_Rating || 0) - (a.Average_Customer_Rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      
      // Finally by number of ratings
      return (b.total_ratings || 0) - (a.total_ratings || 0);
    })
    .slice(0, limit)
    .map(p => p.Product_Name || '')
    .filter(name => name !== '');
}

export function createProductClusters(products: Level2ProductData[]): ProductCluster[] {
  if (!products || products.length === 0) {
    return [];
  }

  const clusters: ProductCluster[] = [];
  const attributes = extractProductAttributes(products);

  // Create clusters based on formats
  if (attributes.has('Format')) {
    attributes.get('Format')!.forEach(format => {
      const formatProducts = products.filter(p => 
        p.Product_Name?.toLowerCase().includes(format.toLowerCase())
      );

      if (formatProducts.length > 0) {
        const metrics = calculateClusterMetrics(formatProducts);
        const topProducts = getTopProducts(formatProducts);

        clusters.push({
          id: format.toLowerCase().replace(/\s+/g, '_'),
          name: `${format} Pretzels`,
          description: `Products featuring ${format.toLowerCase()} flavoring`,
          opportunityScore: metrics.opportunityScore,
          searchVolume: metrics.searchVolume,
          clickShare: metrics.clickShare,
          keywords: topProducts,
          tags: [
            { category: 'Format', value: format },
            { category: 'Function', value: 'Snack' },
            { category: 'Values', value: 'Variety' }
          ]
        });
      }
    });
  }

  // Create clusters based on package types
  if (attributes.has('Package')) {
    attributes.get('Package')!.forEach(packageType => {
      const packageProducts = products.filter(p => 
        p.Product_Name?.toLowerCase().includes(packageType.toLowerCase())
      );

      if (packageProducts.length > 0) {
        const metrics = calculateClusterMetrics(packageProducts);
        const topProducts = getTopProducts(packageProducts);

        clusters.push({
          id: packageType.toLowerCase().replace(/\s+/g, '_'),
          name: `${packageType} Pretzels`,
          description: `Products in ${packageType.toLowerCase()} format`,
          opportunityScore: metrics.opportunityScore,
          searchVolume: metrics.searchVolume,
          clickShare: metrics.clickShare,
          keywords: topProducts,
          tags: [
            { category: 'Package', value: packageType },
            { category: 'Function', value: 'Snack' },
            { category: 'Behavior', value: 'Brand Preference' }
          ]
        });
      }
    });
  }

  // If no clusters were created, create a generic one
  if (clusters.length === 0) {
    const metrics = calculateClusterMetrics(products);
    const topProducts = getTopProducts(products);

    clusters.push({
      id: 'all_products',
      name: 'All Pretzel Products',
      description: 'Collection of all pretzel products in the dataset',
      opportunityScore: metrics.opportunityScore,
      searchVolume: metrics.searchVolume,
      clickShare: metrics.clickShare,
      keywords: topProducts,
      tags: [
        { category: 'Function', value: 'Snack' },
        { category: 'Values', value: 'Variety' }
      ]
    });
  }

  return clusters;
} 