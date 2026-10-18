import { NextResponse } from "next/server";
import { signedResourceUrl } from "@/services/storage";
/** Course resources: authorization happens first (RLS on lesson_resources), then a 5-minute signed URL is issued. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = await signedResourceUrl((await params).id);
  return url ? NextResponse.redirect(url) : NextResponse.json({ error: "Not available" }, { status: 404 });
}
