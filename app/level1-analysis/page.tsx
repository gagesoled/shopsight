"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Level1RedirectPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push("/")
  }, [router])
  
  return (
    <div className="container mx-auto py-8 flex items-center justify-center min-h-[50vh]">
      <p className="text-muted-foreground">Redirecting to Home...</p>
    </div>
  )
} 