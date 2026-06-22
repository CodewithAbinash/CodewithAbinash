import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

async function token(): Promise<string | null> {
  return await storage.secureGet<string>("jwt", "");
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const t = await token();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user: any }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  register: (body: any) =>
    request("/auth/register", { method: "POST", body, auth: false }),
  me: () => request("/auth/me"),

  // dashboard
  dashboard: () => request("/dashboard"),

  // members
  listMembers: () => request<any[]>("/members"),
  addMember: (body: any) => request("/members", { method: "POST", body }),
  getMember: (id: string) => request(`/members/${id}`),

  // accounts
  listAccounts: () => request<any[]>("/accounts"),
  addAccount: (body: any) => request("/accounts", { method: "POST", body }),

  // loans
  listLoans: () => request<any[]>("/loans"),
  applyLoan: (body: any) => request("/loans", { method: "POST", body }),
  approveLoan: (id: string) =>
    request(`/loans/${id}/approve`, { method: "POST" }),
  rejectLoan: (id: string) =>
    request(`/loans/${id}/reject`, { method: "POST" }),
  loanSchedule: (id: string) => request(`/loans/${id}/schedule`),
  payEmi: (id: string) => request(`/loans/${id}/pay-emi`, { method: "POST" }),

  // passbook (member self-view)
  passbook: () => request("/passbook"),

  // settings
  getSettings: () => request("/settings"),
  updateSettings: (body: any) =>
    request("/settings", { method: "PUT", body }),

  // transactions
  listTxns: () => request<any[]>("/transactions"),
  addTxn: (body: any) => request("/transactions", { method: "POST", body }),

  // notices
  listNotices: () => request<any[]>("/notices"),
  addNotice: (body: any) => request("/notices", { method: "POST", body }),

  // rules
  rules: () => request("/rules"),
};

export async function saveToken(t: string) {
  await storage.secureSet("jwt", t);
}
export async function clearToken() {
  await storage.secureRemove("jwt");
}
export async function getToken() {
  return await storage.secureGet<string>("jwt", "");
}
