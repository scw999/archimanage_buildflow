import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";
import { queryClient } from "./queryClient";

const API_BASE = import.meta.env.VITE_API_URL || "";

type SafeUser = Omit<User, "password">;

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "로그인에 실패했습니다");
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    setUser(null);
    setToken(null);
    queryClient.clear();
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper: create fetch that includes auth token
export function useAuthFetch() {
  const { token } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return fetch(`${API_BASE}${url}`, { ...options, headers });
    },
    [token]
  );
}
