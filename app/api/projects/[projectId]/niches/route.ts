import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';

const CreateNicheSchema = z.object({
  name: z.string().min(1, "Niche name is required"),
});

// GET /api/projects/[projectId]/niches - List Niches for a Project
export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const projectId = params.projectId;
  console.log(`Fetching niches for project ID: ${projectId}`);

  if (!supabaseAdmin) return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });

  try {
    const { data, error } = await supabaseAdmin
      .from('niches')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error("Error fetching niches:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch niches", error: error.message }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/niches - Create Niche
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const projectId = params.projectId;
  console.log(`Creating niche for project ID: ${projectId}`);

  if (!supabaseAdmin) return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });

  try {
    const body = await req.json();
    const validation = CreateNicheSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, message: "Invalid input", errors: validation.error.format() }, { status: 400 });
    }
    const { name } = validation.data;

    const { data, error } = await supabaseAdmin
      .from('niches')
      .insert({ 
        project_id: projectId, 
        name: name.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Niche created successfully", data }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating niche:", error);
    if (error.code === '23505') { // Handle potential unique name constraint if added
      return NextResponse.json({ success: false, message: `Niche name already exists in this project.` }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "Failed to create niche", error: error.message }, { status: 500 });
  }
} 