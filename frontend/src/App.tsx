import { Authenticated, Refine, useGetIdentity, type AccessControlProvider } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FlaskConical,
  Microscope,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

import "./App.css";
import { ErrorComponent } from "./components/refine-ui/layout/error-component";
import { Layout } from "./components/refine-ui/layout/layout";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { Dashboard } from "./pages/dashboard/dashboard";
import { LaboratoryWorkspace } from "./pages/dashboard/workspace";
import { PatientsPage } from "./pages/patients/patients";
import { ReferringFacilitiesPage } from "./pages/facilities/referring-facilities";
import { Login } from "./pages/login";
import { authProvider } from "./providers/auth";
import { dataProvider } from "./providers/data";
import { ShieldX } from "lucide-react";

function AccessDenied() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <ShieldX className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view this section.</p>
      </div>
    </div>
  );
}

type RouteIdentity = { role?: "admin" | "frontdesk" | "account" | "technician" | "doctor" };

function ResourceGuard({
  resource,
  section,
}: {
  resource: "patients" | "orders" | "investigations" | "facilities" | "users" | "reports" | "claims";
  section: "patients" | "orders" | "investigations" | "facilities" | "users" | "reports" | "claims";
}) {
  const { data: identity } = useGetIdentity<RouteIdentity>();
  const role = identity?.role;
  const allowed =
    role === "admin" ||
    (resource === "patients" && role === "frontdesk") ||
    (resource === "orders" && ["frontdesk", "account", "technician"].includes(role || "")) ||
    (resource === "investigations" && ["frontdesk", "technician"].includes(role || "")) ||
    (resource === "reports" && role === "doctor");
  if (allowed && resource === "patients") {
    return <PatientsPage />;
  }
  if (allowed && resource === "facilities") {
    return <ReferringFacilitiesPage />;
  }
  return allowed ? <LaboratoryWorkspace section={section} /> : <AccessDenied />;
}

const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    try {
      const identity = await authProvider.getIdentity?.({});
      const role = (identity as { role?: string } | undefined)?.role;
      if (!role) return { can: false };
      if (role === "admin") {
        return { can: true };
      }
      if (resource === "dashboard" && action === "list") return { can: true };
      if (resource === "patients" && action === "list") return { can: role === "frontdesk" };
      if (resource === "patients" && action === "create") return { can: role === "frontdesk" };
      if (resource === "orders" && action === "list") return { can: ["frontdesk", "account", "technician"].includes(role) };
      if (resource === "orders" && action === "create") return { can: role === "frontdesk" };
      if (resource === "orders" && action === "edit") return { can: ["account", "technician"].includes(role) };
      if (resource === "investigations" && action === "list") return { can: ["frontdesk", "technician"].includes(role) };
      if (resource === "reports" && action === "list") return { can: role === "doctor" };
      if (resource === "claims") return { can: false };
      if (resource === "facilities" || resource === "users") return { can: false };
      return { can: false };
    } catch {
      return { can: false };
    }
  },
};

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <DevtoolsProvider>
            <Refine
              authProvider={authProvider}
              accessControlProvider={accessControlProvider}
              dataProvider={dataProvider}
              notificationProvider={useNotificationProvider()}
              routerProvider={routerProvider}
              resources={[
                { name: "dashboard", list: "/", meta: { label: "Dashboard", icon: <FlaskConical /> } },
                { name: "patients", list: "/patients", meta: { label: "Patients", icon: <Users /> } },
                { name: "orders", list: "/orders", meta: { label: "Lab Orders", icon: <ClipboardList /> } },
                { name: "investigations", list: "/investigations", meta: { label: "Investigations", icon: <Microscope /> } },
                { name: "facilities", list: "/facilities", meta: { label: "Referring Facilities", icon: <Building2 /> } },
                { name: "users", list: "/users", meta: { label: "User Management", icon: <UserCog />, canDelete: false } },
                { name: "reports", list: "/reports", meta: { label: "Reports", icon: <BarChart3 /> } },
                { name: "claims", list: "/claims", meta: { label: "NHIA Claims", icon: <ShieldCheck /> } },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                title: { text: "Encarta Lab Manager", icon: <FlaskConical /> },
                projectId: "PzJ7xv-V7qSg0-jCeiFi",
              }}
            >
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <Authenticated key="lab-dashboard" redirectOnFail="/login">
                      <Layout>
                        <Outlet />
                      </Layout>
                    </Authenticated>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="/patients" element={<ResourceGuard resource="patients" section="patients" />} />
                  <Route path="/orders" element={<ResourceGuard resource="orders" section="orders" />} />
                  <Route path="/investigations" element={<ResourceGuard resource="investigations" section="investigations" />} />
                  <Route path="/facilities" element={<ResourceGuard resource="facilities" section="facilities" />} />
                  <Route path="/users" element={<ResourceGuard resource="users" section="users" />} />
                  <Route path="/reports" element={<ResourceGuard resource="reports" section="reports" />} />
                  <Route path="/claims" element={<ResourceGuard resource="claims" section="claims" />} />
                  <Route path="*" element={<ErrorComponent />} />
                </Route>
              </Routes>
              <Toaster />
              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
            <DevtoolsPanel />
          </DevtoolsProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
