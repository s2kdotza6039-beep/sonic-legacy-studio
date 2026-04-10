import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Upload, Phone, Mail, Building, Trash2 } from "lucide-react";

const CATEGORIES = ["General", "Artist", "Business", "Legal", "Media", "Venue", "Distributor", "Other"];

const CeoContacts = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", role: "", category: "General", notes: "" });
  const { toast } = useToast();

  const fetchContacts = async () => {
    let q = supabase.from("ceo_contacts").select("*").order("name");
    if (filterCat !== "all") q = q.eq("category", filterCat);
    const { data } = await q;
    if (data) setContacts(data);
  };

  useEffect(() => { fetchContacts(); }, [filterCat]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("ceo_contacts").insert(form);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact added" });
    setForm({ name: "", email: "", phone: "", company: "", role: "", category: "General", notes: "" });
    setOpen(false);
    fetchContacts();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("ceo_contacts").delete().eq("id", id);
    fetchContacts();
  };

  const handleImportFromArtists = async () => {
    const { data: artists } = await supabase.from("artists").select("name, email, phone, genre");
    if (!artists?.length) { toast({ title: "No artists to import" }); return; }
    const toInsert = artists.map(a => ({ name: a.name, email: a.email, phone: a.phone, category: "Artist", notes: a.genre ? `Genre: ${a.genre}` : undefined }));
    await supabase.from("ceo_contacts").insert(toInsert);
    toast({ title: `Imported ${artists.length} contacts from artist pipeline` });
    fetchContacts();
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.company || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2 top-3 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={handleImportFromArtists} className="text-xs gap-1">
          <Upload size={12} /> Import Artists
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs gap-1"><Plus size={12} /> Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Company" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
                <Input placeholder="Role/Title" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
              </div>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleAdd} className="w-full">Add Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(c => (
          <Card key={c.id} className="group">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.role}{c.role && c.company ? " · " : ""}{c.company}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs bg-secondary px-1.5 py-0.5">{c.category}</span>
                  <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                {c.email && <span className="flex items-center gap-1"><Mail size={10} /> {c.email}</span>}
                {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
              </div>
              {c.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{c.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p>}
    </div>
  );
};

export default CeoContacts;
