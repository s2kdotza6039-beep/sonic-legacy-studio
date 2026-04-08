import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Pencil, Trash2, Upload, Download, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ContractTemplate {
  id: string;
  title: string;
  description: string | null;
  contract_type: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  created_by: string | null;
  created_at: string;
}

const TYPES = ["Artist", "Brand", "Distribution", "Licensing", "Publishing", "Sync", "Management", "General"];

type TemplateForm = {
  title: string;
  description: string;
  contract_type: string;
  content: string;
};

const emptyForm: TemplateForm = {
  title: "", description: "", contract_type: "General", content: "",
};

interface ContractTemplatesProps {
  onUseTemplate?: (template: ContractTemplate) => void;
}

const ContractTemplates = ({ onUseTemplate }: ContractTemplatesProps) => {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [filterType, setFilterType] = useState("all");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const load = async () => {
    let query = supabase.from("contract_templates").select("*").order("created_at", { ascending: false });
    if (filterType !== "all") query = query.eq("contract_type", filterType);
    const { data } = await query;
    setTemplates((data as ContractTemplate[]) || []);
  };

  useEffect(() => { load(); }, [filterType]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (t: ContractTemplate) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description || "",
      contract_type: t.contract_type,
      content: t.content || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = {
      title: form.title,
      description: form.description || null,
      contract_type: form.contract_type,
      content: form.content || null,
      ...(editingId ? {} : { created_by: user?.email || null }),
    };
    const { error } = editingId
      ? await supabase.from("contract_templates").update(payload).eq("id", editingId)
      : await supabase.from("contract_templates").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingId ? "Template updated" : "Template added" });
    setOpen(false); setEditingId(null); setForm(emptyForm); load();
  };

  const handleDelete = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template?.file_url) {
      const path = template.file_url.split("/contract-files/")[1];
      if (path) await supabase.storage.from("contract-files").remove([path]);
    }
    await supabase.from("contract_templates").delete().eq("id", id);
    toast({ title: "Template deleted" }); load();
  };

  const handleFileUpload = async (templateId: string, file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `templates/${templateId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("contract-files").upload(path, file);
    if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("contract-files").getPublicUrl(path);
    await supabase.from("contract_templates").update({ file_url: urlData.publicUrl, file_name: file.name }).eq("id", templateId);
    toast({ title: "Template file uploaded" }); setUploading(false); load();
  };

  const handleDownload = async (template: ContractTemplate) => {
    if (!template.file_url) return;
    const path = template.file_url.split("/contract-files/")[1];
    if (!path) return;
    const { data, error } = await supabase.storage.from("contract-files").download(path);
    if (error || !data) { toast({ title: "Download failed", variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = template.file_name || "template"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{templates.length} templates</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[110px] h-7 text-[10px] border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openAdd}><Plus size={12} /> New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit Template" : "Add Template"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Template name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="Template content / clauses / boilerplate text..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} />
              <Button onClick={handleSave} className="w-full">{editingId ? "Update Template" : "Add Template"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Template list */}
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {templates.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-xs">No templates yet. Add one to get started.</p>
        )}
        {templates.map(template => (
          <div key={template.id} className="py-3 px-1 hover:bg-secondary/20 transition-colors">
            <div className="flex items-start gap-2">
              <FileText size={14} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h4 className="text-xs font-bold">{template.title}</h4>
                  <Badge variant="outline" className="text-[9px]">{template.contract_type}</Badge>
                </div>
                {template.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{template.description}</p>}
                {template.file_name && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <FileText size={9} />{template.file_name}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                {onUseTemplate && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Use template" onClick={() => onUseTemplate(template)}>
                    <Copy size={12} />
                  </Button>
                )}
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(template.id, e.target.files[0]); }} />
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" asChild disabled={uploading}>
                    <span><Upload size={12} /></span>
                  </Button>
                </label>
                {template.file_url && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDownload(template)}>
                    <Download size={12} />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(template)}>
                  <Pencil size={12} />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete template?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete "{template.title}".</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(template.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractTemplates;
