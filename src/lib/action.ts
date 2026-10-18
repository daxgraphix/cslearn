import "server-only";
import { ForbiddenError } from "@/lib/auth";
import { ZodError } from "zod";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Consistent envelope for server actions: validation, authorization and DB errors become safe messages. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, data: await fn() }; }
  catch (e: any) {
    if (e instanceof ZodError) return { ok: false, error: "Please check the highlighted fields", fieldErrors: e.flatten().fieldErrors as any };
    if (e instanceof ForbiddenError || e?.code === "42501") return { ok: false, error: "You do not have permission to do that" };
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    const msg = typeof e?.message === "string" && e?.code === "P0001" ? e.message : "Something went wrong. Try again.";
    if (!(e?.code === "P0001")) console.error("[action]", e);
    return { ok: false, error: msg };
  }
}
