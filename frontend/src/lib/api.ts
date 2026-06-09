"use client";

import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth-store";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refresh, setAccessToken, logout } = useAuthStore.getState();
  if (!refresh) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post(`${API_URL}/api/users/token/refresh/`, { refresh })
    .then((res) => {
      const next = (res.data as { access: string }).access;
      setAccessToken(next);
      return next;
    })
    .catch(() => {
      logout();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/users/token/refresh/") &&
      !original.url?.includes("/users/login-via-email/") &&
      !original.url?.includes("/users/login-via-username/")
    ) {
      original._retry = true;
      const next = await refreshAccessToken();
      if (next) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${next}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  }
);

export function asApiError(err: unknown): { message: string; raw?: unknown } {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.detail === "string") return { message: data.detail, raw: data };
      const firstField = Object.entries(data).find(
        ([, v]) => Array.isArray(v) || typeof v === "string"
      );
      if (firstField) {
        const v = firstField[1];
        const msg = Array.isArray(v) ? String(v[0]) : String(v);
        return { message: `${firstField[0]}: ${msg}`, raw: data };
      }
    }
    return { message: err.message, raw: err };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Неизвестная ошибка" };
}