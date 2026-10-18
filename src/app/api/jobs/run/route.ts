import { NextResponse } from "next/server";
import { runJobs } from "@/services/jobs";

export const runtime = "nodejs";
/** Call from a cron: Authorization: Bearer $JOB_RUNNER_SECRET */
export async function POST(req: Request) {
  const secret = process.env.JOB_RUNNER_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runJobs(20));
}
