import { useState } from "react";
import { useLogin } from "@refinedev/core";
import { Activity, FlaskConical, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputPassword } from "@/components/refine-ui/form/input-password";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/refine-ui/theme/theme-toggle";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { mutate: login, isPending } = useLogin();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    login({ email, password }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Unable to sign in"),
    });
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_55%,#ecfdf5_100%)] dark:bg-[linear-gradient(135deg,#0f172a_0%,#111827_55%,#172554_100%)]">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative mx-auto grid min-h-svh max-w-6xl items-center gap-12 px-6 py-10 lg:grid-cols-[1.05fr_430px]">
        <section className="hidden animate-in fade-in slide-in-from-left-8 duration-700 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold">LabManager</p>
              <p className="text-sm text-muted-foreground">Laboratory Operations</p>
            </div>
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight">
            Precise testing.<br />
            <span className="text-blue-600">Connected care.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
            Manage patients, investigations, results and NHIA claims from one secure workspace.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white/70 p-4 backdrop-blur dark:bg-black/20">
              <Activity className="mb-3 h-5 w-5 text-blue-600" />
              <p className="font-semibold">Live workflows</p>
              <p className="mt-1 text-sm text-muted-foreground">From registration to reporting</p>
            </div>
            <div className="rounded-xl border bg-white/70 p-4 backdrop-blur dark:bg-black/20">
              <ShieldCheck className="mb-3 h-5 w-5 text-emerald-600" />
              <p className="font-semibold">Role protected</p>
              <p className="mt-1 text-sm text-muted-foreground">Secure access by responsibility</p>
            </div>
          </div>
        </section>

        <Card className="w-full animate-in fade-in zoom-in-95 duration-500 sm:mx-auto sm:max-w-md">
          <CardHeader className="pb-4">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-blue-600 text-white lg:hidden">
              <FlaskConical className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your laboratory workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@labmanager.local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <InputPassword value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" size="lg" type="submit" disabled={isPending}>
                {isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
