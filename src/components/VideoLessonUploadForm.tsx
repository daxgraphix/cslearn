"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
function safeName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100) || "lesson.mp4";
}

export function VideoLessonUploadForm({ courseId, versionId, moduleId }: { courseId: string; versionId: string; moduleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const file = values.get("video");
    const duration = String(values.get("durationMinutes") ?? "").trim();
    if (title.length < 2 || title.length > 160) { setMessage("Enter a lesson title between 2 and 160 characters."); return; }
    if (!(file instanceof File) || !file.size) { setMessage("Choose an MP4 video to upload."); return; }
    if (file.size > MAX_VIDEO_BYTES) { setMessage("This video is over the 100 MB limit. Compress it or add a hosted video link instead."); return; }
    if ((file.type && file.type !== "video/mp4") || !file.name.toLowerCase().endsWith(".mp4")) { setMessage("Upload an MP4 video file."); return; }
    if (duration && (!/^\d+$/.test(duration) || Number(duration) > 1000)) { setMessage("Enter a duration from 1 to 1000 minutes."); return; }

    setBusy(true); setMessage("Checking course access…");
    const supabase = createBrowserSupabase();
    let lessonId = "";
    let storagePath = "";
    try {
      const { data: version, error: versionError } = await supabase.from("course_versions").select("id, course_id, status").eq("id", versionId).single();
      if (versionError || !version || version.course_id !== courseId || !["draft", "changes_requested"].includes(version.status)) {
        throw new Error("This course version is no longer editable. Refresh the page and try again.");
      }
      const { data: module, error: moduleError } = await supabase.from("modules").select("id, version_id").eq("id", moduleId).single();
      if (moduleError || !module || module.version_id !== versionId) throw new Error("This module is not part of the editable course version.");
      const { data: last, error: orderError } = await supabase.from("lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1);
      if (orderError) throw orderError;
      const { data: lesson, error: lessonError } = await supabase.from("lessons").insert({
        module_id: moduleId,
        title,
        type: "video",
        position: (last?.[0]?.position ?? -1) + 1,
        duration_minutes: duration ? Number(duration) : null,
        is_required: values.get("isRequired") === "on",
        body: {},
        completion_rule: { mode: "watch_percent", threshold: 90 },
      }).select("id").single();
      if (lessonError || !lesson) throw lessonError ?? new Error("Could not create the video lesson.");
      lessonId = lesson.id;

      storagePath = `${courseId}/${moduleId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      setMessage("Uploading video… keep this page open until the upload finishes.");
      const { error: uploadError } = await supabase.storage.from("course-private").upload(storagePath, file, {
        contentType: "video/mp4", upsert: false, cacheControl: "3600",
      });
      if (uploadError) throw uploadError;

      const { data: resource, error: resourceError } = await supabase.from("lesson_resources").insert({
        lesson_id: lessonId, title: file.name.slice(0, 180), kind: "file", storage_path: storagePath,
        mime_type: "video/mp4", size_bytes: file.size,
      }).select("id").single();
      if (resourceError || !resource) throw resourceError ?? new Error("Could not attach the uploaded video to the lesson.");
      const { error: bodyError } = await supabase.from("lessons").update({ body: { resource_id: resource.id } }).eq("id", lessonId);
      if (bodyError) throw bodyError;

      form.reset();
      setMessage("Video lesson added.");
      router.refresh();
    } catch (error) {
      console.error("[course:video-upload]", error);
      if (storagePath) await supabase.storage.from("course-private").remove([storagePath]).catch(() => undefined);
      if (lessonId) await supabase.from("lessons").delete().eq("id", lessonId);
      setMessage(error instanceof Error ? error.message : "The video could not be uploaded. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={upload} className="space-y-3 rounded-xl border border-surface-line bg-white p-4">
    <div><h4 className="font-semibold text-ink">Upload an MP4</h4><p className="mt-1 text-xs leading-5 text-ink-soft">Private course storage · up to 100 MB. Learners can stream it after enrollment.</p></div>
    <label className="label">Lesson title<input name="title" className="input mt-1" required minLength={2} maxLength={160} placeholder="For example, Introduction to the topic" /></label>
    <label className="label">Video file<input name="video" type="file" accept="video/mp4,.mp4" className="input mt-1" required /></label>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="label">Duration in minutes <span className="font-normal text-ink-faint">(optional)</span><input name="durationMinutes" type="number" min={1} max={1000} className="input mt-1" placeholder="e.g. 12" /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft"><input type="checkbox" name="isRequired" defaultChecked className="accent-brand" />Required lesson</label>
    </div>
    <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Uploading video…" : "Upload video lesson"}</button>
    {message && <p className="text-sm text-ink-soft" role="status" aria-live="polite">{message}</p>}
  </form>;
}
