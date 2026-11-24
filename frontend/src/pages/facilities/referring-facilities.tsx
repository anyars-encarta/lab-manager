/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Building2, Pencil, Plus, Search } from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/refine-ui/data-table/data-table-pagination";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Facility = {
  id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  nhiaFacilityCode?: string;
  createdAt: string;
};

const emptyFacility = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  nhiaFacilityCode: "",
};

export function ReferringFacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [editing, setEditing] = useState<Facility | null>(null);
  const [form, setForm] = useState(emptyFacility);
  const [originalForm, setOriginalForm] = useState(emptyFacility);
  const editorSession = useRef(0);
  const requestGeneration = useRef(0);
  const [refreshToken, setRefreshToken] = useState(0);

  const load = async (loadPage = page, loadSearch = debouncedSearch) => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({
        page: String(loadPage),
        pageSize: String(pageSize),
      });
      if (loadSearch.trim()) params.set("search", loadSearch.trim());
      const response = await fetch(`${API_URL}/api/facilities?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Unable to load referring facilities (${response.status})`);
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      setFacilities(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);
      const nextTotal = Number(data.total || (Array.isArray(data) ? data.length : 0));
      setTotal(nextTotal);
      const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));
      if (loadPage > lastPage) {
        setPage(lastPage);
        await load(lastPage, loadSearch);
      }
    } catch (error) {
      if (generation === requestGeneration.current) {
        setFacilities([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load referring facilities");
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    void load(page, debouncedSearch);
  }, [page, pageSize, debouncedSearch, refreshToken]);

  const openCreate = () => {
    if (saving) return;
    editorSession.current += 1;
    setEditing(null);
    setForm(emptyFacility);
    setOriginalForm(emptyFacility);
    setSubmissionError("");
    setDialogOpen(true);
  };

  const openEdit = (facility: Facility) => {
    if (saving) return;
    editorSession.current += 1;
    const nextForm = {
      name: facility.name || "",
      code: facility.code || "",
      address: facility.address || "",
      phone: facility.phone || "",
      email: facility.email || "",
      nhiaFacilityCode: facility.nhiaFacilityCode || "",
    };
    setEditing(facility);
    setForm(nextForm);
    setOriginalForm(nextForm);
    setSubmissionError("");
    setDialogOpen(true);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const session = ++editorSession.current;
    const editor = editing?.id || null;
    setSaving(true);
    setSubmissionError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const key of ["name", "address", "phone", "nhiaFacilityCode"] as const) {
        if (form[key] !== originalForm[key]) payload[key] = form[key] === "" ? null : form[key];
      }
      if (form.code !== originalForm.code) payload.code = form.code === "" ? null : form.code;
      if (form.email !== originalForm.email) {
        payload.email = form.email === "" ? null : form.email;
      }

      const response = await fetch(
        editor ? `${API_URL}/api/facilities/${editor}` : `${API_URL}/api/facilities`,
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editor ? payload : form),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to save referring facility");
      toast.success(editing ? "Referring facility updated" : "Referring facility created", {
        description: `${form.name} was saved successfully.`,
      });
      if (session === editorSession.current) setDialogOpen(false);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      toast.error("Unable to save referring facility", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      if (session === editorSession.current) {
        setSubmissionError(error instanceof Error ? error.message : "Unable to save referring facility");
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = facilities;

  return (
    <div className="space-y-5 pb-8">
      <Breadcrumb />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <p className="text-sm font-medium text-blue-600">Setup</p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Building2 className="h-7 w-7" />Referring Facilities
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage clinics and facilities that refer patients for laboratory investigations.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />Add facility
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit referring facility" : "Add referring facility"}</DialogTitle>
                <DialogDescription>Enter the facility contact and NHIA identification details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-5">
                <FacilityField label="Facility name" value={form.name} required onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <FacilityField label="Facility code" value={form.code} onChange={(value) => setForm((current) => ({ ...current, code: value }))} />
                  <FacilityField label="NHIA facility code" value={form.nhiaFacilityCode} onChange={(value) => setForm((current) => ({ ...current, nhiaFacilityCode: value }))} />
                </div>
                <FacilityField label="Address" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <FacilityField label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                  <FacilityField label="Email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                </div>
              </div>
              {submissionError && (
                <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submissionError}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save facility"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      {loadError && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Facility records</CardTitle>
              <CardDescription>{total} facility/facilities</CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search facilities..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading facilities...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No referring facilities found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>NHIA code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((facility) => (
                  <TableRow key={facility.id}>
                    <TableCell>
                      <div className="font-medium">{facility.name}</div>
                      {facility.address && <div className="text-xs text-muted-foreground">{facility.address}</div>}
                    </TableCell>
                    <TableCell>{facility.code ? <Badge variant="outline">{facility.code}</Badge> : "—"}</TableCell>
                    <TableCell>{facility.phone || "—"}</TableCell>
                    <TableCell>{facility.nhiaFacilityCode || "—"}</TableCell>
                    <TableCell>{facility.email || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(facility)} aria-label={`Edit ${facility.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <div className="border-t px-4 py-3">
          <DataTablePagination
            currentPage={page}
            pageCount={Math.max(1, Math.ceil(total / pageSize))}
            setCurrentPage={setPage}
            pageSize={pageSize}
            setPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            total={total}
          />
        </div>
      </Card>
    </div>
  );
}

function FacilityField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
