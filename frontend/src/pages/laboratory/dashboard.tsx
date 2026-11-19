import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import {
  Activity,
  Banknote,
  ClipboardCheck,
  FlaskConical,
  Microscope,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Identity = { name?: string; email: string; role: string };
type Summary = { totalOrders: number; completed: number; pending: number; totalBilled: number; totalCollected: number };

export function Dashboard() {
  const { data: identity } = useGetIdentity<Identity>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/reports/summary`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/orders`, { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    ]).then(([report, orderRows]) => {
      setSummary(report);
      setOrders(orderRows.slice(0, 6));
    });
  }, []);

  const cards = [
    { title: "Total orders", value: summary?.totalOrders ?? "—", detail: "Selected period", icon: ClipboardCheck, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { title: "Completed", value: summary?.completed ?? "—", detail: "Released reports", icon: FlaskConical, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { title: "Pending", value: summary?.pending ?? "—", detail: "Active workflow", icon: Activity, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { title: "Collected", value: `GH₵ ${(summary?.totalCollected ?? 0).toLocaleString()}`, detail: "Payments received", icon: Banknote, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
  ];

  return (
    <div className="space-y-6 pb-8">
      <Breadcrumb />
      <section className="animate-in fade-in slide-in-from-bottom-3 duration-500">
        <p className="text-sm font-medium text-blue-600">Laboratory overview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good day, {identity?.name || "Team"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here is what is happening across the laboratory today.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <Card key={card.title} className="animate-in fade-in slide-in-from-bottom-4 border shadow-sm" style={{ animationDelay: `${index * 70}ms` }}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Recent laboratory orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="grid place-items-center py-16 text-sm text-muted-foreground">No laboratory orders yet</div>
            ) : (
              <div className="divide-y">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/30">
                        <Microscope className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">GH₵ {Number(order.totalAmount).toLocaleString()}</p>
                      </div>
                    </div>
                    <Badge variant={order.status === "completed" ? "default" : "secondary"}>{order.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { icon: Users, label: "Register patient", detail: "Front desk" },
              { icon: Microscope, label: "Request tests", detail: "Sample preparation" },
              { icon: FlaskConical, label: "Enter results", detail: "Technician" },
              { icon: ClipboardCheck, label: "Release report", detail: "Completed" },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full border bg-background">
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground">0{index + 1}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
