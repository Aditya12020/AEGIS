import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  badgeNumber?: string | null;
  role: 'USER' | 'OFFICER';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; name: string; badgeNumber?: string; role?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aegis_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aegis_auth_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function verifySession() {
      const storedToken = localStorage.getItem('aegis_auth_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.auth.me();
        if (res && res.user) {
          setUser(res.user);
          localStorage.setItem('aegis_auth_user', JSON.stringify(res.user));
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }
    verifySession();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.auth.login(credentials);
    if (res && res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('aegis_auth_token', res.token);
      localStorage.setItem('aegis_auth_user', JSON.stringify(res.user));
    }
  };

  const register = async (data: { email: string; password: string; name: string; badgeNumber?: string; role?: string }) => {
    const res = await api.auth.register(data);
    if (res && res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('aegis_auth_token', res.token);
      localStorage.setItem('aegis_auth_user', JSON.stringify(res.user));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('aegis_auth_token');
    localStorage.removeItem('aegis_auth_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
