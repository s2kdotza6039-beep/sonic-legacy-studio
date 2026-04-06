import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SOURCES = ["SAMRO", "CAPASSO", "DistroKid", "TuneCore", "Sync Licensing", "Live Performance", "YouTube / Content ID", "Other"];

interface IncomeRow {
  id: string;
  source: string;
  month: string;
  territory: string;
  gross: number;
  fees: number;
  net: number;
  paid: boolean;
  payment_date: string | null;
  notes: string | null;
}

const IncomeTracker = () => {
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ source: "SAMRO", month: "", territory: "South Africa", gross: "", fees: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("royalty_income").select("*").order("month", { ascending: false });
    setRows((data as IncomeRow[]) || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const gross = Number(form.gross) || 0;
    const fees = Number(form.fees) || 0;
    const { error } = await supabase.from("royalty_income").insert({
      source: form.source,
      month: form.month,
      territory: form.territory,
      gross,
      fees,
      net: gross - fees,
      notes: form.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Income added" });
    setOpen(false);
    setForm({ source: "SAMRO", month: "", territory: "South Africa", gross: "", fees: "", notes: "" });
    load();
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm uppercase tracking-widest font-bold">Income Sources</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Income Entry</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Month (e.g. 2026-04)" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
              <Input placeholder="Territory" value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Gross (R)" type="number" value={form.gross} onChange={(e) => setForm({ ...form, gross: e.target.value })} />
                <Input placeholder="Fees (R)" type="number" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
              </div>
              <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={handleAdd} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Territory</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No income entries yet</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.source}</TableCell>
                <TableCell>{r.month}</TableCell>
                <TableCell>{r.territory}</TableCell>
                <TableCell className="text-right">R {Number(r.gross).toLocaleString()}</TableCell>
                <TableCell className="text-right">R {Number(r.fees).toLocaleString()}</TableCell>
                <TableCell className="text-right font-bold">R {Number(r.net).toLocaleString()}</TableCell>
                <TableCell>{r.paid ? "✅" : "⏳"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{r.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default IncomeTracker;
