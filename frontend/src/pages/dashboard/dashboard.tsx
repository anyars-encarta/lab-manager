/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import {
  Activity,
  Banknote,
  ClipboardCheck,
  CreditCard,
  FlaskConical,
  HeartPulse,
  Microscope,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Identity = { name?: string; email: string; role: string };
type DashboardData = {
  kpis: {
    patients: number;
    activeInvestigations: number;
    totalOrders: number;
    completed: number;
    pending: number;
    insuredOrders: number;
    resultEntries: number;
    totalBilled: number;
    totalCollected: number;
    outstanding: number;
    payments: number;
    paymentCount: number;
  };
  daily: { date: string; orders: number; billed: number; collected: number }[];
  statusBreakdown: { status: string; value: number }[];
  paymentBreakdown: { method: string; amount: number }[];
  topInvestigations: { name: string; requests: number }[];
};

export function Dashboard() {
  const { data: identity } = useGetIdentity<Identity>();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const dashboardGeneration = useRef(0);
  const ordersGeneration = useRef(0);

  const loadSummary = async () => {
    const generation = ++dashboardGeneration.current;
    setSummaryError("");
    try {
      const response = await fetch(`${API_URL}/api/reports/dashboard`, { credentials: "include" });
      if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
      const data = await response.json();
      if (generation === dashboardGeneration.current) setDashboard(data);
    } catch (error) {
      if (generation === dashboardGeneration.current) {
        setDashboard(null);
        setSummaryError(error instanceof Error ? error.message : "Unable to load summary");
      }
    }
  };

  const loadOrders = async () => {
    const generation = ++ordersGeneration.current;
    setOrdersError("");
    setOrdersLoaded(false);
    try {
      const response = await fetch(`${API_URL}/api/orders`, { credentials: "include" });
      if (!response.ok) throw new Error(`Orders request failed (${response.status})`);
      const data = await response.json();
      const orderRows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : null;
      if (!orderRows) throw new Error("Invalid orders response");
      if (generation === ordersGeneration.current) {
        setOrders(orderRows.slice(0, 6));
        setOrdersLoaded(true);
      }
    } catch (error) {
      if (generation === ordersGeneration.current) {
        setOrders([]);
        setOrdersLoaded(false);
        setOrdersError(error instanceof Error ? error.message : "Unable to load orders");
      }
    }
  };

  useEffect(() => {
    void loadSummary();
    void loadOrders();
  }, []);

  const cards = [
    { title: "Registered patients", value: dashboard?.kpis.patients ?? "—", detail: "All registered patients", icon: Users, color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/30" },
    { title: "Active investigations", value: dashboard?.kpis.activeInvestigations ?? "—", detail: "Available test services", icon: Microscope, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
    { title: "Laboratory orders", value: dashboard?.kpis.totalOrders ?? "—", detail: "Last 30 days", icon: ClipboardCheck, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { title: "Completed reports", value: dashboard?.kpis.completed ?? "—", detail: "Released in 30 days", icon: FlaskConical, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { title: "Pending workflow", value: dashboard?.kpis.pending ?? "—", detail: "Orders not released", icon: Activity, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { title: "Insured orders", value: dashboard?.kpis.insuredOrders ?? "—", detail: "NHIS/insured requests", icon: ShieldCheck, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
    { title: "Revenue collected", value: dashboard ? `GH₵ ${Number(dashboard.kpis.totalCollected).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—", detail: "Paid amounts in 30 days", icon: Banknote, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
    { title: "Outstanding balance", value: dashboard ? `GH₵ ${Number(dashboard.kpis.outstanding).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—", detail: "Unpaid order balances", icon: CreditCard, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30" },
    { title: "Result entries", value: dashboard?.kpis.resultEntries ?? "—", detail: "Entered in 30 days", icon: HeartPulse, color: "text-fuchsia-600", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30" },
  ];

  return (
    <div className="space-y-6 pb-8">
      <Breadcrumb />
      <section className="animate-in fade-in slide-in-from-bottom-3 duration-500">
        <p className="text-sm font-medium text-blue-600">Laboratory overview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good day, {identity?.name || "Team"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here is what is happening across the laboratory today.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

      <section className="grid gap-4 xl:grid-cols-[1.6fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders and revenue</CardTitle>
            <CardDescription>Daily laboratory activity for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number | string, name: string) => name === "Orders" ? [value, name] : [`GH₵ ${Number(value).toLocaleString()}`, name]} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="orders" name="Orders" stroke="#2563eb" fill="#2563eb" fillOpacity={0.18} />
                <Area yAxisId="right" type="monotone" dataKey="collected" name="Collected" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order status</CardTitle>
            <CardDescription>Current 30-day workflow mix</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashboard?.statusBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboard.statusBreakdown} dataKey="value" nameKey="status" cx="50%" cy="46%" outerRadius={82} label>
                    {dashboard.statusBreakdown.map((_, index) => (
                      <Cell key={index} fill={["#2563eb", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#ef4444"][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No order status data</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top investigations</CardTitle>
            <CardDescription>Most requested tests in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashboard?.topInvestigations.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.topInvestigations} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="requests" name="Requests" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No investigation requests</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments by method</CardTitle>
            <CardDescription>Revenue distribution for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashboard?.paymentBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.paymentBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number | string) => [`GH₵ ${Number(value).toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="amount" name="Revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No payments recorded</div>
            )}
          </CardContent>
        </Card>
      </section>

      {(summaryError || ordersError) && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {summaryError && <div className="flex-1">Summary unavailable: {summaryError}</div>}
          {ordersError && <div className="flex-1">Orders unavailable: {ordersError}</div>}
          <Button size="sm" variant="outline" onClick={() => { void loadSummary(); void loadOrders(); }}>Retry</Button>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.6fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Recent laboratory orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!ordersLoaded ? (
              <div className="grid place-items-center py-16 text-sm text-muted-foreground">
                {ordersError ? "Orders could not be loaded" : "Loading orders..."}
              </div>
            ) : orders.length === 0 ? (
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
