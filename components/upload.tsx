"use client"

import React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UploadIcon, File, CheckCircle, AlertCircle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface UploadProps {
  endpoint: string
  acceptedFileTypes: string[]
  maxSize: number // in MB
  onSuccess?: (data: any) => void
  fileUrl?: string // Optional URL for direct processing
}

interface HeaderInfo {
  originalHeaders?: string[]
  normalizedHeaders?: string[]
  details?: string
}

export function Upload({ endpoint, acceptedFileTypes, maxSize, onSuccess, fileUrl }: UploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)
  const [headerInfo, setHeaderInfo] = useState<HeaderInfo | null>(null)
  const [warnings, setWarnings] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError(null)
    setValidationErrors([])
    setSuccess(false)
    setHeaderInfo(null)
    setWarnings(null)

    if (!selectedFile) return

    // Check file type
    const fileExtension = `.${selectedFile.name.split(".").pop()?.toLowerCase()}`
    if (!acceptedFileTypes.includes(fileExtension) && !acceptedFileTypes.includes("*")) {
      setError(`Invalid file type. Accepted types: ${acceptedFileTypes.join(", ")}`)
      return
    }

    // Check file size
    if (selectedFile.size > maxSize * 1024 * 1024) {
      setError(`File size exceeds the ${maxSize}MB limit`)
      return
    }

    setFile(selectedFile)
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

    try {
      const formData = new FormData()

      if (fileToProcess) {
        formData.append("file", fileToProcess)
      } else if (urlToProcess) {
        formData.append("fileUrl", urlToProcess)
      } else {
        throw new Error("No file or URL provided")
      }

      console.log("Sending request to:", endpoint)
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      console.log("Response received:", result)

      clearInterval(interval)
      setProgress(100)

      if (!response.ok) {
        if (result.errors && Array.isArray(result.errors)) {
          setValidationErrors(result.errors)
        } else if (result.error) {
          setError(`${result.error}${result.details ? `: ${result.details}` : ''}`)
        } else {
          setError(result.message || "Upload failed")
        }

        // Still show header info even if there are errors
        if (result.headerInfo) {
          setHeaderInfo(result.headerInfo)
        }

        setUploading(false)
        return
      }

      // Display header detection info if available
      if (result.headerInfo) {
        setHeaderInfo(result.headerInfo)
      }

      // Display warnings if available
      if (result.warnings) {
        setWarnings(result.warnings)
      }

      setSuccess(true)

      // Call onSuccess callback if provided
      if (onSuccess && result.data) {
        onSuccess(result.data)
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
    if (file) {
      processFile(file, null)
    } else if (fileUrl) {
      processFile(null, fileUrl)
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
      const fileExtension = `.${droppedFile.name.split(".").pop()?.toLowerCase()}`
      if (!acceptedFileTypes.includes(fileExtension) && !acceptedFileTypes.includes("*")) {
        setError(`Invalid file type. Accepted types: ${acceptedFileTypes.join(", ")}`)
        return
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
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer ${
            error || validationErrors.length > 0
              ? "border-red-300 bg-red-50"
              : success
                ? "border-green-300 bg-green-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100"
          }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={acceptedFileTypes.join(",")}
            className="hidden"
            disabled={uploading}
          />

          {!file && !error && !success && validationErrors.length === 0 && (
            <>
              <UploadIcon className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-1">Drag and drop your file here, or click to browse</p>
              <p className="text-xs text-gray-500">
                Accepted file types: {acceptedFileTypes.join(", ")} (Max size: {maxSize}MB)
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
        </div>
      )}

      {file && !uploading && !success && (
        <div className="mt-4">
          <Button onClick={handleUpload} className="w-full">
            Upload File
          </Button>
        </div>
      )}

      {(error || validationErrors.length > 0 || headerInfo || warnings) && (
        <div className="mt-4">
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
                  <Alert className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>File Information</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-2">
                        {headerInfo.originalHeaders && (
                          <div>
                            <h4 className="font-semibold">Original Headers</h4>
                            <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-40">
                              {headerInfo.originalHeaders.join("\n")}
                            </pre>
                          </div>
                        )}
                        {headerInfo.normalizedHeaders && (
                          <div>
                            <h4 className="font-semibold">Normalized Headers</h4>
                            <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-40">
                              {headerInfo.normalizedHeaders.join("\n")}
                            </pre>
                          </div>
                        )}
                        {headerInfo.details && (
                          <div>
                            <h4 className="font-semibold">Processing Details</h4>
                            <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-40">
                              {headerInfo.details}
                            </pre>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {warnings && (
                  <Alert variant="warning" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
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
