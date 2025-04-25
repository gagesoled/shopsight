export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

// Generate dynamic metadata at request time
export async function generateMetadata({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  
  return {
    title: `Project Workspace | SoledSearch`,
    description: `Manage and analyze uploaded files for your market research project`,
  }
} 