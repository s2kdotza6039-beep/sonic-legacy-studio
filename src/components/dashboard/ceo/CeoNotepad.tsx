import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pin, Trash2, Save, ImagePlus, X, Upload, Lock, ImageOff, RotateCw } from "lucide-react";

const BUCKET = "ceo-note-media";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 20;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

type Att = { type?: string; source?: "url" | "storage"; url?: string; path?: string; alt?: string; name?: string; mime?: string; size?: number };
type Pending = { id: string; file: File; preview: string; alt: string; status: "ready" | "uploading" | "failed"; progress: number; error?: string };

const MD_IMG = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
const mdImages = (text: string): Att[] => Array.from(text.matchAll(MD_IMG)).map(m => ({ source: "url", url: m[2], alt: m[1] }));
const sanitize = (n: string) => n.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
const isStorage = (a: Att) => a.source === "storage" && !!a.path;

const CeoNotepad = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [activeNote, setActiveNote] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAtt, setEditAtt] = useState<Att[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;
  const { toast } = useToast();

  const loadAtt = (n: any): Att[] => Array.isArray(n?.attachments) ? (n.attachments as Att[]).map(a => ({ ...a, source: a.source ?? (a.path ? "storage" : "url") })) : [];

  const fetchNotes = async () => {
    const { data, error } = await supabase.from("ceo_notes").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (error) { toast({ title: "Could not load notes", description: error.message, variant: "destructive" }); return; }
    setNotes(data ?? []);
    if (!activeNote && data && data.length > 0) selectNote(data[0]);
  };

  useEffect(() => { fetchNotes(); }, []);
  useEffect(() => {
    const ch = supabase.channel("ceo_notes_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ceo_notes" }, () => fetchNotes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  // Revoke preview object URLs on unmount.
  useEffect(() => () => { pendingRef.current.forEach(p => URL.revokeObjectURL(p.preview)); }, []);

  // Fresh short-lived signed URLs for private images whenever the attachment list changes.
  const refreshSigned = useCallback(async (atts: Att[]) => {
    const paths = atts.filter(isStorage).map(a => a.path!);
    if (!paths.length) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    if (error) { toast({ title: "Could not load private images", description: error.message, variant: "destructive" }); return; }
    const map: Record<string, string> = {};
    data?.forEach(d => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl; });
    setSigned(s => ({ ...s, ...map }));
    setBroken(b => { const n = { ...b }; paths.forEach(p => delete n[p]); return n; });
  }, [toast]);
  useEffect(() => { refreshSigned(editAtt); }, [editAtt, refreshSigned]);

  const clearPending = () => { pendingRef.current.forEach(p => URL.revokeObjectURL(p.preview)); setPending([]); };

  const selectNote = (n: any) => {
    clearPending();
    setActiveNote(n);
    setEditTitle(n.title);
    setEditContent(n.content || "");
    setEditAtt(loadAtt(n));
  };

  const addNote = async () => {
    const { data, error } = await supabase.from("ceo_notes").insert({ title: "Untitled Note", content: "" }).select().single();
    if (error) { toast({ title: "Could not create note", description: error.message, variant: "destructive" }); return; }
    if (data) { selectNote(data); fetchNotes(); }
  };

  const addFiles = (files: File[]) => {
    if (!activeNote) { toast({ title: "Open or create a note first", variant: "destructive" }); return; }
    const room = MAX_IMAGES - editAtt.length - pendingRef.current.length;
    const accepted: Pending[] = [];
    for (const f of files) {
      if (!OK_TYPES.includes(f.type)) { toast({ title: `${f.name || "File"} isn't supported`, description: "Use JPG, PNG, WebP or GIF.", variant: "destructive" }); continue; }
      if (f.size > MAX_BYTES) { toast({ title: `${f.name} is too large`, description: "Images must be 10 MB or smaller.", variant: "destructive" }); continue; }
      if (accepted.length >= room) { toast({ title: `A note can hold at most ${MAX_IMAGES} images`, variant: "destructive" }); break; }
      accepted.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), alt: "", status: "ready", progress: 0 });
    }
    if (accepted.length) setPending(p => [...p, ...accepted]);
  };

  const removePending = (id: string) => setPending(p => {
    const x = p.find(i => i.id === id); if (x) URL.revokeObjectURL(x.preview);
    return p.filter(i => i.id !== id);
  });

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return; // ordinary text paste untouched
    e.preventDefault();
    addFiles(files.map((f, i) => f.name && f.name !== "image.png" ? f : new File([f], `pasted-${Date.now()}-${i}.${EXT[f.type] ?? "png"}`, { type: f.type })));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (!files.length) return;
    addFiles(files);
  };

  // Upload all pending files, then write metadata. Success only when both succeed.
  const saveNote = async () => {
    if (!activeNote) return;
    if (!user) { toast({ title: "Sign in again to save", variant: "destructive" }); return; }
    setSaving(true);
    const uploaded: Att[] = [];
    const uploadedIds: string[] = [];
    for (const p of pendingRef.current) {
      setPending(list => list.map(i => i.id === p.id ? { ...i, status: "uploading", progress: 10, error: undefined } : i));
      const path = `${user.id}/${activeNote.id}/${crypto.randomUUID()}-${sanitize(p.file.name)}.${EXT[p.file.type]}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, p.file, { contentType: p.file.type, upsert: false });
      if (error) {
        setPending(list => list.map(i => i.id === p.id ? { ...i, status: "failed", progress: 0, error: error.message } : i));
        continue;
      }
      setPending(list => list.map(i => i.id === p.id ? { ...i, progress: 100 } : i));
      uploaded.push({ type: "image", source: "storage", path, alt: p.alt.trim(), name: p.file.name, mime: p.file.type, size: p.file.size });
      uploadedIds.push(p.id);
    }
    const nextAtt = [...editAtt, ...uploaded];
    const { error } = await supabase.from("ceo_notes").update({ title: editTitle, content: editContent, attachments: nextAtt as any }).eq("id", activeNote.id);
    setSaving(false);
    if (error) {
      // Metadata failed: remove the orphaned uploads so storage matches the note.
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded.map(u => u.path!));
      setPending(list => list.map(i => uploadedIds.includes(i.id) ? { ...i, status: "failed", progress: 0, error: "Note didn't save" } : i));
      toast({ title: "Could not save note", description: error.message, variant: "destructive" });
      return;
    }
    setEditAtt(nextAtt);
    setPending(list => { list.filter(i => uploadedIds.includes(i.id)).forEach(i => URL.revokeObjectURL(i.preview)); return list.filter(i => !uploadedIds.includes(i.id)); });
    const failed = pendingRef.current.length - uploadedIds.length;
    if (failed > 0) toast({ title: "Note saved, but some images failed", description: "Check the failed images below and try again.", variant: "destructive" });
    else toast({ title: uploaded.length ? `Note saved with ${uploaded.length} new image${uploaded.length > 1 ? "s" : ""}` : "Note saved" });
    fetchNotes();
  };

  const removeSaved = async (idx: number) => {
    if (!activeNote) return;
    const att = editAtt[idx];
    if (isStorage(att) && !confirm("Remove this image permanently?")) return;
    if (isStorage(att)) {
      if (!user || !att.path!.startsWith(`${user.id}/`)) { toast({ title: "You don't own this image", variant: "destructive" }); return; }
    }
    const next = editAtt.filter((_, j) => j !== idx);
    const { error } = await supabase.from("ceo_notes").update({ attachments: next as any }).eq("id", activeNote.id);
    if (error) { toast({ title: "Could not remove image", description: error.message, variant: "destructive" }); return; }
    setEditAtt(next);
    if (isStorage(att)) {
      const { data, error: se } = await supabase.storage.from(BUCKET).remove([att.path!]);
      if (se || !data?.length) { toast({ title: "Image removed from note, but file cleanup failed", description: se?.message ?? "The file was not deleted from storage.", variant: "destructive" }); return; }
    }
    toast({ title: "Image removed" });
  };

  const deleteNote = async (id: string) => {
    const note = notes.find(n => n.id === id);
    const paths = loadAtt(note).filter(isStorage).map(a => a.path!);
    const { error } = await supabase.from("ceo_notes").delete().eq("id", id);
    if (error) { toast({ title: "Could not delete note", description: error.message, variant: "destructive" }); return; }
    if (paths.length) {
      const { error: se } = await supabase.storage.from(BUCKET).remove(paths);
      if (se) toast({ title: "Note deleted, but its images weren't cleaned up", description: se.message, variant: "destructive" });
    }
    if (activeNote?.id === id) { setActiveNote(null); setEditTitle(""); setEditContent(""); setEditAtt([]); clearPending(); }
    fetchNotes();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from("ceo_notes").update({ is_pinned: !pinned }).eq("id", id);
    if (error) { toast({ title: "Could not pin note", description: error.message, variant: "destructive" }); return; }
    fetchNotes();
  };

  const addImageLink = () => {
    const url = newUrl.trim();
    if (!/^https:\/\/\S+$/i.test(url)) { toast({ title: "Use a public https image link", variant: "destructive" }); return; }
    if (editAtt.length + pending.length >= MAX_IMAGES) { toast({ title: `A note can hold at most ${MAX_IMAGES} images`, variant: "destructive" }); return; }
    setEditAtt(a => [...a, { type: "image", source: "url", url, alt: "" }]);
    setNewUrl("");
  };

  const srcOf = (a: Att) => isStorage(a) ? signed[a.path!] : a.url;
  const keyOf = (a: Att) => a.path ?? a.url ?? "";
  const mdAtt = mdImages(editContent);

  const renderImg = (a: Att, i: number, removable: boolean) => {
    const src = srcOf(a); const k = keyOf(a);
    return (
      <figure key={`${k}-${i}`} className="relative border border-border bg-secondary/30">
        {src && !broken[k] ? (
          <img src={src} alt={a.alt || a.name || "Note image"} loading="lazy" onError={() => setBroken(b => ({ ...b, [k]: true }))} className="w-full h-auto max-h-80 object-contain" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 h-40 text-muted-foreground text-xs">
            <ImageOff size={20} /> {src ? "Image unavailable" : "Loading…"}
            {isStorage(a) && <button onClick={() => refreshSigned([a])} className="underline flex items-center gap-1"><RotateCw size={10} /> Reload</button>}
          </div>
        )}
        {a.alt && <figcaption className="text-xs text-muted-foreground p-2">{a.alt}</figcaption>}
        {removable && (
          <button onClick={() => removeSaved(i)} aria-label="Remove image" className="absolute top-1 right-1 bg-background/80 p-1 text-muted-foreground hover:text-destructive"><X size={12} /></button>
        )}
      </figure>
    );
  };

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[400px]">
      <div className="border border-border p-3 space-y-2">
        <Button size="sm" onClick={addNote} className="w-full text-xs gap-1"><Plus size={12} /> New Note</Button>
        <div className="space-y-1 max-h-[350px] overflow-y-auto">
          {notes.map(n => (
            <div key={n.id} onClick={() => selectNote(n)}
              className={`p-2 cursor-pointer border text-sm group flex justify-between items-start ${activeNote?.id === n.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  {n.is_pinned && <Pin size={10} className="text-primary shrink-0" />}
                  <p className="font-medium truncate text-xs">{n.title}</p>
                </div>
                <p className="text-xs text-muted-foreground truncate">{n.content?.slice(0, 50) || "Empty"}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); togglePin(n.id, n.is_pinned); }} className="text-muted-foreground hover:text-primary"><Pin size={10} /></button>
                <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`md:col-span-2 border p-4 flex flex-col gap-3 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        onPaste={onPaste}
        onDragOver={(e) => { if (activeNote) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={onDrop}
      >
        {activeNote ? (
          <>
            <div className="flex gap-2">
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-medium text-sm" placeholder="Note title" />
              <Button size="sm" onClick={saveNote} disabled={saving} className="gap-1 text-xs shrink-0"><Save size={12} /> {saving ? "Saving…" : "Save"}</Button>
            </div>
            <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1 min-h-[260px] resize-none text-sm"
              placeholder="Start writing… You can also paste or drop images here." />

            <div className={`border border-dashed p-3 text-center text-xs ${dragOver ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden"
                onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1 text-xs"><Upload size={12} /> Upload image</Button>
              <p className="mt-2">or drag images here, or paste one. JPG, PNG, WebP, GIF · up to 10 MB each · {MAX_IMAGES} per note</p>
              <p className="mt-1 flex items-center justify-center gap-1"><Lock size={10} /> Founder-private image storage. These images are not public website assets.</p>
            </div>

            {pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Not saved yet — click Save to upload.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pending.map(p => (
                    <div key={p.id} className="border border-border p-2 space-y-2 relative">
                      <img src={p.preview} alt={p.alt || p.file.name} className="w-full max-h-48 object-contain" />
                      <Input value={p.alt} onChange={e => setPending(l => l.map(i => i.id === p.id ? { ...i, alt: e.target.value } : i))} placeholder="Caption (optional)" className="h-8 text-xs" disabled={p.status === "uploading"} />
                      {p.status === "uploading" && <Progress value={p.progress} className="h-1" />}
                      {p.status === "failed" && <p className="text-[11px] text-destructive">Upload failed: {p.error}. Click Save to retry.</p>}
                      <button onClick={() => removePending(p.id)} disabled={p.status === "uploading"} aria-label="Cancel image" className="absolute top-1 right-1 bg-background/80 p-1 text-muted-foreground hover:text-destructive"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(editAtt.length > 0 || mdAtt.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {editAtt.map((a, i) => renderImg(a, i, true))}
                {mdAtt.map((a, i) => renderImg(a, editAtt.length + i, false))}
              </div>
            )}

            <div className="flex gap-2">
              <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Add public image link (https://…) — optional" className="text-xs" />
              <Button size="sm" variant="outline" onClick={addImageLink} className="gap-1 text-xs shrink-0"><ImagePlus size={12} /> Add public image link</Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a note or create a new one</div>
        )}
      </div>
    </div>
  );
};

export default CeoNotepad;
