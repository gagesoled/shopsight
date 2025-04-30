import { OpenAI } from "openai";
import { Level2SearchTermData } from "@/lib/types";
import * as clustering from 'density-clustering';

interface SearchCluster {
  id: string;
  name: string;
  description: string;
  searchVolume: number;
  clickShare: number;
  opportunityScore: number;
  terms: string[];
  tags: {
    category: string;
    value: string;
  }[];
}

interface TermData {
  term: string;
  volume: number;
  growth: number;
  clickShare: number;
  embedding: number[];
}

function calculateClusterMetrics(terms: Level2SearchTermData[]): { searchVolume: number; clickShare: number; opportunityScore: number } {
  const totalVolume = terms.reduce((sum, term) => sum + (term.Volume || 0), 0);
  const weightedClickShare = terms.reduce((sum, term) => sum + ((term.Click_Share || 0) * (term.Volume || 0)), 0) / totalVolume;
  
  // Calculate opportunity score based on volume, growth, and competition
  const avgGrowth = terms.reduce((sum, term) => sum + (term.Growth_180 || term.Growth_90 || 0), 0) / terms.length;
  const avgClickShare = terms.reduce((sum, term) => sum + (term.Click_Share || 0), 0) / terms.length;
  
  const opportunityScore = Math.round(
    (Math.log10(totalVolume) / 5) * // Volume factor (log scale)
    (1 + avgGrowth) * // Growth factor
    (avgClickShare * 100) // Click share factor
  );

  return {
    searchVolume: totalVolume,
    clickShare: weightedClickShare,
    opportunityScore: Math.min(100, opportunityScore)
  };
}

function identifyClusterTheme(terms: string[]): { name: string; description: string; tags: { category: string; value: string }[] } {
  const termText = terms.join(' ').toLowerCase();
  
  // Define common patterns and their associated tags
  const patterns = [
    {
      name: 'Flavored Pretzels',
      keywords: ['flavored', 'seasoned', 'spiced'],
      description: 'Search terms related to flavored and seasoned pretzel varieties',
      tags: [
        { category: 'Format', value: 'Flavored' },
        { category: 'Function', value: 'Snack' },
        { category: 'Values', value: 'Variety' }
      ]
    },
    {
      name: 'Original Pretzels',
      keywords: ['original', 'classic', 'traditional'],
      description: 'Search terms focused on traditional and original pretzel products',
      tags: [
        { category: 'Format', value: 'Original' },
        { category: 'Function', value: 'Snack' },
        { category: 'Values', value: 'Traditional' }
      ]
    },
    {
      name: 'Pretzel Variety Packs',
      keywords: ['pack', 'variety', 'assortment'],
      description: 'Search interest in variety packs and assorted pretzel collections',
      tags: [
        { category: 'Format', value: 'Variety Pack' },
        { category: 'Function', value: 'Snack' },
        { category: 'Values', value: 'Variety' }
      ]
    },
    {
      name: 'Brand-Specific Pretzels',
      keywords: ['dots', 'dot', 'brand'],
      description: 'Search terms specifically looking for branded pretzel products',
      tags: [
        { category: 'Behavior', value: 'Brand Preference' },
        { category: 'Function', value: 'Snack' }
      ]
    }
  ];

  // Find the best matching pattern
  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => termText.includes(keyword))) {
      return {
        name: pattern.name,
        description: pattern.description,
        tags: pattern.tags
      };
    }
  }

  // Default theme if no pattern matches
  return {
    name: 'General Pretzels',
    description: 'General pretzel-related search terms',
    tags: [
      { category: 'Function', value: 'Snack' },
      { category: 'Values', value: 'Variety' }
    ]
  };
}

async function generateEmbeddings(terms: Level2SearchTermData[], openai: OpenAI): Promise<TermData[]> {
  const results: TermData[] = [];
  
  for (const term of terms) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: term.Search_Term,
        encoding_format: "float"
      });
      
      results.push({
        term: term.Search_Term,
        volume: term.Volume || 0,
        growth: term.Growth_180 || term.Growth_90 || 0,
        clickShare: term.Click_Share || 0,
        embedding: response.data[0].embedding
      });
    } catch (error) {
      console.error(`Error generating embedding for "${term.Search_Term}":`, error);
    }
  }
  
  return results;
}

export async function createSearchClusters(searchTerms: Level2SearchTermData[], openai: OpenAI): Promise<SearchCluster[]> {
  if (!searchTerms?.length) {
    console.log("No search terms provided for clustering");
    return [];
  }

  console.log(`Starting clustering for ${searchTerms.length} search terms`);

  // Generate embeddings
  const termData = await generateEmbeddings(searchTerms, openai);
  console.log(`Generated embeddings for ${termData.length} terms`);

  if (termData.length < 2) {
    console.log("Not enough terms with valid embeddings for clustering");
    return [];
  }

  // Extract embeddings for clustering
  const embeddings = termData.map(t => t.embedding);
  
  // Initialize DBSCAN with more lenient parameters
  const dbscan = new clustering.DBSCAN();
  const minPts = Math.max(2, Math.floor(Math.sqrt(termData.length / 3))); // Reduced from /2 to /3
  
  // Try more epsilon values with smaller increments
  const epsilonValues = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];
  let bestClusters: SearchCluster[] = [];
  let maxClusterCount = 0;

  for (const epsilon of epsilonValues) {
    try {
      console.log(`Attempting clustering with epsilon=${epsilon}, minPts=${minPts}`);
      
      // Run clustering
      const clusterAssignments = dbscan.run(embeddings, epsilon, minPts);
      
      // Group terms by cluster
      const clusterMap = new Map<number, Level2SearchTermData[]>();
      let noiseCount = 0;
      
      clusterAssignments.forEach((clusterId: number, index: number) => {
        if (clusterId === -1) {
          noiseCount++;
          return;
        }
        
        if (!clusterMap.has(clusterId)) {
          clusterMap.set(clusterId, []);
        }
        clusterMap.get(clusterId)!.push(searchTerms[index]);
      });

      console.log(`Found ${clusterMap.size} clusters with ${noiseCount} noise points at epsilon=${epsilon}`);

      // Consider this epsilon if it produces more clusters or similar clusters with less noise
      const currentScore = clusterMap.size * 10 - noiseCount;
      const bestScore = maxClusterCount * 10 - (searchTerms.length - maxClusterCount);
      
      if (currentScore > bestScore) {
        // Create clusters
        const clusters: SearchCluster[] = [];
        
        // Process main clusters
        clusterMap.forEach((clusterTerms, clusterId) => {
          const metrics = calculateClusterMetrics(clusterTerms);
          const theme = identifyClusterTheme(clusterTerms.map(t => t.Search_Term));
          
          clusters.push({
            id: `cluster-${clusterId}`,
            name: theme.name,
            description: theme.description,
            searchVolume: metrics.searchVolume,
            clickShare: metrics.clickShare,
            opportunityScore: metrics.opportunityScore,
            terms: clusterTerms.map(t => t.Search_Term),
            tags: theme.tags
          });
        });

        // Handle noise points
        const noiseTerms = searchTerms.filter((_, index) => clusterAssignments[index] === -1);
        if (noiseTerms.length > 0) {
          console.log(`Processing ${noiseTerms.length} noise terms`);
          const noiseGroups = new Map<string, Level2SearchTermData[]>();
          
          noiseTerms.forEach(term => {
            const termText = term.Search_Term.toLowerCase();
            let assigned = false;
            
            // Expanded patterns to catch more variations
            const patterns = [
              'original', 'flavored', 'seasoned', 'pack', 'brand', 'style',
              'honey', 'mustard', 'garlic', 'southwest', 'cinnamon',
              'individual', 'variety', 'homestyle'
            ];
            
            for (const pattern of patterns) {
              if (termText.includes(pattern) && !assigned) {
                if (!noiseGroups.has(pattern)) {
                  noiseGroups.set(pattern, []);
                }
                noiseGroups.get(pattern)!.push(term);
                assigned = true;
              }
            }
            
            if (!assigned) {
              if (!noiseGroups.has('misc')) {
                noiseGroups.set('misc', []);
              }
              noiseGroups.get('misc')!.push(term);
            }
          });

          // Create clusters from noise groups with no minimum size requirement
          noiseGroups.forEach((groupTerms, groupName) => {
            if (groupTerms.length > 0) {
              const metrics = calculateClusterMetrics(groupTerms);
              const theme = identifyClusterTheme(groupTerms.map(t => t.Search_Term));
              
              clusters.push({
                id: `group-${groupName}`,
                name: theme.name,
                description: theme.description,
                searchVolume: metrics.searchVolume,
                clickShare: metrics.clickShare,
                opportunityScore: metrics.opportunityScore,
                terms: groupTerms.map(t => t.Search_Term),
                tags: theme.tags
              });
            }
          });
        }

        maxClusterCount = clusterMap.size;
        bestClusters = clusters;
      }
    } catch (error) {
      console.error(`Error during clustering with epsilon=${epsilon}:`, error);
    }
  }

  // If no clusters were found, create fallback clusters based on term patterns
  if (bestClusters.length === 0) {
    console.log("No clusters found, creating fallback clusters based on patterns");
    const fallbackGroups = new Map<string, Level2SearchTermData[]>();
    
    searchTerms.forEach(term => {
      const termText = term.Search_Term.toLowerCase();
      let assigned = false;
      
      for (const pattern of ['flavored', 'original', 'pack', 'brand', 'style']) {
        if (termText.includes(pattern) && !assigned) {
          if (!fallbackGroups.has(pattern)) {
            fallbackGroups.set(pattern, []);
          }
          fallbackGroups.get(pattern)!.push(term);
          assigned = true;
        }
      }
      
      if (!assigned) {
        if (!fallbackGroups.has('misc')) {
          fallbackGroups.set('misc', []);
        }
        fallbackGroups.get('misc')!.push(term);
      }
    });

    fallbackGroups.forEach((groupTerms, groupName) => {
      if (groupTerms.length > 0) {
        const metrics = calculateClusterMetrics(groupTerms);
        const theme = identifyClusterTheme(groupTerms.map(t => t.Search_Term));
        
        bestClusters.push({
          id: `fallback-${groupName}`,
          name: theme.name,
          description: theme.description,
          searchVolume: metrics.searchVolume,
          clickShare: metrics.clickShare,
          opportunityScore: metrics.opportunityScore,
          terms: groupTerms.map(t => t.Search_Term),
          tags: theme.tags
        });
      }
    });
  }

  console.log(`Returning ${bestClusters.length} clusters`);
  return bestClusters;
} 