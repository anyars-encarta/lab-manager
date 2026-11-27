import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Download, Printer, Search } from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type ReportData = {
  rows: Record<string, unknown>[];
  total?: number;
  collected?: number;
  period?: { from: string | null; to: string | null };
};

const reportTypes = [
  { value: "summary", label: "Laboratory Summary" },
  { value: "orders", label: "Laboratory Orders" },
  { value: "payments", label: "Payments and Revenue" },
  { value: "investigations", label: "Investigation Utilization" },
  { value: "patients", label: "Patient Register" },
  { value: "results", label: "Test Results" },
];

const formatValue = (key: string, value: unknown) => {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.toLowerCase().includes("amount") || key === "revenue" || key === "total" || key === "collected") {
    return `GH₵ ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString();
  }
  return String(value);
};

export function ReportsPage() {
  const [reportType, setReportType] = useState("orders");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<ReportData>({ rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reportRequestGeneration = useRef(0);

  useEffect(() => {
    fetch(`${API_URL}/api/facilities`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : [])
      .then((rows) => setFacilities(Array.isArray(rows) ? rows : []))
      .catch(() => setFacilities([]));
  }, []);

  const params = useMemo(() => {
    const values = new URLSearchParams({ type: reportType });
    if (from) values.set("from", from);
    if (to) values.set("to", to);
    if (facilityId) values.set("facilityId", facilityId);
    if (reportType === "orders" && status) values.set("status", status);
    if (reportType === "orders" && paymentStatus) values.set("paymentStatus", paymentStatus);
    if (search.trim()) values.set("search", search.trim());
    return values;
  }, [reportType, from, to, facilityId, status, paymentStatus, search]);

  const generate = async () => {
    const generation = ++reportRequestGeneration.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/reports/data?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Report request failed (${response.status})`);
      const result = await response.json();
      if (generation === reportRequestGeneration.current) setData(result);
    } catch (error) {
      if (generation === reportRequestGeneration.current) {
        setData({ rows: [] });
        setError(error instanceof Error ? error.message : "Unable to generate report");
      }
    } finally {
      if (generation === reportRequestGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    void generate();
  }, [reportType]);

  const exportReport = async (format: "pdf" | "excel", download = true) => {
    const exportParams = new URLSearchParams(params);
    exportParams.set("format", format);
    if (format === "pdf") exportParams.set("download", download ? "1" : "0");
    const url = `${API_URL}/api/reports/export?${exportParams.toString()}`;
    if (format === "pdf" && !download) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to download report");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${reportType}-report.${format === "pdf" ? "pdf" : "xls"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download report");
    }
  };

  const columns = useMemo(() => {
    if (!data.rows.length) return [];
    return Object.keys(data.rows[0]).filter((key) => key !== "id");
  }, [data.rows]);

  return (
    <div className="space-y-6 pb-8">
      <Breadcrumb />
      <section>
        <p className="text-sm font-medium text-blue-600">Analytics and records</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <BarChart3 className="h-7 w-7" />
          Laboratory reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter laboratory activity, payments, revenue, investigations and results.
        </p>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Report filters</CardTitle>
          <CardDescription>Select a report and narrow it to the required period or status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Report</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Facility</Label>
            <Select value={facilityId || "all"} onValueChange={(value) => setFacilityId(value === "all" ? "" : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {facilities.map((facility) => <SelectItem key={facility.id} value={facility.id}>{facility.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
          <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
          {(reportType === "orders") && (
            <>
              <div className="space-y-2">
                <Label>Order status</Label>
                <Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["all", "draft", "awaiting_payment", "paid", "processing", "completed", "cancelled"].map((value) =>
                      <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : value.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment status</Label>
                <Select value={paymentStatus || "all"} onValueChange={(value) => setPaymentStatus(value === "all" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["all", "pending", "partial", "paid", "refunded"].map((value) =>
                      <SelectItem key={value} value={value}>{value === "all" ? "All payments" : value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {["orders", "payments", "patients"].includes(reportType) && (
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Name, number or reference" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
          )}
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
            <Button className="cursor-pointer" onClick={() => void generate()} disabled={loading}>{loading ? "Generating..." : "Generate report"}</Button>
            <Button variant="outline" className="cursor-pointer" onClick={() => void exportReport("pdf", false)}><Printer className="mr-2 h-4 w-4" />Print PDF</Button>
            <Button variant="outline" className="cursor-pointer" onClick={() => void exportReport("pdf", true)}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
            <Button variant="outline" className="cursor-pointer" onClick={() => void exportReport("excel")}><Download className="mr-2 h-4 w-4" />Download Excel</Button>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">{error}</div>}

      {reportType === "payments" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardHeader><CardDescription>Total payments</CardDescription><CardTitle>{`GH₵ ${Number(data.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Records</CardDescription><CardTitle>{data.rows.length}</CardTitle></CardHeader></Card>
        </div>
      )}

      {reportType === "orders" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader><CardDescription>Total billed</CardDescription><CardTitle>{`GH₵ ${Number(data.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Total collected</CardDescription><CardTitle>{`GH₵ ${Number(data.collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Orders</CardDescription><CardTitle>{data.rows.length}</CardTitle></CardHeader></Card>
        </div>
      )}

      {reportType === "summary" && data.rows[0] && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total orders", value: String(data.rows[0].totalOrders ?? 0) },
            { label: "Completed", value: String(data.rows[0].completedOrders ?? 0) },
            { label: "Pending", value: String(data.rows[0].pendingOrders ?? 0) },
            { label: "Collected", value: `GH₵ ${Number(data.rows[0].totalCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          ].map((card) => (
            <Card key={card.label}><CardHeader><CardDescription>{card.label}</CardDescription><CardTitle>{card.value}</CardTitle></CardHeader></Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">{reportTypes.find((type) => type.value === reportType)?.label}</CardTitle>
          <CardDescription>{data.rows.length} record(s)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading report...</div>
          ) : data.rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No records found for the selected filters</div>
          ) : (
            <Table>
              <TableHeader><TableRow>{columns.map((column) => <TableHead key={column} className="whitespace-nowrap">{column.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={String(row.id ?? index)}>
                    {columns.map((column) => <TableCell key={column} className="whitespace-nowrap">{formatValue(column, row[column])}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
