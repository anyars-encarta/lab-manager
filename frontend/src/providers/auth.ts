import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "./constants";

export type LabUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "frontdesk" | "account" | "technician" | "doctor";
  active: boolean;
  image?: string;
};

let establishedAuthenticated = false;
let completedAuthProbe = false;

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
};

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        success: false,
        error: new Error(body?.message || "Invalid email or password"),
      };
    }
    await request("/api/me");
    establishedAuthenticated = true;
    completedAuthProbe = true;
    return { success: true, redirectTo: "/" };
  },
  logout: async () => {
    const response = await fetch(`${API_URL}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (!response || !response.ok) {
      return {
        success: false,
        error: new Error("Unable to sign out. Check your connection and retry."),
      };
    }
    establishedAuthenticated = false;
    completedAuthProbe = true;
    return { success: true, redirectTo: "/login" };
  },
  check: async () => {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/me`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      if (completedAuthProbe && establishedAuthenticated) {
        return { authenticated: true, error: new Error("Unable to verify session; preserving the current session") };
      }
      return { authenticated: false, error: new Error("Unable to check authentication") };
    }
    if (response.ok) {
      establishedAuthenticated = true;
      completedAuthProbe = true;
      return { authenticated: true };
    }
    if (response.status === 401 || response.status === 403) {
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true, error: new Error(`Session check failed (${response.status})`) };
  },
  getIdentity: async () => {
    const result = await request("/api/me");
    const user = result.user as LabUser;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.image,
    };
  },
  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },
};
