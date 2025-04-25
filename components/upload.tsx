"use client"

import React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UploadIcon, File, CheckCircle, AlertCircle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface UploadProps {
  endpoint?: string
  acceptedFileTypes?: string[]
  maxSize?: number // in MB
  onUpload?: (data: any) => void
  onSuccess?: (data: any) => void
  accept?: string
  fileUrl?: string // Optional URL for direct processing
  loading?: boolean
  label?: string
  helpText?: string
  projectId?: string | null
  level?: number
}

interface HeaderInfo {
  originalHeaders?: string[]
  normalizedHeaders?: string[]
  details?: string
  rawInfo?: string
  metadata?: {
    niche_name?: string
    last_updated?: string
  }
}

export function Upload({ 
  endpoint, 
  acceptedFileTypes = [".csv"], 
  maxSize = 10, 
  onSuccess, 
  onUpload,
  accept,
  fileUrl,
  loading,
  label = "Upload File",
  helpText = "Drag and drop your file here or click to browse",
  projectId,
  level
}: UploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(loading || false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)
  const [headerInfo, setHeaderInfo] = useState<HeaderInfo | null>(null)
  const [warnings, setWarnings] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadStarted, setUploadStarted] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError(null)
    setValidationErrors([])
    setSuccess(false)
    setHeaderInfo(null)
    setWarnings(null)

    if (!selectedFile) return

    // Check file type if acceptedFileTypes is provided
    if (acceptedFileTypes && acceptedFileTypes.length > 0) {
      const fileExtension = `.${selectedFile.name.split(".").pop()?.toLowerCase()}`
      if (!acceptedFileTypes.includes(fileExtension) && !acceptedFileTypes.includes("*")) {
        setError(`Invalid file type. Accepted types: ${acceptedFileTypes.join(", ")}`)
        return
      }
    }

    // Check file size
    if (selectedFile.size > maxSize * 1024 * 1024) {
      setError(`File size exceeds the ${maxSize}MB limit`)
      return
    }

    setFile(selectedFile)
    
    // If onUpload is provided, call it directly with the file
    if (onUpload) {
      onUpload(selectedFile)
      setUploadStarted(true)
    }
  }

  const processFile = async (fileToProcess: File | null, urlToProcess: string | null) => {
    setUploading(true)
    setProgress(0)
    setError(null)
    setValidationErrors([])
    setHeaderInfo(null)
    setWarnings(null)

    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval)
          return 95
        }
        return prev + 5
      })
    }, 100)

    // Check if projectId is provided when using an endpoint
    if (endpoint && !projectId) {
      setError("Cannot upload file: No project selected.")
      setUploading(false)
      setProgress(0)
      clearInterval(interval) // Stop progress simulation
      return
    }

    try {
      const formData = new FormData()

      if (fileToProcess) {
        formData.append("file", fileToProcess)
      } else if (urlToProcess) {
        formData.append("fileUrl", urlToProcess)
      } else {
        throw new Error("No file or URL provided")
      }

      // Only make the fetch request if endpoint is provided
      if (!endpoint) {
        throw new Error("No endpoint provided for upload")
      }

      // Add projectId and level to FormData if endpoint exists and projectId is provided
      if (projectId) {
        formData.append("project_id", projectId)
      }
      if (level !== undefined) {
        formData.append("level", String(level))
      }

      console.log("Sending request to:", endpoint, "with formData containing project_id and level")
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      console.log("Response received:", result)

      clearInterval(interval)
      setProgress(100)

      // Check for success field first - new API format
      if (result.success === false || !response.ok) {
        if (result.errors && Array.isArray(result.errors)) {
          setValidationErrors(result.errors)
        } else if (result.error) {
          setError(`${result.error}${result.details ? `: ${result.details}` : ''}`)
        } else {
          setError(result.message || "Upload failed")
        }

        // Still show header info even if there are errors
        if (result.headerInfo) {
          if (typeof result.headerInfo === 'string') {
            setHeaderInfo({ rawInfo: result.headerInfo })
          } else {
            setHeaderInfo(result.headerInfo)
          }
        }

        setUploading(false)
        return
      }

      // Display header detection info and metadata if available
      if (result.headerInfo || result.metadata) {
        // Prepare base header info object
        const baseHeaderInfo = typeof result.headerInfo === 'string'
          ? { rawInfo: result.headerInfo }
          : (result.headerInfo || {})
        // Merge metadata into headerInfo state
        setHeaderInfo({
          ...baseHeaderInfo,
          metadata: result.metadata,
        })
      }

      // Display warnings if available
      if (result.warnings) {
        setWarnings(result.warnings)
      }

      setSuccess(true)

      // Call onSuccess callback if provided
      // With the new API format, the data is in result.data
      if (onSuccess) {
        if (result.data) {
          onSuccess(result.data)
        } else {
          // If data is at the top level for backward compatibility
          onSuccess(result)
        }
      }

      // Reset upload state after success
      setTimeout(() => {
        setUploading(false)
      }, 1000)
    } catch (err) {
      clearInterval(interval)
      console.error("Upload error:", err)
      setError(err instanceof Error ? err.message : "Upload failed")
      setUploading(false)
      setProgress(0)
    }
  }

  const handleUpload = () => {
    // Add check for projectId before allowing upload via endpoint
    if (endpoint && !projectId) {
      setError("Please select or create a project first.")
      return
    }

    if (file) {
      if (onUpload) {
        onUpload(file)
        setUploadStarted(true)
      } else if (endpoint) {
        processFile(file, null)
      } else {
        // No endpoint and no onUpload handler, show an error
        setError("No upload handler configured")
      }
    } else if (fileUrl && endpoint) {
      processFile(null, fileUrl)
    } else if (fileUrl) {
      setError("No endpoint provided for URL processing")
    }
  }

  // Auto-process if fileUrl is provided
  React.useEffect(() => {
    if (fileUrl && !file && !uploading && !success && !error) {
      processFile(null, fileUrl)
    }
  }, [fileUrl])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      // Manually check file type and size as we did in handleFileChange
      if (acceptedFileTypes && acceptedFileTypes.length > 0) {
        const fileExtension = `.${droppedFile.name.split(".").pop()?.toLowerCase()}`
        if (!acceptedFileTypes.includes(fileExtension) && !acceptedFileTypes.includes("*")) {
          setError(`Invalid file type. Accepted types: ${acceptedFileTypes.join(", ")}`)
          return
        }
      }

      if (droppedFile.size > maxSize * 1024 * 1024) {
        setError(`File size exceeds the ${maxSize}MB limit`)
        return
      }

      setFile(droppedFile)
      setError(null)
      setValidationErrors([])
      setSuccess(false)
      setHeaderInfo(null)
      setWarnings(null)
      
      // If onUpload is provided, call it directly with the file
      if (onUpload) {
        onUpload(droppedFile)
        setUploadStarted(true)
      }
    }
  }

  return (
    <div className="w-full">
      {fileUrl ? (
        <div className="mb-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Processing file from URL</AlertTitle>
            <AlertDescription>
              {success
                ? "File processed successfully!"
                : uploading
                  ? "Processing..."
                  : "Ready to process file from URL"}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center ${
            !projectId && endpoint ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'cursor-pointer'
          } ${
            error || validationErrors.length > 0
              ? "border-red-300 bg-red-50"
              : success
                ? "border-green-300 bg-green-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100"
          }`}
          onDragOver={!projectId && endpoint ? undefined : handleDragOver}
          onDrop={!projectId && endpoint ? undefined : handleDrop}
          onClick={() => !projectId && endpoint ? null : fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={accept || (acceptedFileTypes && acceptedFileTypes.length > 0 ? acceptedFileTypes.join(",") : undefined)}
            className="hidden"
            disabled={uploading}
          />

          {!file && !error && !success && validationErrors.length === 0 && (
            <>
              <UploadIcon className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1">{helpText}</p>
              <p className="text-xs text-gray-500">
                {acceptedFileTypes && acceptedFileTypes.length > 0 
                  ? `Accepted file types: ${acceptedFileTypes.join(", ")} (Max size: ${maxSize}MB)`
                  : `Max file size: ${maxSize}MB`
                }
              </p>
            </>
          )}

          {file && !error && !success && !uploading && validationErrors.length === 0 && (
            <>
              <File className="h-10 w-10 text-gray-600 mb-2" />
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)}MB</p>
            </>
          )}

          {error && (
            <>
              <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </>
          )}

          {uploading && (
            <>
              <Progress value={progress} className="w-full mb-2" />
              <p className="text-sm text-gray-600">Uploading... {progress}%</p>
            </>
          )}

          {success && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-sm text-green-600">Upload successful!</p>
            </>
          )}

          {!projectId && endpoint && (
            <p className="text-sm text-destructive mt-2 font-semibold">Please select or create a project first.</p>
          )}
        </div>
      )}

      {file && !uploading && !success && !uploadStarted && (
        <div className="mt-4">
          <Button onClick={handleUpload} className="w-full" disabled={!projectId && !!endpoint}>
            {label}
          </Button>
        </div>
      )}

      {(error || validationErrors.length > 0 || headerInfo || warnings) && (
        <div className="mt-4">
          {/* Display metadata if available */}
          {headerInfo?.metadata?.niche_name && (
            <Alert className="mb-2">
              <Info className="h-4 w-4" />
              <AlertTitle>Niche Name</AlertTitle>
              <AlertDescription>{headerInfo.metadata.niche_name}</AlertDescription>
            </Alert>
          )}
          {headerInfo?.metadata?.last_updated && (
            <Alert className="mb-2">
              <Info className="h-4 w-4" />
              <AlertTitle>Last Updated</AlertTitle>
              <AlertDescription>{headerInfo.metadata.last_updated}</AlertDescription>
            </Alert>
          )}
          <Accordion type="single" collapsible>
            <AccordionItem value="details">
              <AccordionTrigger>Details</AccordionTrigger>
              <AccordionContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {validationErrors.length > 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validation Errors</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {validationErrors.map((err, index) => (
                          <li key={index}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {headerInfo && (
                  <Accordion type="single" collapsible className="mt-4">
                    <AccordionItem value="header-info">
                      <AccordionTrigger>File Processing Details</AccordionTrigger>
                      <AccordionContent>
                        {headerInfo.rawInfo ? (
                          <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                            {headerInfo.rawInfo}
                          </pre>
                        ) : (
                          <>
                            {headerInfo.details && (
                              <p className="text-sm mb-2">{headerInfo.details}</p>
                            )}
                            {headerInfo.originalHeaders && (
                              <div className="mb-2">
                                <p className="text-xs font-medium">Original Headers:</p>
                                <p className="text-xs bg-gray-50 p-1 rounded">
                                  {headerInfo.originalHeaders.join(", ")}
                                </p>
                              </div>
                            )}
                            {headerInfo.normalizedHeaders && (
                              <div>
                                <p className="text-xs font-medium">Mapped Fields:</p>
                                <p className="text-xs bg-gray-50 p-1 rounded">
                                  {headerInfo.normalizedHeaders.join(", ")}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {warnings && (
                  <Alert variant="default" className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>{warnings}</AlertDescription>
                  </Alert>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  )
}
