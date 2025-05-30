"use client"

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, BarChart2 } from "lucide-react";
import { Upload as UploadComponent } from "@/components/upload";

interface NicheDetails {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface File {
  id: string;
  original_filename: string;
  level: number;
  file_type: string | null;
  created_at: string;
}

interface AnalysisResult {
  clusters: any[];
  overallInsights: string[];
}

export default function NicheDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const nicheId = params.nicheId as string;

  const [nicheDetails, setNicheDetails] = useState<NicheDetails | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadLevel, setUploadLevel] = useState<number | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<'search_terms' | 'products' | null>(null);

  // Fetch niche details and files
  useEffect(() => {
    fetchNicheData();
  }, [nicheId]);

  const fetchNicheData = async () => {
    try {
      setLoading(true);
      // Fetch niche details
      const nicheResponse = await fetch(`/api/niches/${nicheId}`);
      const nicheData = await nicheResponse.json();
      
      if (!nicheData.success) {
        throw new Error(nicheData.message || "Failed to fetch niche details");
      }
      
      setNicheDetails(nicheData.data);

      // Fetch files
      const filesResponse = await fetch(`/api/files/list?niche_id=${nicheId}`);
      const filesData = await filesResponse.json();
      
      if (!filesData.success) {
        throw new Error(filesData.message || "Failed to fetch files");
      }
      
      setFiles(filesData.data || []);

      // Fetch existing analysis results
      const analysisResponse = await fetch(`/api/projects/analysis?niche_id=${nicheId}&type=niche_combined_analysis`);
      const analysisData = await analysisResponse.json();
      
      if (analysisData.success && analysisData.data) {
        setAnalysisResults(analysisData.data.results);
      }

      setError(null);
    } catch (err: any) {
      console.error("Error fetching niche data:", err);
      setError(err.message);
      toast.error("Failed to load niche data");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      const response = await fetch(`/api/niches/${nicheId}/analyze`, {
        method: "POST",
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to analyze niche");
      }

      setAnalysisResults(data.data);
      toast.success("Analysis completed successfully");
    } catch (err: any) {
      console.error("Error analyzing niche:", err);
      toast.error(err.message || "Failed to analyze niche");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSearchTermsFile = () => files.find(f => f.file_type === 'search_terms');
  const getProductsFile = () => files.find(f => f.file_type === 'products');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Error: {error}</p>
        <Button variant="outline" onClick={fetchNicheData} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Niche Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{nicheDetails?.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(nicheDetails?.created_at || '').toLocaleDateString()}
          </p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !getSearchTermsFile() || !getProductsFile()}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <BarChart2 className="mr-2 h-4 w-4" />
              Analyze Niche
            </>
          )}
        </Button>
      </div>

      {/* Files Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Search Terms File */}
        <Card>
          <CardHeader>
            <CardTitle>Search Terms File</CardTitle>
            <CardDescription>
              Upload a Level 2 search terms file for this niche
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getSearchTermsFile() ? (
              <div className="space-y-2">
                <p className="font-medium">{getSearchTermsFile()?.original_filename}</p>
                <p className="text-sm text-muted-foreground">
                  Uploaded {new Date(getSearchTermsFile()?.created_at || '').toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  No search terms file uploaded yet
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploadLevel(2);
                    setSelectedFileType('search_terms');
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products File */}
        <Card>
          <CardHeader>
            <CardTitle>Products File</CardTitle>
            <CardDescription>
              Upload a Level 2 products file for this niche
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getProductsFile() ? (
              <div className="space-y-2">
                <p className="font-medium">{getProductsFile()?.original_filename}</p>
                <p className="text-sm text-muted-foreground">
                  Uploaded {new Date(getProductsFile()?.created_at || '').toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  No products file uploaded yet
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploadLevel(2);
                    setSelectedFileType('products');
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis Results */}
      {analysisResults && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Analysis Results</h2>
          
          {/* Overall Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-4 space-y-2">
                {analysisResults.overallInsights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Clusters */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analysisResults.clusters.map((cluster) => (
              <Card key={cluster.id}>
                <CardHeader>
                  <CardTitle>{cluster.name}</CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="mr-2">
                      Score: {cluster.opportunityScore}
                    </Badge>
                    <Badge variant="outline">
                      Volume: {cluster.searchVolume}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">{cluster.description}</p>
                  
                  {/* Product Metrics */}
                  {cluster.linkedProductMetrics && (
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Avg Price:</span>{" "}
                        ${cluster.linkedProductMetrics.avgPrice?.toFixed(2)}
                      </p>
                      <p>
                        <span className="font-medium">Avg Rating:</span>{" "}
                        {cluster.linkedProductMetrics.avgRating?.toFixed(1)}/5
                      </p>
                      <p>
                        <span className="font-medium">Total Reviews:</span>{" "}
                        {cluster.linkedProductMetrics.totalReviews}
                      </p>
                      {cluster.linkedProductMetrics.dominantBrands && (
                        <p>
                          <span className="font-medium">Top Brands:</span>{" "}
                          {cluster.linkedProductMetrics.dominantBrands.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Keywords:</p>
                    <div className="flex flex-wrap gap-2">
                      {cluster.keywords.slice(0, 5).map((keyword: string) => (
                        <Badge key={keyword} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                      {cluster.keywords.length > 5 && (
                        <Badge variant="outline">
                          +{cluster.keywords.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

                  {/* Upload Dialog */}      {uploadLevel === 2 && selectedFileType && (        <div className="space-y-4">          <div className="flex justify-between items-center">            <h3 className="text-lg font-semibold">              Upload {selectedFileType === 'search_terms' ? 'Search Terms' : 'Products'} File            </h3>            <Button              variant="outline"              onClick={() => {                setUploadLevel(null);                setSelectedFileType(null);              }}            >              Cancel            </Button>          </div>          <UploadComponent            projectId={projectId}            level={2}            additionalFields={{              niche_id: nicheId,              file_type: selectedFileType            }}            onSuccess={() => {              setUploadLevel(null);              setSelectedFileType(null);              fetchNicheData();            }}          />        </div>      )}    </div>  );} 