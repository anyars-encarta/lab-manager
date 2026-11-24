import { useEffect, useState } from "react";
import { Building, Save, Trash2, UploadCloud } from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const emptyProfile = {
  name: "",
  logoUrl: "",
  address: "",
  phone: "",
  email: "",
  slogan: "",
  currency: "GHS",
};

export function LaboratoryProfilePage() {
  const [form, setForm] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void fetch(`${API_URL}/api/laboratory-profile`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load laboratory profile");
        const profile = await response.json();
        if (profile) {
          setForm({
            name: profile.name || "",
            logoUrl: profile.logoUrl || "",
            address: profile.address || "",
            phone: profile.phone || "",
            email: profile.email || "",
            slogan: profile.slogan || "",
            currency: profile.currency || "GHS",
          });
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load laboratory profile"))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/laboratory-profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to save laboratory profile");
      toast.success("Laboratory profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save laboratory profile");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Please select a PNG or JPEG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be 5 MB or smaller");
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read the logo file"));
        reader.readAsDataURL(file);
      });

      const uploadResponse = await fetch(`${API_URL}/api/laboratory-profile/logo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      const uploaded = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploaded?.secureUrl) {
        throw new Error(uploaded?.error || "Unable to upload logo");
      }

      setForm((current) => ({ ...current, logoUrl: uploaded.secureUrl }));
      toast.success("Logo uploaded", {
        description: "Save the laboratory profile to apply the logo.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <Breadcrumb />
      <section>
        <p className="text-sm font-medium text-blue-600">Setup</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Building className="h-7 w-7" />Laboratory profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the laboratory business details shown on reports and POS receipts.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Laboratory information</CardTitle>
          <CardDescription>This is separate from referring hospitals and health facilities.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <form className="grid gap-4 sm:max-w-2xl" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="name">Laboratory name</Label>
                <Input id="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-3">
                <Label>Laboratory logo</Label>
                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Laboratory logo preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <UploadCloud className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      id="laboratoryLogo"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={uploading}
                      className="cursor-pointer"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadLogo(file);
                        event.target.value = "";
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        PNG or JPEG · Maximum 5 MB
                      </p>
                      {form.logoUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive cursor-pointer"
                          disabled={uploading}
                          onClick={() => setForm((current) => ({ ...current, logoUrl: "" }))}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slogan">Slogan</Label>
                  <Input id="slogan" value={form.slogan} onChange={(event) => setForm({ ...form, slogan: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
                </div>
              </div>
              <div>
                <Button type="submit" className="gap-2 cursor-pointer" disabled={saving || uploading}>
                  <Save className="h-4 w-4" />{saving ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
