"use client";
import { useState } from "react";
import { slugify } from "@/lib/utils";
export function SlugInput() {
  const [title, setTitle] = useState(""); const [slug, setSlug] = useState(""); const [touched, setTouched] = useState(false);
  const resetSlug = () => { setSlug(slugify(title)); setTouched(false); };
  return (<>
    <div><label className="label" htmlFor="title">Course title</label><input id="title" name="title" required minLength={3} maxLength={140} className="input" value={title} onChange={(e) => { setTitle(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} placeholder="For example, Introduction to Data Literacy" /></div>
    <div><div className="flex items-center justify-between gap-2"><label className="label" htmlFor="slug">Course web address</label><button type="button" onClick={resetSlug} className="text-xs font-medium text-brand hover:underline" disabled={!title}>Use title</button></div><div className="flex items-center gap-2"><span className="shrink-0 text-sm text-ink-faint">/courses/</span><input id="slug" name="slug" required minLength={3} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="slug-help" className="input" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value); }} /></div><p id="slug-help" className="mt-1 text-xs text-ink-faint">Lowercase letters, numbers, and hyphens. This address is used in the public course link.</p></div></>);
}
