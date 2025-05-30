import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';

const UpdateNicheSchema = z.object({
  name: z.string().min(1, "Niche name is required"),
});

// PUT /api/niches/[nicheId] - Update Niche Name
export async function PUT(
  req: NextRequest,
  { params }: { params: { nicheId: string } }
) {
  const nicheId = params.nicheId;
  console.log(`Updating niche ID: ${nicheId}`);

  if (!supabaseAdmin) return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });

  try {
    const body = await req.json();
    const validation = UpdateNicheSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, message: "Invalid input", errors: validation.error.format() }, { status: 400 });
    }
    const { name } = validation.data;

    const { data, error } = await supabaseAdmin
      .from('niches')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', nicheId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, message: "Niche not found" }, { status: 404 });

    return NextResponse.json({ success: true, message: "Niche updated successfully", data });
  } catch (error: any) {
    console.error("Error updating niche:", error);
    return NextResponse.json({ success: false, message: "Failed to update niche", error: error.message }, { status: 500 });
  }
}

// DELETE /api/niches/[nicheId] - Delete Niche
export async function DELETE(
  req: NextRequest,
  { params }: { params: { nicheId: string } }
) {
  const nicheId = params.nicheId;
  console.log(`Deleting niche ID: ${nicheId}`);

  if (!supabaseAdmin) return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });

  try {
    // Delete the niche (associated files and clusters will be automatically deleted via CASCADE)
    const { error } = await supabaseAdmin
      .from('niches')
      .delete()
      .eq('id', nicheId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Niche deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting niche:", error);
    return NextResponse.json({ success: false, message: "Failed to delete niche", error: error.message }, { status: 500 });
  }
} 