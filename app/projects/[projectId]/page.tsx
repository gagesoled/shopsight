"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { FileList } from "@/components/FileList"
import { Upload } from "@/components/upload"
import { AlertCircle, Home, ChevronRight, FileJson, FileX, FolderUp, TrendingUp } from "lucide-react"
import { useProjectSelection } from "@/hooks/useProjectSelection"
import { parseFile } from "@/lib/parsers/fileParser"
import { formatDistanceToNow } from "date-fns"
import { ProjectSettings } from "@/components/ProjectSettings"
import { ClusterAnalysis } from "@/components/ClusterAnalysis"
import { CombinedInsights } from "@/components/CombinedInsights"
import type { ClusterResult, ProductClusterResult } from "@/lib/types"

interface Project {
  id: string
  name: string
  created_at: string
}

interface ProjectFile {
  id: string
  project_id: string
  level: number
  original_filename: string
  parsed_json: any
  created_at: string
  parser_version?: string
}

export default function ProjectWorkspace() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [selectedProjectId, setSelectedProjectId] = useProjectSelection()
  const projectId = params.projectId as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileUploading, setFileUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("files")
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [uploadLevel, setUploadLevel] = useState<number>(1)
  const [level2Loaded, setLevel2Loaded] = useState(false)
  const [searchTerms, setSearchTerms] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [projectSettings, setProjectSettings] = useState<any>(null)
  const [searchTermClusters, setSearchTermClusters] = useState<ClusterResult[]>([])
  const [productClusters, setProductClusters] = useState<ProductClusterResult[]>([])

  // Set the project ID in context when the page loads
  useEffect(() => {
    setSelectedProjectId(projectId)
  }, [projectId, setSelectedProjectId])

  // Fetch project details and files
  const fetchProjectData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch project details
      const projectResponse = await fetch(`/api/projects/list`)
      
      if (!projectResponse.ok) {
        throw new Error(`Failed to fetch project: ${projectResponse.status}`)
      }
      
      const projectData = await projectResponse.json()
      
      if (!projectData.success) {
        throw new Error(projectData.message || "Failed to fetch project")
      }
      
      const projectDetails = projectData.data.find((p: Project) => p.id === projectId)
      
      if (!projectDetails) {
        throw new Error("Project not found")
      }
      
      setProject(projectDetails)
      
      // Fetch files
      const filesResponse = await fetch(`/api/files/list?project_id=${projectId}`)
      
      if (!filesResponse.ok) {
        throw new Error(`Failed to fetch files: ${filesResponse.status}`)
      }
      
      const filesData = await filesResponse.json()
      
      if (!filesData.success) {
        throw new Error(filesData.message || "Failed to fetch files")
      }
      
      setFiles(filesData.data || [])
    } catch (err) {
      console.error("Error fetching project data:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }
  
  // File upload handler
  const handleFileUpload = async (file: globalThis.File) => {
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No project selected",
      })
      return
    }
    
    setFileUploading(true)
    
    try {
      const parsedFile = await parseFile(file, uploadLevel)
      
      if (!parsedFile.data || parsedFile.data.length === 0) {
        throw new Error("No data found in the file")
      }
      
      // Send the parsed data to the API
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          level: uploadLevel,
          original_filename: parsedFile.originalFilename,
          parsed_json: parsedFile.data,
          parser_version: parsedFile.parserVersion
        })
      })
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to upload file')
      }
      
      // Show success message
      toast({
        title: "Upload successful",
        description: `File "${parsedFile.originalFilename}" has been uploaded and processed.`,
      })
      
      // Refresh files list
      fetchProjectData()
    } catch (err) {
      console.error("File processing error:", err)
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to process file",
      })
    } finally {
      setFileUploading(false)
    }
  }
  
  // Function to get the selected file for debug view
  const getSelectedFile = () => {
    if (!selectedFileId) return null
    return files.find(file => file.id === selectedFileId) || null
  }
  
  // Load project data on mount
  useEffect(() => {
    fetchProjectData()
  }, [projectId])
  
  // Format the file level
  const getLevelName = (level: number) => {
    switch (level) {
      case 1: return 'Category Search'
      case 2: return 'Niche Explorer'
      case 3: return 'Product Keywords'
      default: return `Level ${level}`
    }
  }

  const handleLevel2Success = (data: any) => {
    setLevel2Loaded(true)
    setSearchTerms(data.searchTerms)
    setProducts(data.products)
  }

  // Add function to fetch project settings
  const fetchProjectSettings = async () => {
    try {
      const response = await fetch(`/api/projects/settings?project_id=${projectId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch settings")
      }

      setProjectSettings(data.data)
    } catch (error) {
      console.error("Error fetching project settings:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch project settings",
      })
    }
  }

  // Add useEffect to fetch settings
  useEffect(() => {
    if (projectId) {
      fetchProjectSettings()
    }
  }, [projectId])

  // Add function to fetch analysis results
  const fetchAnalysisResults = async () => {
    try {
      // Fetch search term clusters
      const searchTermsResponse = await fetch(`/api/projects/analysis?project_id=${projectId}&type=search_term_clusters`)
      if (searchTermsResponse.ok) {
        const searchTermsData = await searchTermsResponse.json()
        if (searchTermsData.success && searchTermsData.data) {
          setSearchTermClusters(searchTermsData.data)
        }
      }

      // Fetch product clusters
      const productsResponse = await fetch(`/api/projects/analysis?project_id=${projectId}&type=product_clusters`)
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        if (productsData.success && productsData.data) {
          setProductClusters(productsData.data)
        }
      }
    } catch (error) {
      console.error("Error fetching analysis results:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch analysis results",
      })
    }
  }

  // Add useEffect to fetch analysis results
  useEffect(() => {
    if (projectId) {
      fetchAnalysisResults()
    }
  }, [projectId])

  return (
    <div className="container py-8">
      {/* Breadcrumb navigation */}
      <div className="flex items-center text-sm text-muted-foreground mb-4">
        <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/')}>
          <Home className="h-3.5 w-3.5 mr-1" />
          Home
        </Button>
        <ChevronRight className="h-3.5 w-3.5 mx-1" />
        <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/projects')}>
          Projects
        </Button>
        {project && (
          <>
            <ChevronRight className="h-3.5 w-3.5 mx-1" />
            <span className="font-medium text-foreground">{project.name}</span>
          </>
        )}
      </div>
      
      {/* Project header section */}
      {loading ? (
        <div className="mb-6">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-5 w-1/4" />
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : project ? (
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">
            Created {(() => {
              try {
                const date = new Date(project.created_at);
                if (isNaN(date.getTime())) {
                  return "Invalid date";
                }
                return formatDistanceToNow(date, { addSuffix: true });
              } catch (error) {
                console.error("Date formatting error:", error);
                return "Invalid date";
              }
            })()}
          </p>
        </div>
      ) : null}
      
      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-6">
          {/* File List */}
          <div className="mb-8">
            <FileList
              projectId={projectId}
              onRefresh={fetchProjectData}
              onFileSelect={(file) => setSelectedFileId(file.id)}
              selectedFileId={selectedFileId}
            />
          </div>

          {/* Upload component */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Data</CardTitle>
              <CardDescription>
                Upload a CSV file with search term or product data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Upload
                accept=".csv,.xlsx,.xls"
                maxSize={10}
                endpoint="/api/upload/level2"
                projectId={projectId}
                level={2}
                onSuccess={handleLevel2Success}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <ProjectSettings
            projectId={projectId}
            onSettingsUpdate={() => {
              fetchProjectSettings()
              fetchProjectData()
            }}
          />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {level2Loaded && projectSettings ? (
            <ClusterAnalysis
              projectId={projectId}
              searchTerms={searchTerms}
              products={products}
              settings={projectSettings}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <FileJson className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-1">No Analysis Data</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Upload a Level 2 file and configure settings to run analysis
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {searchTermClusters.length > 0 && productClusters.length > 0 ? (
            <CombinedInsights
              projectId={projectId}
              searchTermClusters={searchTermClusters}
              productClusters={productClusters}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-1">No Clusters Available</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  Run cluster analysis first to generate insights
                </p>
                <Button onClick={() => setActiveTab("analysis")}>
                  Go to Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 