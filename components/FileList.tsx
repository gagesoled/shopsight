import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileIcon, Trash2, RefreshCw } from "lucide-react"
import { formatDistanceToNow } from 'date-fns'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface File {
  id: string
  project_id: string
  level: number
  original_filename: string
  created_at: string
  parser_version?: string
}

interface FileListProps {
  projectId: string | null
  onRefresh?: () => void
}

export function FileList({ projectId, onRefresh }: FileListProps) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const fetchFiles = async (isRetry = false) => {
    if (!projectId) return
    
    setLoading(true)
    setError(null)
    
    try {
      console.log(`Fetching files for project: ${projectId}${isRetry ? ' (retry attempt)' : ''}`);
      const response = await fetch(`/api/files/list?project_id=${projectId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load files: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        throw new Error(data.message || 'Failed to load files')
      }
      
      setFiles(data.data || [])
      // Reset retry count on success
      setRetryCount(0)
    } catch (err) {
      console.error('Error fetching files:', err)
      setError(err instanceof Error ? err.message : 'An error occurred loading files')
      
      // If this is the first error and not already a retry attempt, try once more after a delay
      if (retryCount < 2 && !isRetry) {
        setRetryCount(prev => prev + 1)
        setTimeout(() => {
          fetchFiles(true)
        }, 2000) // 2 second delay before retry
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return
    
    try {
      const response = await fetch(`/api/files/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        throw new Error(data.message || 'Failed to delete file')
      }
      
      // Remove the file from the state
      setFiles(prev => prev.filter(file => file.id !== fileId))
      
      // Call onRefresh if provided
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Error deleting file:', err)
      alert(err instanceof Error ? err.message : 'An error occurred deleting the file')
    }
  }

  // Load files when projectId changes or component mounts
  useEffect(() => {
    if (projectId) {
      fetchFiles()
    } else {
      setFiles([])
    }
  }, [projectId])

  // Function to get level name
  const getLevelName = (level: number) => {
    switch (level) {
      case 1: return 'Category Search'
      case 2: return 'Niche Explorer'
      case 3: return 'Product Keywords'
      default: return `Level ${level}`
    }
  }

  if (!projectId) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Project Files
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              fetchFiles()
              if (onRefresh) onRefresh()
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Files uploaded for this project
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Error loading files</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => fetchFiles()} 
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : files.length === 0 ? (
          <div className="text-muted-foreground py-4">No files uploaded yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map(file => (
                <TableRow key={file.id}>
                  <TableCell className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4" />
                    {file.original_filename}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getLevelName(file.level)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
} 