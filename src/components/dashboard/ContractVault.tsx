import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Pencil, Trash2, Upload, Download, Search, Filter, Eye, BookTemplate } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ContractTemplates from "./ContractTemplates";

interface Contract {
  id: string;
  title: string;
  description: string | null;
  contract_type: string;
  status: string;
  party_name: string | null;
  file_url: string | null;
  file_name: string | null;
  value: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const TYPES = ["Artist", "Brand", "Distribution", "Licensing", "Publishing", "Sync", "Management", "General"];
const STATUSES = ["draft", "pending", "active", "expired", "terminated"];

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-500/20 text-yellow-400",
  active: "bg-green-500/20 text-green-400",
  expired: "bg-destructive/20 text-destructive",
  terminated: "bg-destructive/20 text-destructive",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

type FormState = {
  title: string;
  description: string;
  contract_type: string;
  status: string;
  party_name: string;
  value: string;
  start_date: string;
  end_date: string;
  notes: string;
};

const emptyForm: FormState = {
  title: "", description: "", contract_type: "General", status: "draft",
  party_name: "", value: "", start_date: "", end_date: "", notes: "",
};

const ContractVault = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [open, setOpen] = useState(false);
  const [readContract, setReadContract] = useState<Contract | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const load = async () => {
    let query = supabase.from("contracts").select("*").order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterType !== "all") query = query.eq("contract_type", filterType);
    if (search) query = query.or(`title.ilike.%${search}%,party_name.ilike.%${search}%`);
    const { data } = await query;
    setContracts((data as Contract[]) || []);
  };

  useEffect(() => { load(); }, [filterStatus, filterType, search]);

  const [activeTab, setActiveTab] = useState("contracts");

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Contract) => {
    setEditingId(c.id);
    setForm({
      title: c.title, description: c.description || "", contract_type: c.contract_type,
      status: c.status, party_name: c.party_name || "", value: c.value?.toString() || "",
      start_date: c.start_date || "", end_date: c.end_date || "", notes: c.notes || "",
    });
    setOpen(true);
  };

  const handleUseTemplate = (template: any) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      title: `${template.title} - Copy`,
      description: template.description || "",
      contract_type: template.contract_type,
      notes: template.content || "",
    });
    setActiveTab("contracts");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = {
      title: form.title,
      description: form.description || null,
      contract_type: form.contract_type,
      status: form.status,
      party_name: form.party_name || null,
      value: form.value ? parseFloat(form.value) : 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
      ...(editingId ? {} : { created_by: user?.email || null }),
    };
    const { error } = editingId
      ? await supabase.from("contracts").update(payload).eq("id", editingId)
      : await supabase.from("contracts").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingId ? "Contract updated" : "Contract added" });
    setOpen(false); setEditingId(null); setForm(emptyForm); load();
  };

  const handleDelete = async (id: string) => {
    const contract = contracts.find(c => c.id === id);
    if (contract?.file_url) {
      const path = contract.file_url.split("/contract-files/")[1];
      if (path) await supabase.storage.from("contract-files").remove([path]);
    }
    await supabase.from("contracts").delete().eq("id", id);
    toast({ title: "Contract deleted" }); load();
  };

  const handleFileUpload = async (contractId: string, file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${contractId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("contract-files").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("contract-files").getPublicUrl(path);
    await supabase.from("contracts").update({ file_url: urlData.publicUrl, file_name: file.name }).eq("id", contractId);
    toast({ title: "File uploaded" }); setUploading(false); load();
  };

  const handleDownload = async (contract: Contract) => {
    if (!contract.file_url) return;
    const path = contract.file_url.split("/contract-files/")[1];
    if (!path) return;
    const { data, error } = await supabase.storage.from("contract-files").download(path);
    if (error || !data) { toast({ title: "Download failed", variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = contract.file_name || "contract"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: contract.file_name || "contract" });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from("contracts").update({ status }).eq("id", id);
    load();
  };

  const visibleContracts = contracts.filter((c) => {
    if (filterValue === "high") return (c.value || 0) >= 100000;
    if (filterValue === "medium") return (c.value || 0) > 0 && (c.value || 0) < 100000;
    if (filterValue === "none") return !c.value;
    return true;
  });

  const counts = {
    total: contracts.length,
    active: contracts.filter(c => c.status === "active").length,
    pending: contracts.filter(c => c.status === "pending").length,
    draft: contracts.filter(c => c.status === "draft").length,
    totalValue: contracts.filter(c => c.status === "active").reduce((sum, c) => sum + (c.value || 0), 0),
  };

  return (
    <div className="border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          <h3 className="text-sm uppercase tracking-widest font-bold">Contract Vault</h3>
          <span className="text-[10px] text-muted-foreground ml-1">{counts.total} contracts</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-3">
          <TabsList className="h-8">
            <TabsTrigger value="contracts" className="text-xs gap-1"><FileText size={12} /> Contracts</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs gap-1"><BookTemplate size={12} /> Templates</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contracts" className="mt-0">
          {/* Summary bar */}
          <div className="flex gap-4 px-4 py-3 border-b border-border overflow-x-auto">
            {[
              { label: "Active", count: counts.active, color: "text-green-400" },
              { label: "Pending", count: counts.pending, color: "text-yellow-400" },
              { label: "Draft", count: counts.draft, color: "text-muted-foreground" },
              { label: "Total Value", count: `R${counts.totalValue.toLocaleString()}`, color: "text-primary" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`text-lg font-bold font-display ${s.color}`}>{s.count}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 px-4 py-2 border-b border-border items-center flex-wrap">
            <Search size={12} className="text-muted-foreground" />
            <Input placeholder="Search contracts..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-[160px] text-xs" />
            <Filter size={12} className="text-muted-foreground ml-1" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Value</SelectItem>
                <SelectItem value="high">High (R100k+)</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="none">No value</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 ml-auto" onClick={openAdd}><Plus size={14} /> New Contract</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Edit Contract" : "Add Contract"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Contract title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <Input placeholder="Party / counterpart name" value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
                  <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="Contract value (R)" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Start Date</label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-widest">End Date</label>
                      <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    </div>
                  </div>
                  <Textarea placeholder="Internal notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  <Button onClick={handleSave} className="w-full">{editingId ? "Update Contract" : "Add Contract"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Contract list */}
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {contracts.length === 0 && (
              <p className="p-8 text-center text-muted-foreground text-sm">No contracts yet. Add one to get started.</p>
            )}
            {contracts.length > 0 && visibleContracts.length === 0 && (
              <p className="p-8 text-center text-muted-foreground text-sm">No contracts match your filters.</p>
            )}
            {visibleContracts.map(contract => (
              <div key={contract.id} className="p-4 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-primary mt-0.5 shrink-0" />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setReadContract(contract)}
                    onKeyDown={(e) => { if (e.key === "Enter") setReadContract(contract); }}
                  >

                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-bold">{contract.title}</h4>
                      <Badge className={`text-[10px] ${statusColor[contract.status]}`}>{statusLabel[contract.status]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{contract.contract_type}</Badge>
                      {contract.value > 0 && <Badge variant="outline" className="text-[10px] text-primary">R{contract.value.toLocaleString()}</Badge>}
                    </div>
                    {contract.party_name && <p className="text-xs text-muted-foreground mb-1">Party: <span className="text-foreground">{contract.party_name}</span></p>}
                    {contract.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{contract.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {contract.start_date && <span>Start: {contract.start_date}</span>}
                      {contract.end_date && <span>End: {contract.end_date}</span>}
                      {contract.file_name && <span className="flex items-center gap-1"><FileText size={10} />{contract.file_name}</span>}
                      <span>{new Date(contract.created_at).toLocaleDateString()}</span>
                    </div>
                    {contract.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">Note: {contract.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Select value={contract.status} onValueChange={(v) => handleStatusChange(contract.id, v)}>
                      <SelectTrigger className="h-7 w-[90px] text-[10px] border-none bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
                    </Select>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="cursor-pointer">
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(contract.id, e.target.files[0]); }} />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild disabled={uploading}>
                              <span><Upload size={13} /></span>
                            </Button>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>Upload file</TooltipContent>
                      </Tooltip>

                      {contract.file_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(contract)}>
                              <Download size={13} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download file</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setReadContract(contract)}>
                            <Eye size={13} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Read contract</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(contract)}>
                            <Pencil size={13} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit contract</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" title="Delete contract" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>

                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete contract?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete "{contract.title}" and its uploaded file.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(contract.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-0 p-4">
          <ContractTemplates onUseTemplate={handleUseTemplate} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!readContract} onOpenChange={(v) => { if (!v) setReadContract(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="pr-6">{readContract?.title}</DialogTitle></DialogHeader>
          {readContract && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={`text-[10px] ${statusColor[readContract.status]}`}>{statusLabel[readContract.status]}</Badge>
                <Badge variant="outline" className="text-[10px]">{readContract.contract_type}</Badge>
                {readContract.value > 0 && <Badge variant="outline" className="text-[10px] text-primary">R{readContract.value.toLocaleString()}</Badge>}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Party</p>
                <p className="text-sm">{readContract.party_name || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{readContract.description || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{readContract.notes || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t border-border pt-3">
                <span>Start: <span className="text-foreground">{readContract.start_date || "—"}</span></span>
                <span>End: <span className="text-foreground">{readContract.end_date || "—"}</span></span>
                <span className="col-span-2">File: <span className="text-foreground">{readContract.file_name || "No file uploaded"}</span></span>
                <span className="col-span-2">Created: <span className="text-foreground">{new Date(readContract.created_at).toLocaleString()}</span></span>
              </div>
              <div className="flex gap-2 justify-end">
                {readContract.file_url && <Button variant="outline" onClick={() => handleDownload(readContract)}>Download</Button>}
                <Button variant="outline" onClick={() => setReadContract(null)}>Close</Button>
                <Button onClick={() => { const c = readContract; setReadContract(null); openEdit(c); }}>Edit</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default ContractVault;
