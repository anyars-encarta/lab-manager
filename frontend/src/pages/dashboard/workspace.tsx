/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import {
  Building2,
  ClipboardList,
  FlaskConical,
  Microscope,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Props = { section: "patients" | "orders" | "investigations" | "facilities" | "users" | "reports" | "claims" };

const titles = {
  patients: ["Patients", "Register and find patient records", Users],
  orders: ["Laboratory orders", "Create and track test requests", ClipboardList],
  investigations: ["Investigations", "Configure laboratory tests and parameters", Microscope],
  facilities: ["Facilities", "Manage laboratory facility details", Building2],
  users: ["User management", "Create accounts and assign roles", UserCog],
  reports: ["Reports", "Generate laboratory activity reports", FlaskConical],
  claims: ["NHIA claims", "Generate Ghana NHIA claim batches", ShieldCheck],
} as const;

export function LaboratoryWorkspace({ section }: Props) {
  const { data: identity } = useGetIdentity<{ role?: "admin" | "frontdesk" | "account" | "technician" | "doctor" }>();
  const role = identity?.role;
  const canCreate =
    role === "admin" ||
    (section === "patients" && role === "frontdesk") ||
    (section === "orders" && role === "frontdesk") ||
    (section === "reports" && role === "doctor");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [facilities, setFacilities] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const requestGeneration = useRef(0);
  const [TitleIcon] = [titles[section][2]];

  const load = async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError("");
    setRows([]);
    try {
      const paths: Record<Props["section"], string> = {
        patients: "/api/patients",
        orders: "/api/orders",
        investigations: "/api/investigations",
        facilities: "/api/facilities",
        users: "/api/users",
        reports: "/api/reports/summary",
        claims: "/api/nhia/claims",
      };
      const response = await fetch(`${API_URL}${paths[section]}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      setRows(Array.isArray(data) ? data : data ? [data] : []);
      if (section !== "facilities") {
        try {
          const lookupResponse = await fetch(`${API_URL}/api/facilities`, { credentials: "include" });
          if (!lookupResponse.ok) throw new Error("Unable to load facilities");
          const facilitiesData = await lookupResponse.json();
          if (generation === requestGeneration.current) setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
        } catch (error) {
          if (generation === requestGeneration.current) setLoadError(error instanceof Error ? error.message : "Unable to load lookup data");
        }
      }
      if (section === "orders") {
        try {
          const [investigationResponse, patientResponse] = await Promise.all([
            fetch(`${API_URL}/api/investigations`, { credentials: "include" }),
            fetch(`${API_URL}/api/patients`, { credentials: "include" }),
          ]);
          if (!investigationResponse.ok) throw new Error("Unable to load investigations");
          if (!patientResponse.ok) throw new Error("Unable to load patients");
          const [investigationsData, patientsData] = await Promise.all([
            investigationResponse.json(),
            patientResponse.json(),
          ]);
          if (generation === requestGeneration.current) {
            setInvestigations(Array.isArray(investigationsData) ? investigationsData : []);
            setPatients(Array.isArray(patientsData) ? patientsData : []);
          }
        } catch (error) {
          if (generation === requestGeneration.current) setLoadError(error instanceof Error ? error.message : "Unable to load lookup data");
        }
      }
    } catch (error) {
      if (generation === requestGeneration.current) {
        setRows([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load records");
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    setRows([]);
    setLoadError("");
    setSubmissionError("");
    setSearch("");
    void load();
  }, [section]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSubmissionError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const pathMap: Partial<Record<Props["section"], string>> = {
      patients: "/api/patients",
      investigations: "/api/investigations",
      facilities: "/api/facilities",
      users: "/api/users",
    };
    let reportGeneration: number | null = null;
    try {
      if (section === "orders") {
        const selected = String(values.investigationIds).split(",");
        const payload = {
          facilityId: values.facilityId,
          patientId: values.patientId,
          clinicianName: values.clinicianName,
          investigationIds: selected,
        };
        const response = await fetch(`${API_URL}/api/orders`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error((await response.json()).error || "Unable to create order");
        toast.success("Laboratory request created", { description: "The investigation request and charges were saved." });
      } else if (section === "reports") {
        reportGeneration = ++requestGeneration.current;
        setLoading(true);
        setLoadError("");
        const response = await fetch(`${API_URL}/api/reports/summary?from=${values.from}&to=${values.to}`, { credentials: "include" });
        if (!response.ok) throw new Error("Unable to generate report");
        const report = await response.json();
        if (reportGeneration === requestGeneration.current) {
          setRows([report]);
          setLoading(false);
          setMessage("Report generated successfully");
          toast.success("Laboratory report generated", { description: "The selected reporting period is ready." });
          setDialogOpen(false);
        }
        return;
      } else if (section === "claims") {
        const response = await fetch(`${API_URL}/api/nhia/claims`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facilityId: values.facilityId, claimPeriodStart: new Date(`${values.from}T00:00:00Z`).toISOString(), claimPeriodEnd: new Date(`${values.to}T23:59:59Z`).toISOString() }) });
        if (!response.ok) throw new Error((await response.json()).error || "Unable to generate claim");
        toast.success("NHIA claim generated", { description: "The claim was created for the selected period." });
      } else {
        const path = pathMap[section];
        if (!path) return;
        let payload: Record<string, unknown> = values;
        if (section === "users") payload = { name: values.name, email: values.email, password: values.password, role: values.role };
        if (section === "investigations") payload = {
          ...values,
          coveredTariff: Number(values.coveredTariff || 0),
          uncoveredTariff: Number(values.uncoveredTariff || 0),
          topUp: Number(values.topUp || 0),
        };
        const response = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error((await response.json()).error || "Unable to save record");
        toast.success(section === "users" ? "User account created" : "Setup record saved", {
          description: section === "users" ? "The new account and role were saved." : "The setup information was saved successfully.",
        });
      }
      setMessage("Saved successfully");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Unable to complete operation", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      if (reportGeneration === null || reportGeneration === requestGeneration.current) {
        setSubmissionError(error instanceof Error ? error.message : "Unable to save record");
      }
      if (reportGeneration !== null && reportGeneration === requestGeneration.current) {
        setLoading(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  const [title, description] = titles[section];

  return (
    <div className="space-y-5 pb-8">
      <Breadcrumb />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <p className="text-sm font-medium text-blue-600">Laboratory operations</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight"><TitleIcon className="h-7 w-7" />{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {canCreate && ["patients", "orders", "investigations", "facilities", "users", "reports", "claims"].includes(section) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />{section === "claims" ? "Generate claim" : section === "reports" ? "Generate report" : `New ${section === "investigations" ? "investigation" : section === "users" ? "user" : section === "facilities" ? "facility" : section.slice(0, -1)}`}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>{section === "claims" ? "Generate NHIA claim" : section === "reports" ? "Generate laboratory report" : `Create ${section === "investigations" ? "investigation" : section === "users" ? "user" : section === "facilities" ? "facility" : section.slice(0, -1)}`}</DialogTitle>
                  <DialogDescription>Complete the information below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-5">
                  {section === "patients" && <>
                    <FacilityField facilities={facilities} />
                    <div className="grid grid-cols-2 gap-3"><Field name="firstName" label="First name" required /><Field name="lastName" label="Last name" required /></div>
                    <div className="grid grid-cols-2 gap-3"><Field name="phone" label="Phone" /><Field name="gender" label="Gender" /></div>
                    <Field name="nhisNumber" label="NHIS number" />
                  </>}
                  {section === "users" && <>
                    <Field name="name" label="Full name" required /><Field name="email" label="Email" type="email" required /><Field name="password" label="Password" type="password" required />
                    <RoleField />
                  </>}
                  {section === "facilities" && <><Field name="name" label="Facility name" required /><Field name="code" label="Facility code" /><Field name="address" label="Address" /><Field name="phone" label="Phone" /><Field name="nhiaFacilityCode" label="NHIA facility code" /></>}
                  {section === "investigations" && <><Field name="gdrgCode" label="G-DRG code" /><Field name="name" label="Investigation name" required /><Field name="specimenType" label="Specimen type" /><div className="grid grid-cols-3 gap-3"><Field name="coveredTariff" label="Covered tariff" type="number" step="0.01" /><Field name="topUp" label="Top-up" type="number" step="0.01" /><Field name="uncoveredTariff" label="Uncovered tariff" type="number" step="0.01" /></div></>}
                  {section === "orders" && <><FacilityField facilities={facilities} /><PatientField patients={patients} /><Field name="clinicianName" label="Clinician" /><InvestigationField investigations={investigations} /></>}
                  {(section === "claims" || section === "reports") && <><FacilityField facilities={facilities} /><div className="grid grid-cols-2 gap-3"><Field name="from" label="From" type="date" required /><Field name="to" label="To" type="date" required /></div></>}
                </div>
                {submissionError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{submissionError}</p>}
                <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </section>

      {loadError && <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"><span>{loadError}</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>}
      {message && <p className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</p>}

      {section === "reports" ? <ReportView row={rows[0]} /> : (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div><CardTitle className="text-base">Records</CardTitle><CardDescription>{filtered.length} record(s)</CardDescription></div>
              <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div> : filtered.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No records found</div> : <RecordTable section={section} rows={filtered} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ name, label, type = "text", required = false, step }: { name: string; label: string; type?: string; required?: boolean; step?: number | string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} step={step} /></div>;
}

function FacilityField({ facilities }: { facilities: any[] }) {
  return <div className="space-y-2"><Label htmlFor="facilityId">Facility</Label><Select name="facilityId" required><SelectTrigger id="facilityId"><SelectValue placeholder="Select facility" /></SelectTrigger><SelectContent>{facilities.map((facility) => <SelectItem key={facility.id} value={facility.id}>{facility.name}</SelectItem>)}</SelectContent></Select></div>;
}

function RoleField() {
  return <div className="space-y-2"><Label>Role</Label><Select name="role" required><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{["admin", "frontdesk", "account", "technician", "doctor"].map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></div>;
}

function PatientField({ patients }: { patients: any[] }) {
  return <div className="space-y-2"><Label htmlFor="patientId">Patient</Label><Select name="patientId" required><SelectTrigger id="patientId"><SelectValue placeholder="Select patient" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} — {patient.patientNumber}</SelectItem>)}</SelectContent></Select></div>;
}

function InvestigationField({ investigations }: { investigations: any[] }) {
  return <div className="space-y-2"><Label htmlFor="investigationIds">Investigations</Label><Select name="investigationIds" required><SelectTrigger id="investigationIds"><SelectValue placeholder="Select investigation" /></SelectTrigger><SelectContent>{investigations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} — GH₵ {item.price}</SelectItem>)}</SelectContent></Select></div>;
}

function RecordTable({ section, rows }: { section: Props["section"]; rows: any[] }) {
  const patientName = (row: any) => `${row.firstName || ""} ${row.lastName || ""}`.trim();
  const columns: Record<Props["section"], string[]> = {
    patients: ["patientNumber", "name", "phone", "nhisNumber", "createdAt"],
    orders: ["orderNumber", "status", "paymentStatus", "totalAmount", "createdAt"],
    investigations: ["gdrgCode", "name", "specimenType", "coveredTariff", "topUp", "uncoveredTariff", "covered", "active"],
    facilities: ["name", "code", "phone", "nhiaFacilityCode"],
    users: ["name", "email", "role", "active"],
    claims: ["claimNumber", "status", "totalAmount", "claimPeriodStart", "claimPeriodEnd"],
    reports: ["name"],
  };
  return <Table><TableHeader><TableRow>{columns[section].map((column) => <TableHead key={column}>{column === "nhisNumber" ? "NHIS" : column === "paymentStatus" ? "Payment" : column.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}>{columns[section].map((column) => <TableCell key={column}>{column === "name" && section === "patients" ? patientName(row) : column === "active" ? <Badge variant={row[column] ? "default" : "secondary"}>{row[column] ? "Active" : "Inactive"}</Badge> : column === "status" ? <Badge variant={row[column] === "completed" || row[column] === "paid" ? "default" : "secondary"}>{row[column] || "—"}</Badge> : row[column] == null ? "—" : typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column])}</TableCell>)}</TableRow>)}</TableBody></Table>;
}

function ReportView({ row }: { row?: any }) {
  if (!row) return <Card><CardContent className="py-16 text-center text-muted-foreground">Select a period to generate a summary</CardContent></Card>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
    ["Total orders", row.totalOrders],
    ["Completed", row.completed],
    ["Pending", row.pending],
    ["Collected", `GH₵ ${Number(row.totalCollected || 0).toLocaleString()}`],
  ].map(([label, value]) => <Card key={String(label)}><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>)}</div>;
}
