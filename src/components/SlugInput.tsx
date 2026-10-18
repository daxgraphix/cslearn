"use client";
import { useState } from "react";
import { slugify } from "@/lib/utils";
export function SlugInput() {
  const [title, setTitle] = useState(""); const [slug, setSlug] = useState(""); const [touched, setTouched] = useState(false);
  return (<>
    <div><label className="label" htmlFor="title">Course title</label><input id="title" name="title" required minLength={3} maxLength={140} className="input" value={title} onChange={(e) => { setTitle(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} /></div>
    <div><label className="label" htmlFor="slug">Web address</label><div className="flex items-center gap-2"><span className="text-sm text-ink-faint">/courses/</span><input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value); }} /></div></div></>);
}
