import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe } from "lucide-react";

interface TerritoryRow {
  id: string;
  country: string;
  streams: number;
  expected_revenue: number;
  actual_revenue: number;
}

const TerritoryAnalysis = () => {
  const [rows, setRows] = useState<TerritoryRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("territory_data").select("*").order("streams", { ascending: false });
      setRows((data as TerritoryRow[]) || []);
    };
    load();
  }, []);

  // Aggregate by country
  const byCountry = rows.reduce<Record<string, { streams: number; expected: number; actual: number }>>((acc, r) => {
    if (!acc[r.country]) acc[r.country] = { streams: 0, expected: 0, actual: 0 };
    acc[r.country].streams += Number(r.streams);
    acc[r.country].expected += Number(r.expected_revenue);
    acc[r.country].actual += Number(r.actual_revenue);
    return acc;
  }, {});

  const countries = Object.entries(byCountry).sort((a, b) => b[1].streams - a[1].streams);

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Globe size={14} className="text-primary" />
        <h3 className="text-sm uppercase tracking-widest font-bold">Territory Analysis</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Streams</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead>Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countries.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No territory data yet</TableCell></TableRow>
            )}
            {countries.map(([country, d]) => {
              const gap = d.expected - d.actual;
              const missingCollection = d.streams > 0 && d.actual === 0;
              return (
                <TableRow key={country}>
                  <TableCell className="font-medium">{country}</TableCell>
                  <TableCell className="text-right">{d.streams.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R {d.expected.toLocaleString()}</TableCell>
                  <TableCell className="text-right">R {d.actual.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-bold ${gap > 0 ? "text-destructive" : "text-green-400"}`}>
                    R {gap.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {missingCollection && <span className="text-yellow-400 text-xs">⚠️ Missing Collection</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TerritoryAnalysis;
