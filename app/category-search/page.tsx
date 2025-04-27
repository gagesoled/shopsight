"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import Level1Analysis from "@/components/level1/Level1Analysis"
import { useProjectSelection } from "@/hooks/useProjectSelection"
import { FileList } from "@/components/FileList"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function CategorySearchPage() {
  const [projectId, setProjectId] = useProjectSelection()
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [fileData, setFileData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  
  const handleFileSelect = async (file: any) => {
    if (file.id === selectedFileId) return // Don't reload if already selected
    
    setSelectedFileId(file.id)
    setLoading(true)
    setError(null)
    setFileData(null)
    
    try {
      const response = await fetch(`/api/files/get?file_id=${file.id}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load file data')
      }
      
      // Check file level
      const fileLevel = result.data.level;
      
      if (fileLevel !== 1) {
        throw new Error(`This is a Level ${fileLevel} file. Please use the ${fileLevel === 2 ? 'Niche Explorer' : 'Product Keywords'} page to view this file.`);
      }
      
      // Extract the parsed_json data from the file
      const parsedData = result.data.parsed_json
      
      if (!parsedData || (Array.isArray(parsedData) && parsedData.length === 0)) {
        throw new Error('No data found in the selected file')
      }
      
      setFileData(Array.isArray(parsedData) ? parsedData : [parsedData])
      toast({
        title: "File loaded",
        description: `${file.original_filename} loaded successfully.`,
      })
    } catch (err) {
      console.error('Error loading file data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred loading the file data')
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to load file data',
      })
    } finally {
      setLoading(false)
    }
  }
  
  // When a file is uploaded in Level1Analysis, refresh the file list
  const handleFileListRefresh = () => {
    setSelectedFileId(null)
    setFileData(null)
  }
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Category Search</h1>
      
      {!projectId ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Project Selected</AlertTitle>
          <AlertDescription>
            Please select or create a project on the home page before analyzing files.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="mb-8">
            <FileList 
              projectId={projectId} 
              onRefresh={handleFileListRefresh}
              onFileSelect={handleFileSelect}
              selectedFileId={selectedFileId}
            />
          </div>
          
          {loading && (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading file data...</span>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading File</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Level1Analysis 
            projectId={projectId}
            initialData={fileData}
            selectedFileId={selectedFileId}
          />
        </>
      )}
    </div>
  )
} 