import "server-only";
import { ForbiddenError } from "@/lib/auth";
import { ZodError } from "zod";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Consistent envelope for server actions: validation, authorization and DB errors become safe messages. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, data: await fn() }; }
  catch (e: any) {
    if (e instanceof ZodError) return { ok: false, error: "Please check the highlighted fields", fieldErrors: e.flatten().fieldErrors as any };
    if (e?.code === "42501") {
      // The review RPC uses 42501 for both role checks and resource-level rules.
      // Keep the database details private, but give reviewers an actionable reason.
      const reason = typeof e?.message === "string" ? e.message.toLowerCase() : "";
      if (reason.includes("not assigned")) return { ok: false, error: "This review is assigned to someone else. Ask an administrator to reassign it." };
      if (reason.includes("authors cannot review")) return { ok: false, error: "You cannot review a course you submitted or teach. Ask another reviewer to take it." };
      console.error("[action:forbidden]", { code: e.code, message: e.message });
      return { ok: false, error: "Your account does not have the required permission. Ask an administrator to grant course review access." };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: "Your account does not have the required permission. Ask an administrator to grant course review access." };
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    const msg = typeof e?.message === "string" && e?.code === "P0001" ? e.message : "Something went wrong. Try again.";
    if (!(e?.code === "P0001")) console.error("[action]", e);
    return { ok: false, error: msg };
  }
}
