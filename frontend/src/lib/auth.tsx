import React, { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, saveToken } from "./api";

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "Admin" | "Manager" | "Agent" | "Member";
};

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (e: string, p: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        if (t) {
          const me = (await api.me()) as User;
          setUser(me);
        }
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const res = await api.login(email, password);
    await saveToken(res.access_token);
    setUser(res.user);
  }

  async function signOut() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
