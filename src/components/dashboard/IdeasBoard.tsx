import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Lightbulb, Pencil, Trash2, ThumbsUp, Filter, FolderOpen, FolderPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Board {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface Idea {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  submitted_by: string | null;
  assigned_to: string | null;
  votes: number;
  notes: string | null;
  due_date: string | null;
  board_id: string | null;
  created_at: string;
}

const CATEGORIES = ["General", "Music", "Content", "Business", "Marketing", "Tech", "Events", "Partnerships"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["new", "in_progress", "approved", "rejected", "completed"];

const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/20 text-primary",
  high: "bg-yellow-600/20 text-yellow-500",
  urgent: "bg-destructive/20 text-destructive",
};

const statusColor: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-destructive/20 text-destructive",
  completed: "bg-primary/20 text-primary",
};

const statusLabel: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

type FormState = {
  title: string;
  description: string;
  category: string;
  priority: string;
  assigned_to: string;
  due_date: string;
  notes: string;
  board_id: string;
};

const emptyForm: FormState = {
  title: "", description: "", category: "General", priority: "medium", assigned_to: "", due_date: "", notes: "", board_id: "none",
};

const ideaToForm = (i: Idea): FormState => ({
  title: i.title,
  description: i.description || "",
  category: i.category,
  priority: i.priority,
  assigned_to: i.assigned_to || "",
  due_date: i.due_date || "",
  notes: i.notes || "",
  board_id: i.board_id || "none",
});

const IdeasBoard = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [open, setOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [boardForm, setBoardForm] = useState({ name: "", description: "", color: "#8B5CF6" });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBoard, setFilterBoard] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();

  const loadBoards = async () => {
    const { data } = await supabase.from("idea_boards").select("*").order("sort_order").order("name");
    setBoards((data as Board[]) || []);
  };

  const loadIdeas = async () => {
    let query = supabase.from("ideas").select("*").order("votes", { ascending: false }).order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterBoard === "unassigned") query = query.is("board_id", null);
    else if (filterBoard !== "all") query = query.eq("board_id", filterBoard);
    const { data } = await query;
    setIdeas((data as Idea[]) || []);
  };

  useEffect(() => { loadBoards(); }, []);
  useEffect(() => { loadIdeas(); }, [filterStatus, filterBoard]);

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm, board_id: filterBoard !== "all" && filterBoard !== "unassigned" ? filterBoard : "none" }); setOpen(true); };
  const openEdit = (i: Idea) => { setEditingId(i.id); setForm(ideaToForm(i)); setOpen(true); };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      notes: form.notes || null,
      board_id: form.board_id === "none" ? null : form.board_id,
      ...(editingId ? {} : { submitted_by: user?.email || null }),
    };

    const { error } = editingId
      ? await supabase.from("ideas").update(payload).eq("id", editingId)
      : await supabase.from("ideas").insert(payload);

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingId ? "Idea updated" : "Idea submitted" });
    setOpen(false); setEditingId(null); setForm(emptyForm); loadIdeas();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Idea deleted" }); loadIdeas();
  };

  const handleVote = async (id: string, current: number) => {
    await supabase.from("ideas").update({ votes: current + 1 }).eq("id", id);
    loadIdeas();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from("ideas").update({ status: newStatus }).eq("id", id);
    loadIdeas();
  };

  // Board CRUD
  const openAddBoard = () => { setEditingBoardId(null); setBoardForm({ name: "", description: "", color: "#8B5CF6" }); setBoardOpen(true); };
  const openEditBoard = (b: Board) => { setEditingBoardId(b.id); setBoardForm({ name: b.name, description: b.description || "", color: b.color }); setBoardOpen(true); };

  const handleSaveBoard = async () => {
    if (!boardForm.name.trim()) { toast({ title: "Board name required", variant: "destructive" }); return; }
    const payload = { name: boardForm.name, description: boardForm.description || null, color: boardForm.color };
    const { error } = editingBoardId
      ? await supabase.from("idea_boards").update(payload).eq("id", editingBoardId)
      : await supabase.from("idea_boards").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingBoardId ? "Board updated" : "Board created" });
    setBoardOpen(false); setEditingBoardId(null); loadBoards();
  };

  const handleDeleteBoard = async (id: string) => {
    await supabase.from("idea_boards").delete().eq("id", id);
    if (filterBoard === id) setFilterBoard("all");
    toast({ title: "Board deleted" }); loadBoards(); loadIdeas();
  };

  const boardMap = boards.reduce<Record<string, Board>>((acc, b) => { acc[b.id] = b; return acc; }, {});

  const counts = {
    total: ideas.length,
    new: ideas.filter((i) => i.status === "new").length,
    in_progress: ideas.filter((i) => i.status === "in_progress").length,
    approved: ideas.filter((i) => i.status === "approved").length,
    completed: ideas.filter((i) => i.status === "completed").length,
  };

  return (
    <div className="border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-primary" />
          <h3 className="text-sm uppercase tracking-widest font-bold">Ideas Board</h3>
          <span className="text-[10px] text-muted-foreground ml-1">{counts.total} ideas</span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={boardOpen} onOpenChange={(v) => { setBoardOpen(v); if (!v) setEditingBoardId(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={openAddBoard}><FolderPlus size={14} /> Board</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{editingBoardId ? "Edit Board" : "Create Board"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Board name (e.g. Q3 Plans)" value={boardForm.name} onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })} />
                <Input placeholder="Description (optional)" value={boardForm.description} onChange={(e) => setBoardForm({ ...boardForm, description: e.target.value })} />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Color</label>
                  <input type="color" value={boardForm.color} onChange={(e) => setBoardForm({ ...boardForm, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-none" />
                </div>
                <Button onClick={handleSaveBoard} className="w-full">{editingBoardId ? "Update Board" : "Create Board"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1" onClick={openAdd}><Plus size={14} /> New Idea</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "Edit Idea" : "Submit Idea"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Idea title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="Description — what's the idea and why it matters?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Select value={form.board_id} onValueChange={(v) => setForm({ ...form, board_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select board" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Board</SelectItem>
                    {boards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: b.color }} />
                          {b.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Assign to" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
                  <Input type="date" placeholder="Due date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <Textarea placeholder="Internal notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                <Button onClick={handleSave} className="w-full">{editingId ? "Update Idea" : "Submit Idea"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Boards strip */}
      {boards.length > 0 && (
        <div className="flex gap-2 px-4 py-3 border-b border-border overflow-x-auto">
          <button
            onClick={() => setFilterBoard("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors shrink-0 ${filterBoard === "all" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterBoard("unassigned")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors shrink-0 ${filterBoard === "unassigned" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            Unassigned
          </button>
          {boards.map((b) => (
            <div key={b.id} className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setFilterBoard(b.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors ${filterBoard === b.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                {b.name}
              </button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-50 hover:opacity-100" onClick={() => openEditBoard(b)}>
                <Pencil size={10} />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-50 hover:opacity-100 hover:text-destructive">
                    <Trash2 size={10} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete board "{b.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>Ideas in this board won't be deleted — they'll become unassigned.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteBoard(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {/* Status summary bar */}
      <div className="flex gap-3 px-4 py-3 border-b border-border overflow-x-auto">
        {[
          { label: "New", count: counts.new, color: "text-blue-400" },
          { label: "In Progress", count: counts.in_progress, color: "text-yellow-400" },
          { label: "Approved", count: counts.approved, color: "text-green-400" },
          { label: "Completed", count: counts.completed, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`text-lg font-bold font-display ${s.color}`}>{s.count}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 py-2 border-b border-border items-center flex-wrap">
        <Filter size={12} className="text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Ideas list */}
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {ideas.length === 0 && (
          <p className="p-8 text-center text-muted-foreground text-sm">No ideas yet. Submit one to get started.</p>
        )}
        {ideas.map((idea) => {
          const board = idea.board_id ? boardMap[idea.board_id] : null;
          return (
            <div key={idea.id} className="p-4 hover:bg-secondary/20 transition-colors">
              <div className="flex items-start gap-3">
                {/* Vote */}
                <button
                  onClick={() => handleVote(idea.id, idea.votes)}
                  className="flex flex-col items-center gap-0.5 pt-0.5 min-w-[36px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <ThumbsUp size={14} />
                  <span className="text-xs font-bold">{idea.votes}</span>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-bold">{idea.title}</h4>
                    <Badge className={`text-[10px] ${priorityColor[idea.priority]}`}>{idea.priority}</Badge>
                    <Badge className={`text-[10px] ${statusColor[idea.status]}`}>{statusLabel[idea.status]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{idea.category}</Badge>
                    {board && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: board.color }} />
                        {board.name}
                      </Badge>
                    )}
                  </div>
                  {idea.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{idea.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {idea.submitted_by && <span>by {idea.submitted_by}</span>}
                    {idea.assigned_to && <span>→ {idea.assigned_to}</span>}
                    {idea.due_date && <span>due {idea.due_date}</span>}
                    <span>{new Date(idea.created_at).toLocaleDateString()}</span>
                  </div>
                  {idea.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">Note: {idea.notes}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Select value={idea.status} onValueChange={(v) => handleStatusChange(idea.id, v)}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] border-none bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(idea)}>
                    <Pencil size={13} />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                        <Trash2 size={13} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete idea?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete "{idea.title}".</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(idea.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IdeasBoard;
