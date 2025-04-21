import Level1Analysis from "@/components/level1/Level1Analysis"

export const metadata = {
  title: "Category Search | SoledSearch",
  description: "Identify niche market opportunities through Category Search data analysis",
}

export default function CategorySearchPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Category Search</h1>
      <Level1Analysis />
    </div>
  )
} 