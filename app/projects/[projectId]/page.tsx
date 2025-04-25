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
import { AlertCircle, Home, ChevronRight, FileJson, FileX, FolderUp } from "lucide-react"
import { useProjectSelection } from "@/hooks/useProjectSelection"
import { parseFile } from "@/lib/parsers/fileParser"
import { formatDistanceToNow } from "date-fns"

interface Project {
  id: string
  name: string
  created_at: string
}

interface File {
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
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileUploading, setFileUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("files")
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [uploadLevel, setUploadLevel] = useState<number>(1)

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
  const handleFileUpload = async (file: File) => {
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
            Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </p>
        </div>
      ) : null}
      
      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="files">Files & Upload</TabsTrigger>
          <TabsTrigger value="debug">Debug View</TabsTrigger>
        </TabsList>
        
        {/* Files & Upload tab */}
        <TabsContent value="files">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload section */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>
                  Upload files for market analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="level-select" className="text-sm font-medium">
                    Select Analysis Level
                  </label>
                  <select 
                    id="level-select"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={uploadLevel}
                    onChange={(e) => setUploadLevel(Number(e.target.value))}
                  >
                    <option value={1}>Level 1 - Category Search</option>
                    <option value={2}>Level 2 - Niche Explorer</option>
                    <option value={3}>Level 3 - Product Keywords</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadLevel === 1 && "For top-level category analysis"}
                    {uploadLevel === 2 && "For detailed niche behavior analysis"}
                    {uploadLevel === 3 && "For product-level keyword optimization"}
                  </p>
                </div>
                
                <Upload
                  onUpload={handleFileUpload}
                  acceptedFileTypes={[".csv", ".xlsx", ".xls", ".json"]}
                  maxSize={10}
                  label={`Upload ${getLevelName(uploadLevel)} File`}
                  helpText="Drag and drop your file here or click to browse"
                  loading={fileUploading}
                  projectId={projectId}
                  level={uploadLevel}
                />
              </CardContent>
            </Card>
            
            {/* Files listing section */}
            <div className="lg:col-span-2">
              <FileList projectId={projectId} onRefresh={fetchProjectData} />
            </div>
          </div>
        </TabsContent>
        
        {/* Debug View tab */}
        <TabsContent value="debug">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Files sidebar */}
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>
                  Select a file to view parsed data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <FileX className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No files uploaded yet
                    </p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => setActiveTab("files")}
                    >
                      <FolderUp className="h-4 w-4 mr-1" />
                      Upload files
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <Button
                        key={file.id}
                        variant={selectedFileId === file.id ? "default" : "outline"}
                        className="w-full justify-start text-left"
                        onClick={() => setSelectedFileId(file.id)}
                      >
                        <FileJson className="h-4 w-4 mr-2" />
                        <div className="truncate">
                          <div className="font-medium truncate">{file.original_filename}</div>
                          <div className="text-xs flex items-center text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {getLevelName(file.level)}
                            </Badge>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* JSON viewer */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {getSelectedFile()
                      ? `Data: ${getSelectedFile()?.original_filename}`
                      : "Parsed Data"}
                  </span>
                  {getSelectedFile() && (
                    <Badge variant="outline">
                      {getLevelName(getSelectedFile()?.level || 0)}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {getSelectedFile()
                    ? `Parsed with ${getSelectedFile()?.parser_version || 'v1.0'}`
                    : "Select a file to view its parsed data"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedFileId ? (
                  <div className="border rounded-md p-6 bg-muted/40 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
                    <FileJson className="h-12 w-12 mb-4 text-muted-foreground/70" />
                    <p>Select a file from the sidebar to view its parsed data</p>
                  </div>
                ) : !getSelectedFile() ? (
                  <div className="border rounded-md p-6 bg-muted/40 text-center text-muted-foreground">
                    <p>File not found</p>
                  </div>
                ) : (
                  <div className="border rounded-md p-4 bg-muted/40 overflow-auto max-h-[600px]">
                    <pre className="text-sm font-mono">
                      {JSON.stringify(getSelectedFile()?.parsed_json, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 