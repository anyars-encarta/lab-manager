import type { BaseRecord, DataProvider } from "@refinedev/core";
import { API_URL } from "./constants";

const resourcePaths: Record<string, string> = {
  users: "/api/users",
  facilities: "/api/facilities",
  investigations: "/api/investigations",
  patients: "/api/patients",
  orders: "/api/orders",
  claims: "/api/nhia/claims",
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
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
    throw Object.assign(new Error(message), { statusCode: response.status });
  }
  return response.status === 204 ? (null as T) : response.json();
};

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination }: any) => {
    const path = resourcePaths[resource] || `/api/${resource}`;
    const page = pagination?.currentPage ?? pagination?.current ?? 1;
    const pageSize = pagination?.pageSize ?? 100;
    const data = await request<TData[]>(`${path}?page=${page}&pageSize=${pageSize}`);
    return { data: Array.isArray(data) ? data : [], total: Array.isArray(data) ? data.length : 0 };
  },
  getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: any) => {
    const path = resourcePaths[resource] || `/api/${resource}`;
    const data = await request<TData>(`${path}/${id}`);
    return { data };
  },
  getMany: async <TData extends BaseRecord = BaseRecord>({ resource, ids }: any) => ({
    data: await Promise.all(ids.map((id: BaseRecord["id"]) => request<TData>(`${resourcePaths[resource] || `/api/${resource}`}/${id}`))),
  }),
  create: async <TData extends BaseRecord = BaseRecord, _TVariables = {}>({ resource, variables }: any) => {
    const path = resourcePaths[resource] || `/api/${resource}`;
    const data = await request<TData>(path, { method: "POST", body: JSON.stringify(variables) });
    return { data };
  },
  update: async <TData extends BaseRecord = BaseRecord, _TVariables = {}>({ resource, id, variables }: any) => {
    const path = resourcePaths[resource] || `/api/${resource}`;
    const data = await request<TData>(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(variables) });
    return { data };
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord, _TVariables = {}>({ resource, id }: any) => {
    const path = resourcePaths[resource] || `/api/${resource}`;
    await request(`${path}/${id}`, { method: "DELETE" });
    return { data: { id } as TData };
  },
  getApiUrl: () => API_URL,
};
