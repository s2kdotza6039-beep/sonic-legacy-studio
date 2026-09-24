import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pin, Trash2, Save, ImagePlus, X } from "lucide-react";

type Att = { type?: string; url: string; alt?: string };
const MD_IMG = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
const mdImages = (text: string): Att[] => Array.from(text.matchAll(MD_IMG)).map(m => ({ url: m[2], alt: m[1] }));

const CeoNotepad = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [activeNote, setActiveNote] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAtt, setEditAtt] = useState<Att[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const { toast } = useToast();

  const fetchNotes = async () => {
    const { data, error } = await supabase.from("ceo_notes").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (error) { toast({ title: "Could not load notes", description: error.message, variant: "destructive" }); return; }
    setNotes(data ?? []);
    if (!activeNote && data && data.length > 0) {
      setActiveNote(data[0]);
      setEditTitle(data[0].title);
      setEditContent(data[0].content || "");
      setEditAtt(Array.isArray(data[0].attachments) ? data[0].attachments : []);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  // Live updates so notes saved by Sydney appear without a reload.
  useEffect(() => {
    const ch = supabase
      .channel("ceo_notes_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ceo_notes" }, () => fetchNotes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addNote = async () => {
    const { data, error } = await supabase.from("ceo_notes").insert({ title: "Untitled Note", content: "" }).select().single();
    if (error) { toast({ title: "Could not create note", description: error.message, variant: "destructive" }); return; }
    if (data) {
      setActiveNote(data);
      setEditTitle(data.title);
      setEditContent("");
      setEditAtt([]);
      fetchNotes();
    }
  };

  const saveNote = async () => {
    if (!activeNote) return;
    const { error } = await supabase.from("ceo_notes").update({ title: editTitle, content: editContent, attachments: editAtt as any }).eq("id", activeNote.id);
    if (error) { toast({ title: "Could not save note", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Note saved" });
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("ceo_notes").delete().eq("id", id);
    if (error) { toast({ title: "Could not delete note", description: error.message, variant: "destructive" }); return; }
    if (activeNote?.id === id) { setActiveNote(null); setEditTitle(""); setEditContent(""); }
    fetchNotes();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from("ceo_notes").update({ is_pinned: !pinned }).eq("id", id);
    if (error) { toast({ title: "Could not pin note", description: error.message, variant: "destructive" }); return; }
    fetchNotes();
  };

  const selectNote = (n: any) => {
    setActiveNote(n);
    setEditTitle(n.title);
    setEditContent(n.content || "");
    setEditAtt(Array.isArray(n.attachments) ? n.attachments : []);
  };

  const addImage = () => {
    const url = newUrl.trim();
    if (!/^https:\/\/\S+$/i.test(url)) { toast({ title: "Use a public https image link", variant: "destructive" }); return; }
    setEditAtt(a => [...a, { type: "image", url, alt: "" }]);
    setNewUrl("");
  };

  const shownImages = [...editAtt, ...mdImages(editContent)];

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[400px]">
      {/* Notes list */}
      <div className="border border-border p-3 space-y-2">
        <Button size="sm" onClick={addNote} className="w-full text-xs gap-1"><Plus size={12} /> New Note</Button>
        <div className="space-y-1 max-h-[350px] overflow-y-auto">
          {notes.map(n => (
            <div
              key={n.id}
              onClick={() => selectNote(n)}
              className={`p-2 cursor-pointer border text-sm group flex justify-between items-start ${activeNote?.id === n.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            >
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

      {/* Editor */}
      <div className="md:col-span-2 border border-border p-4 flex flex-col gap-3">
        {activeNote ? (
          <>
            <div className="flex gap-2">
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-medium text-sm" placeholder="Note title" />
              <Button size="sm" onClick={saveNote} className="gap-1 text-xs shrink-0"><Save size={12} /> Save</Button>
            </div>
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="flex-1 min-h-[300px] resize-none text-sm"
              placeholder="Start writing... (images: ![caption](https://link))"
            />
            <div className="flex gap-2">
              <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Paste image link (https://...)" className="text-xs" />
              <Button size="sm" variant="outline" onClick={addImage} className="gap-1 text-xs shrink-0"><ImagePlus size={12} /> Add image</Button>
            </div>
            {shownImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shownImages.map((img, i) => (
                  <figure key={`${img.url}-${i}`} className="relative border border-border bg-secondary/30">
                    <a href={img.url} target="_blank" rel="noopener noreferrer">
                      <img src={img.url} alt={img.alt || "Note image"} loading="lazy" className="w-full h-auto max-h-80 object-contain" />
                    </a>
                    {img.alt && <figcaption className="text-xs text-muted-foreground p-2">{img.alt}</figcaption>}
                    {i < editAtt.length && (
                      <button onClick={() => setEditAtt(a => a.filter((_, j) => j !== i))} aria-label="Remove image" className="absolute top-1 right-1 bg-background/80 p-1 text-muted-foreground hover:text-destructive"><X size={12} /></button>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  );
};

export default CeoNotepad;
