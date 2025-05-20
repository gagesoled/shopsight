import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface Niche {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface NichesListProps {
  projectId: string;
}

export function NichesList({ projectId }: NichesListProps) {
  const router = useRouter();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [newNicheName, setNewNicheName] = useState("");
  const [editNicheName, setEditNicheName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch niches
  useEffect(() => {
    fetchNiches();
  }, [projectId]);

  const fetchNiches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/niches`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch niches");
      }
      
      setNiches(data.data || []);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching niches:", err);
      setError(err.message);
      toast.error("Failed to load niches");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNiche = async () => {
    if (!newNicheName.trim()) {
      toast.error("Please enter a niche name");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/projects/${projectId}/niches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNicheName.trim() }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to create niche");
      }

      toast.success("Niche created successfully");
      setNewNicheName("");
      setIsCreateDialogOpen(false);
      fetchNiches();
    } catch (err: any) {
      console.error("Error creating niche:", err);
      toast.error(err.message || "Failed to create niche");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditNiche = async () => {
    if (!selectedNiche || !editNicheName.trim()) {
      toast.error("Please enter a niche name");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/niches/${selectedNiche.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editNicheName.trim() }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to update niche");
      }

      toast.success("Niche updated successfully");
      setEditNicheName("");
      setIsEditDialogOpen(false);
      fetchNiches();
    } catch (err: any) {
      console.error("Error updating niche:", err);
      toast.error(err.message || "Failed to update niche");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNiche = async () => {
    if (!selectedNiche) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/niches/${selectedNiche.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to delete niche");
      }

      toast.success("Niche deleted successfully");
      setIsDeleteDialogOpen(false);
      fetchNiches();
    } catch (err: any) {
      console.error("Error deleting niche:", err);
      toast.error(err.message || "Failed to delete niche");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (niche: Niche) => {
    setSelectedNiche(niche);
    setEditNicheName(niche.name);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (niche: Niche) => {
    setSelectedNiche(niche);
    setIsDeleteDialogOpen(true);
  };

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
        <Button variant="outline" onClick={fetchNiches} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Niches</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Niche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Niche</DialogTitle>
              <DialogDescription>
                Enter a name for your new niche. This will help organize your search terms and products.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Niche Name</Label>
                <Input
                  id="name"
                  value={newNicheName}
                  onChange={(e) => setNewNicheName(e.target.value)}
                  placeholder="Enter niche name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNiche} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Niche"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {niches.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          <p>No niches created yet. Create your first niche to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {niches.map((niche) => (
            <Card key={niche.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{niche.name}</CardTitle>
                <CardDescription>
                  Created {new Date(niche.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click to view and manage this niche's files and analysis.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}/niches/${niche.id}`)}
                >
                  View Niche
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(niche)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(niche)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Niche</DialogTitle>
            <DialogDescription>
              Update the name of your niche.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Niche Name</Label>
              <Input
                id="edit-name"
                value={editNicheName}
                onChange={(e) => setEditNicheName(e.target.value)}
                placeholder="Enter niche name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditNiche} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Niche</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this niche? This will unlink any associated files but won't delete them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteNiche} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Niche"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 