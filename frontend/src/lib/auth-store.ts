"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "./types";

interface AuthState {
  access: string | null;
  refresh: string | null;
  user: User | null;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  setAccessToken: (access: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      setTokens: ({ access, refresh }) => set({ access, refresh }),
      setAccessToken: (access) => set({ access }),
      setUser: (user) => set({ user }),
      logout: () => set({ access: null, refresh: null, user: null }),
    }),
    {
      name: "qoima.auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        access: state.access,
        refresh: state.refresh,
        user: state.user,
      }),
    }
  )
);