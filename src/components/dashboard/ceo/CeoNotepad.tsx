import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pin, Trash2, Save } from "lucide-react";

const CeoNotepad = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [activeNote, setActiveNote] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const { toast } = useToast();

  const fetchNotes = async () => {
    const { data } = await supabase.from("ceo_notes").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (data) {
      setNotes(data);
      if (!activeNote && data.length > 0) {
        setActiveNote(data[0]);
        setEditTitle(data[0].title);
        setEditContent(data[0].content || "");
      }
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  const addNote = async () => {
    const { data } = await supabase.from("ceo_notes").insert({ title: "Untitled Note", content: "" }).select().single();
    if (data) {
      setActiveNote(data);
      setEditTitle(data.title);
      setEditContent("");
      fetchNotes();
    }
  };

  const saveNote = async () => {
    if (!activeNote) return;
    await supabase.from("ceo_notes").update({ title: editTitle, content: editContent }).eq("id", activeNote.id);
    toast({ title: "Note saved" });
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await supabase.from("ceo_notes").delete().eq("id", id);
    if (activeNote?.id === id) { setActiveNote(null); setEditTitle(""); setEditContent(""); }
    fetchNotes();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("ceo_notes").update({ is_pinned: !pinned }).eq("id", id);
    fetchNotes();
  };

  const selectNote = (n: any) => {
    setActiveNote(n);
    setEditTitle(n.title);
    setEditContent(n.content || "");
  };

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
              placeholder="Start writing..."
            />
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
