import { Authenticated, Refine, type AccessControlProvider } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerProvider, {
  DocumentTitleHandler,
  NavigateToResource,
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
import { Dashboard } from "./pages/laboratory/dashboard";
import { LaboratoryWorkspace } from "./pages/laboratory/workspace";
import { Login } from "./pages/login";
import { authProvider } from "./providers/auth";
import { dataProvider } from "./providers/data";

const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    try {
      const identity = await authProvider.getIdentity?.({});
      const role = (identity as { role?: string } | undefined)?.role;
      if (!role) return { can: false };
      if (role === "admin") return { can: true };
      if (resource === "users" || resource === "facilities") return { can: false };
      if (resource === "claims" && role !== "admin") return { can: false };
      if (resource === "investigations" && action === "create") return { can: role === "admin" };
      if (resource === "patients" && !["frontdesk", "admin"].includes(role)) return { can: false };
      if (resource === "orders" && action === "create") return { can: ["frontdesk", "admin"].includes(role) };
      if (resource === "orders" && action === "edit") return { can: ["account", "technician", "admin"].includes(role) };
      return { can: true };
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
                { name: "facilities", list: "/facilities", meta: { label: "Facilities", icon: <Building2 /> } },
                { name: "users", list: "/users", meta: { label: "User Management", icon: <UserCog />, canDelete: false } },
                { name: "reports", list: "/reports", meta: { label: "Reports", icon: <BarChart3 /> } },
                { name: "claims", list: "/claims", meta: { label: "NHIA Claims", icon: <ShieldCheck /> } },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                title: { text: "LabManager", icon: <FlaskConical /> },
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
                  <Route index element={<NavigateToResource resource="dashboard" />} />
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/patients" element={<LaboratoryWorkspace section="patients" />} />
                  <Route path="/orders" element={<LaboratoryWorkspace section="orders" />} />
                  <Route path="/investigations" element={<LaboratoryWorkspace section="investigations" />} />
                  <Route path="/facilities" element={<LaboratoryWorkspace section="facilities" />} />
                  <Route path="/users" element={<LaboratoryWorkspace section="users" />} />
                  <Route path="/reports" element={<LaboratoryWorkspace section="reports" />} />
                  <Route path="/claims" element={<LaboratoryWorkspace section="claims" />} />
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
