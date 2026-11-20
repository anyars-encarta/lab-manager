import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronsUpDown, Plus, Search, UserRoundPlus } from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Facility = { id: string; name: string; code?: string };
type Investigation = { id: string; code: string; name: string; specimenType?: string; price: string | number; active: boolean; facilityId: string };
type Patient = { id: string; patientNumber: string; firstName: string; lastName: string; phone?: string; nhisNumber?: string; createdAt: string };

export function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ patientNumber: string; orderNumber: string; totalAmount: string } | null>(null);
  const requestGeneration = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError("");
    try {
      const patientResponse = await fetch(`${API_URL}/api/patients`, { credentials: "include" });
      if (!patientResponse.ok) throw new Error(`Unable to load patient records (${patientResponse.status})`);
      const patientData = await patientResponse.json();
      if (generation !== requestGeneration.current) return;
      setPatients(Array.isArray(patientData) ? patientData : []);
    } catch (loadFailure) {
      if (generation === requestGeneration.current) {
        setPatients([]);
        setLoadError(loadFailure instanceof Error ? loadFailure.message : "Unable to load patient records");
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }

    const lookupGeneration = generation;
    const lookupResults = await Promise.allSettled([
      fetch(`${API_URL}/api/facilities`, { credentials: "include" }),
      fetch(`${API_URL}/api/investigations`, { credentials: "include" }),
    ]);
    if (lookupGeneration !== requestGeneration.current) return;

    const [facilityResult, investigationResult] = lookupResults;
    const lookupErrors: string[] = [];
    if (facilityResult.status === "fulfilled" && facilityResult.value.ok) {
      try {
        const facilityData = await facilityResult.value.json();
        if (lookupGeneration === requestGeneration.current) {
          setFacilities(Array.isArray(facilityData) ? facilityData : []);
        }
      } catch {
        if (lookupGeneration === requestGeneration.current) lookupErrors.push("Referring facilities returned invalid data");
      }
    } else {
      if (lookupGeneration === requestGeneration.current) lookupErrors.push("Referring facilities are unavailable");
    }
    if (investigationResult.status === "fulfilled" && investigationResult.value.ok) {
      try {
        const investigationData = await investigationResult.value.json();
        if (lookupGeneration === requestGeneration.current) {
          setInvestigations(Array.isArray(investigationData) ? investigationData : []);
        }
      } catch {
        if (lookupGeneration === requestGeneration.current) lookupErrors.push("Investigations returned invalid data");
      }
    } else {
      if (lookupGeneration === requestGeneration.current) lookupErrors.push("Investigations are unavailable");
    }
    if (lookupGeneration === requestGeneration.current && lookupErrors.length > 0) {
      setLoadError((current) => current ? `${current}. ${lookupErrors.join(". ")}` : lookupErrors.join(". "));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const availableTests = useMemo(
    () => investigations.filter((test) => test.active && (!facilityId || test.facilityId === facilityId)),
    [investigations, facilityId],
  );

  const charge = useMemo(
    () => availableTests
      .filter((test) => selectedTests.includes(test.id))
      .reduce((total, test) => total + Number(test.price || 0), 0),
    [availableTests, selectedTests],
  );

  const filteredPatients = patients.filter((patient) =>
    `${patient.firstName} ${patient.lastName} ${patient.patientNumber} ${patient.nhisNumber || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const toggleTest = (id: string, checked: boolean) => {
    setSelectedTests((current) => checked ? [...current, id] : current.filter((testId) => testId !== id));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    if (!facilityId) {
      setError("Select the referring facility.");
      return;
    }
    if (selectedTests.length === 0) {
      setError("Select at least one laboratory test.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/patients/register-request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          firstName: values.firstName,
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: values.address || undefined,
          nhisNumber: values.nhisNumber || undefined,
          nhisStatus: values.nhisStatus || undefined,
          clinicianName: values.clinicianName || undefined,
          notes: values.notes || undefined,
          investigationIds: selectedTests,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to register patient");
      setSuccess({
        patientNumber: body.patient.patientNumber,
        orderNumber: body.order.orderNumber,
        totalAmount: body.totalAmount,
      });
      setDialogOpen(false);
      setFacilityId("");
      setSelectedTests([]);
      await load();
    } catch (submissionFailure) {
      setError(submissionFailure instanceof Error ? submissionFailure.message : "Unable to register patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <Breadcrumb />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <p className="text-sm font-medium text-blue-600">Front desk</p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><UserRoundPlus className="h-7 w-7" />Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register patients and make test requests.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (open) setError(""); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Register patient</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>New patient and test request</DialogTitle>
                <DialogDescription>Capture patient details, the referring facility and requested investigations.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-5 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="firstName" label="First name" required />
                    <Field name="lastName" label="Last name" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="dateOfBirth" label="Date of birth" type="date" />
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select name="gender"><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="female">Female</SelectItem><SelectItem value="male">Male</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="phone" label="Phone" />
                    <Field name="email" label="Email" type="email" />
                  </div>
                  <Field name="address" label="Address" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="nhisNumber" label="NHIS number" />
                    <div className="space-y-2">
                      <Label>NHIS status</Label>
                      <Select name="nhisStatus"><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="not_eligible">Not eligible</SelectItem></SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label>Referring facility</Label>
                      <FacilitySelect
                        facilities={facilities}
                        value={facilityId}
                        onChange={(value) => { setFacilityId(value); setSelectedTests([]); }}
                      />
                    </div>
                    <Field name="clinicianName" label="Referring clinician" />
                  </div>
                  <Field name="notes" label="Clinical notes" />
                </div>

                <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Requested investigations</CardTitle>
                    <CardDescription>Select tests for this patient.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {!facilityId ? (
                        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Select a referring facility to view its investigations.</p>
                      ) : availableTests.length === 0 ? (
                        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No active investigations configured for this facility.</p>
                      ) : availableTests.map((test) => (
                        <label key={test.id} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/60">
                          <Checkbox checked={selectedTests.includes(test.id)} onCheckedChange={(checked) => toggleTest(test.id, checked === true)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{test.name}</p>
                            <p className="text-xs text-muted-foreground">{test.code}{test.specimenType ? ` · ${test.specimenType}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold">GH₵ {Number(test.price).toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <span className="text-sm text-muted-foreground">Applicable charge</span>
                      <span className="text-xl font-semibold text-blue-700 dark:text-blue-400">GH₵ {charge.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Registering..." : "Register and create request"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="font-medium">Patient registered successfully</p>
            <p className="text-muted-foreground">{success.patientNumber} · Request {success.orderNumber} · Charge GH₵ {Number(success.totalAmount).toFixed(2)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSuccess(null)}>Dismiss</Button>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span>{loadError}</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div><CardTitle className="text-base">Patient records</CardTitle><CardDescription>{filteredPatients.length} patient(s)</CardDescription></div>
            <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search patients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading patients...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No patient records found</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Patient number</TableHead><TableHead>Phone</TableHead><TableHead>NHIS</TableHead><TableHead>Registered</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.firstName} {patient.lastName}</TableCell>
                    <TableCell><Badge variant="outline">{patient.patientNumber}</Badge></TableCell>
                    <TableCell>{patient.phone || "—"}</TableCell>
                    <TableCell>{patient.nhisNumber || "—"}</TableCell>
                    <TableCell>{new Date(patient.createdAt).toLocaleDateString()}</TableCell>
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

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

function FacilitySelect({
  facilities,
  value,
  onChange,
}: {
  facilities: Facility[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = facilities.find((facility) => facility.id === value);

  if (facilities.length <= 8) {
    return (
      <Select value={value} onValueChange={onChange} required>
        <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
        <SelectContent>
          {facilities.map((facility) => (
            <SelectItem key={facility.id} value={facility.id}>
              {facility.name}{facility.code ? ` — ${facility.code}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selected ? `${selected.name}${selected.code ? ` — ${selected.code}` : ""}` : "Select facility"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search referring facilities..." />
          <CommandList>
            <CommandEmpty>No facility found.</CommandEmpty>
            <CommandGroup>
              {facilities.map((facility) => (
                <CommandItem
                  key={facility.id}
                  value={`${facility.name} ${facility.code || ""}`}
                  onSelect={() => {
                    onChange(facility.id);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${facility.id === value ? "opacity-100" : "opacity-0"}`} />
                  {facility.name}{facility.code ? ` — ${facility.code}` : ""}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
