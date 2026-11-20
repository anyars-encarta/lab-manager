import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Microscope, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Investigation = {
  id: string;
  gdrgCode?: string;
  name: string;
  specimenType?: string;
  price: string | number;
  active: boolean;
};
type Parameter = {
  id: string;
  code: string;
  name: string;
  unit?: string;
  referenceRange?: string;
  referenceLow?: string;
  referenceHigh?: string;
  dataType: "text" | "number" | "boolean";
  decimalPlaces: number;
  sortOrder: number;
  active: boolean;
};
type ReferenceProfile = {
  id: string;
  gender: "all" | "male" | "female" | "other";
  ageMin: number;
  ageMax: number | null;
  referenceLow: string | null;
  referenceHigh: string | null;
  referenceRange: string | null;
  sortOrder: number;
};

export function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [referenceProfiles, setReferenceProfiles] = useState<ReferenceProfile[]>([]);
  const [profileDraft, setProfileDraft] = useState({
    gender: "all" as "all" | "male" | "female" | "other",
    ageMin: "0",
    ageMax: "",
    referenceRange: "",
    referenceLow: "",
    referenceHigh: "",
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [parameterDialogOpen, setParameterDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Investigation | null>(null);
  const [editingParameter, setEditingParameter] = useState<Parameter | null>(null);
  const [parameterActive, setParameterActive] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const requestGeneration = useRef(0);

  const load = async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError("");
    try {
      const investigationResponse = await fetch(`${API_URL}/api/investigations`, { credentials: "include" });
      if (!investigationResponse.ok) throw new Error("Unable to load investigation setup");
      const investigationData = await investigationResponse.json();
      if (generation !== requestGeneration.current) return;
      setInvestigations(Array.isArray(investigationData) ? investigationData : []);
      if (selectedTestId) await loadParameters(selectedTestId, generation);
    } catch (error) {
      if (generation === requestGeneration.current) setLoadError(error instanceof Error ? error.message : "Unable to load investigations");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  const loadParameters = async (investigationId: string, generation = requestGeneration.current) => {
    try {
      const response = await fetch(`${API_URL}/api/investigations/${investigationId}/parameters`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load parameters");
      const data = await response.json();
      if (generation === requestGeneration.current) setParameters(Array.isArray(data) ? data : []);
    } catch (error) {
      if (generation === requestGeneration.current) setLoadError(error instanceof Error ? error.message : "Unable to load parameters");
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (selectedTestId) void loadParameters(selectedTestId);
  }, [selectedTestId]);

  const openTestDialog = (test?: Investigation) => {
    setEditingTest(test || null);
    setSubmissionError("");
    setTestDialogOpen(true);
  };

  const openParameterDialog = (parameter?: Parameter) => {
    setEditingParameter(parameter || null);
    setParameterActive(parameter?.active ?? true);
    setSubmissionError("");
    setParameterDialogOpen(true);
    if (parameter) void loadReferenceProfiles(parameter.id);
    else setReferenceProfiles([]);
  };

  const loadReferenceProfiles = async (parameterId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/parameters/${parameterId}/reference-ranges`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load reference ranges");
      const data = await response.json();
      setReferenceProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Unable to load reference ranges");
    }
  };

  const saveTest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSubmissionError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const price = Number(values.price);
    if (!Number.isFinite(price) || price < 0) {
      setSubmissionError("Enter a valid investigation price.");
      setSaving(false);
      return;
    }
    const payload = {
      gdrgCode: String(values.gdrgCode || "").trim() || undefined,
      name: String(values.name || "").trim(),
      specimenType: String(values.specimenType || "").trim() || undefined,
      price,
    };
    try {
      const response = await fetch(editingTest ? `${API_URL}/api/investigations/${editingTest.id}` : `${API_URL}/api/investigations`, {
        method: editingTest ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to save investigation");
      toast.success(editingTest ? "Investigation updated" : "Investigation created", {
        description: `${payload.name} was saved successfully.`,
      });
      setTestDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Unable to save investigation", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setSubmissionError(error instanceof Error ? error.message : "Unable to save investigation");
    } finally {
      setSaving(false);
    }
  };

  const saveParameter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTestId) return;
    setSaving(true);
    setSubmissionError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const payload = {
      code: values.code,
      name: values.name,
      unit: values.unit || undefined,
      referenceRange: values.referenceRange || undefined,
      referenceLow: values.referenceLow === "" ? null : Number(values.referenceLow),
      referenceHigh: values.referenceHigh === "" ? null : Number(values.referenceHigh),
      dataType: values.dataType,
      decimalPlaces: Number(values.decimalPlaces || 0),
      sortOrder: Number(values.sortOrder || 0),
      active: parameterActive,
    };
    try {
      const response = await fetch(editingParameter ? `${API_URL}/api/parameters/${editingParameter.id}` : `${API_URL}/api/investigations/${selectedTestId}/parameters`, {
        method: editingParameter ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to save parameter");
      toast.success(editingParameter ? "Parameter updated" : "Parameter created", {
        description: `${payload.name} was saved successfully.`,
      });
      const savedParameterId = editingParameter?.id || body?.id;
      if (savedParameterId && (profileDraft.referenceRange || profileDraft.referenceLow || profileDraft.referenceHigh)) {
        const profileResponse = await fetch(`${API_URL}/api/parameters/${savedParameterId}/reference-ranges`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender: profileDraft.gender,
            ageMin: Number(profileDraft.ageMin || 0),
            ageMax: profileDraft.ageMax === "" ? null : Number(profileDraft.ageMax),
            referenceRange: profileDraft.referenceRange || null,
            referenceLow: profileDraft.referenceLow === "" ? null : Number(profileDraft.referenceLow),
            referenceHigh: profileDraft.referenceHigh === "" ? null : Number(profileDraft.referenceHigh),
          }),
        });
        if (!profileResponse.ok) throw new Error("Parameter saved, but reference profile could not be added");
        toast.success("Reference profile added", {
          description: "The age/gender reference range was saved successfully.",
        });
        await loadReferenceProfiles(savedParameterId);
      }
      setParameterDialogOpen(false);
      await loadParameters(selectedTestId);
    } catch (error) {
      toast.error("Unable to save parameter", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setSubmissionError(error instanceof Error ? error.message : "Unable to save parameter");
    } finally {
      setSaving(false);
    }
  };

  const filtered = investigations.filter((test) =>
    `${test.gdrgCode || ""} ${test.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedTest = investigations.find((test) => test.id === selectedTestId);

  return (
    <div className="space-y-5 pb-8">
      <Breadcrumb />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <p className="text-sm font-medium text-blue-600">Setup</p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Microscope className="h-7 w-7" />Investigations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register laboratory tests, pricing and result parameters.</p>
        </div>
        <Button className="gap-2" onClick={() => openTestDialog()}><Plus className="h-4 w-4" />Add investigation</Button>
      </section>

      {loadError && <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"><span>{loadError}</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>}

      <Tabs defaultValue="tests">
        <TabsList><TabsTrigger value="tests">Investigations</TabsTrigger><TabsTrigger value="parameters">Parameters</TabsTrigger></TabsList>
        <TabsContent value="tests">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <div><CardTitle className="text-base">Laboratory investigations</CardTitle><CardDescription>{filtered.length} investigation(s)</CardDescription></div>
                <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search investigations..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading investigations...</div> : filtered.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No investigations found</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>G-DRG</TableHead><TableHead>Investigation</TableHead><TableHead>Specimen</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>{filtered.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>{test.gdrgCode ? <Badge variant="outline">{test.gdrgCode}</Badge> : "—"}</TableCell>
                      <TableCell>{test.name}</TableCell>
                      <TableCell>{test.specimenType || "—"}</TableCell>
                      <TableCell>GH₵ {Number(test.price).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={test.active ? "default" : "secondary"}>{test.active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openTestDialog(test)}>Edit</Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="parameters">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><CardTitle className="text-base">Investigation parameters</CardTitle><CardDescription>Configure reference bounds for H/L result flags.</CardDescription></div>
                <div className="flex gap-2">
                  <InvestigationSelect
                    investigations={investigations}
                    value={selectedTestId}
                    onChange={setSelectedTestId}
                  />
                  <Button disabled={!selectedTestId} className="gap-2" onClick={() => openParameterDialog()}><Plus className="h-4 w-4" />Add parameter</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedTestId ? <div className="py-16 text-center text-sm text-muted-foreground">Select an investigation to manage parameters</div> : parameters.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No parameters configured for {selectedTest?.name}</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Parameter</TableHead><TableHead>Unit</TableHead><TableHead>Reference range</TableHead><TableHead>Numeric bounds</TableHead><TableHead>Type</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>{parameters.map((parameter) => (
                    <TableRow key={parameter.id}>
                      <TableCell className="font-medium">{parameter.code}</TableCell>
                      <TableCell>{parameter.name}</TableCell>
                      <TableCell>{parameter.unit || "—"}</TableCell>
                      <TableCell>{parameter.referenceRange || "—"}</TableCell>
                      <TableCell>{parameter.referenceLow != null && parameter.referenceHigh != null ? `${parameter.referenceLow} — ${parameter.referenceHigh}` : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{parameter.dataType}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => openParameterDialog(parameter)}><Settings2 className="mr-1 h-4 w-4" />Edit</Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={saveTest}>
            <DialogHeader><DialogTitle>{editingTest ? "Edit investigation" : "Add investigation"}</DialogTitle><DialogDescription>Set the G-DRG code, specimen, name and price.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field name="gdrgCode" label="G-DRG code" defaultValue={editingTest?.gdrgCode} />
                <Field name="specimenType" label="Specimen type" defaultValue={editingTest?.specimenType} />
              </div>
              <Field name="name" label="Investigation name" required defaultValue={editingTest?.name} />
              <Field name="price" label="Price (GH₵)" type="number" step="0.01" required defaultValue={editingTest?.price} />
            </div>
            {submissionError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{submissionError}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setTestDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save investigation"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={parameterDialogOpen} onOpenChange={setParameterDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={saveParameter}>
            <DialogHeader><DialogTitle>{editingParameter ? "Edit parameter" : "Add parameter"}</DialogTitle><DialogDescription>Set the display range and numeric bounds used for H/L flagging.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field name="code" label="Parameter code" required defaultValue={editingParameter?.code} />
                <Field name="name" label="Parameter name" required defaultValue={editingParameter?.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field name="unit" label="Unit" defaultValue={editingParameter?.unit} />
                <Field name="referenceRange" label="Reference range text" defaultValue={editingParameter?.referenceRange} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field name="referenceLow" label="Low normal bound" type="number" step="0.0001" defaultValue={editingParameter?.referenceLow} />
                <Field name="referenceHigh" label="High normal bound" type="number" step="0.0001" defaultValue={editingParameter?.referenceHigh} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data type</Label><Select name="dataType" defaultValue={editingParameter?.dataType || "text"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="number">Number</SelectItem><SelectItem value="boolean">Boolean</SelectItem></SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-3"><Field name="decimalPlaces" label="Decimals" type="number" defaultValue={editingParameter?.decimalPlaces || 0} /><Field name="sortOrder" label="Sort order" type="number" defaultValue={editingParameter?.sortOrder || 0} /></div>
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <Label>Age/gender reference profiles</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Add ranges that differ for age groups or gender.</p>
                </div>
                {referenceProfiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span>{profile.gender} · {profile.ageMin}{profile.ageMax == null ? "+ years" : `-${profile.ageMax} years`} · {profile.referenceRange || `${profile.referenceLow ?? "—"} — ${profile.referenceHigh ?? "—"}`}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={async () => {
                      try {
                        const response = await fetch(`${API_URL}/api/parameter-reference-ranges/${profile.id}`, { method: "DELETE", credentials: "include" });
                        if (!response.ok) throw new Error("Unable to delete reference profile");
                        setReferenceProfiles((current) => current.filter((item) => item.id !== profile.id));
                        toast.success("Reference profile deleted", {
                          description: "The age/gender reference range was removed.",
                        });
                      } catch (error) {
                        toast.error("Unable to delete reference profile", {
                          description: error instanceof Error ? error.message : "An unexpected error occurred.",
                        });
                      }
                    }} aria-label="Delete reference profile"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Gender</Label><Select value={profileDraft.gender} onValueChange={(value) => setProfileDraft((current) => ({ ...current, gender: value as typeof current.gender }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                  <Field name="profileRange" label="Reference text" defaultValue={profileDraft.referenceRange} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Field name="profileAgeMin" label="Age min" type="number" defaultValue={profileDraft.ageMin} />
                  <Field name="profileAgeMax" label="Age max" type="number" defaultValue={profileDraft.ageMax} />
                  <Field name="profileLow" label="Low" type="number" step="0.0001" defaultValue={profileDraft.referenceLow} />
                  <Field name="profileHigh" label="High" type="number" step="0.0001" defaultValue={profileDraft.referenceHigh} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setProfileDraft((current) => ({
                    gender: current.gender,
                    ageMin: (document.querySelector<HTMLInputElement>('[name="profileAgeMin"]')?.value || "0"),
                    ageMax: document.querySelector<HTMLInputElement>('[name="profileAgeMax"]')?.value || "",
                    referenceRange: document.querySelector<HTMLInputElement>('[name="profileRange"]')?.value || "",
                    referenceLow: document.querySelector<HTMLInputElement>('[name="profileLow"]')?.value || "",
                    referenceHigh: document.querySelector<HTMLInputElement>('[name="profileHigh"]')?.value || "",
                  }));
                }}>Use entered profile values</Button>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3"><div><Label htmlFor="parameter-active">Active parameter</Label><p className="text-xs text-muted-foreground">Inactive parameters are hidden from result entry.</p></div><Switch id="parameter-active" checked={parameterActive} onCheckedChange={setParameterActive} /></div>
            </div>
            {submissionError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{submissionError}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setParameterDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save parameter"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ name, label, type = "text", required = false, step, defaultValue }: { name: string; label: string; type?: string; required?: boolean; step?: string; defaultValue?: string | number }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} step={step} required={required} defaultValue={defaultValue} /></div>;
}

function InvestigationSelect({
  investigations,
  value,
  onChange,
}: {
  investigations: Investigation[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = investigations.find((investigation) => investigation.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-72 justify-between">
          {selected ? selected.name : "Select investigation"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search investigations..." />
          <CommandList>
            <CommandEmpty>No investigation found.</CommandEmpty>
            <CommandGroup>
              {investigations.map((investigation) => (
                <CommandItem
                  key={investigation.id}
                  value={investigation.name}
                  onSelect={() => {
                    onChange(investigation.id);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${investigation.id === value ? "opacity-100" : "opacity-0"}`} />
                  {investigation.name}
                  {investigation.gdrgCode ? ` — ${investigation.gdrgCode}` : ""}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
