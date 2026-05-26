import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { env } from '../config/env';
import type { Company, CollaboratorListItem, ExecutiveDashboardData, AuditLogEntry } from '../types';

const api = axios.create({ baseURL: env.apiBasePath, timeout: 10000 });

api.interceptors.request.use(async (cfg) => {
  try {
    const token = await SecureStore.getItemAsync(env.authTokenKey);
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return cfg;
});

export function useExecutiveDashboard() {
  const year = new Date().getFullYear();
  return useQuery({
    queryKey: ['exec-dashboard', year],
    queryFn: () => api.get<ExecutiveDashboardData>(`/dashboard/executive?year=${year}`).then(r => r.data),
    retry: false,
    staleTime: 60000,
  });
}

export function useCompanies(search?: string, status?: string) {
  return useQuery({
    queryKey: ['companies', search, status],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status && status !== 'all') p.set('status', status);
      const qs = p.size ? `?${p}` : '';
      return api.get<Company[]>(`/companies${qs}`).then(r => r.data);
    },
    retry: false,
    staleTime: 300000,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get<Company>(`/companies/${id}`).then(r => r.data),
    enabled: !!id,
    retry: false,
  });
}

export function useCollaborators(filters?: { search?: string; status?: string; year?: number }) {
  return useQuery({
    queryKey: ['collaborators', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters?.search) p.set('search', filters.search);
      if (filters?.status && filters.status !== 'all') p.set('status', filters.status);
      if (filters?.year) p.set('year', String(filters.year));
      const qs = p.size ? `?${p}` : '';
      return api.get<CollaboratorListItem[]>(`/collaborators${qs}`).then(r => r.data);
    },
    retry: false,
    staleTime: 300000,
  });
}

export function useAudit(limit = 30) {
  return useQuery({
    queryKey: ['audit', limit],
    queryFn: () => api.get<AuditLogEntry[]>(`/audit?limit=${limit}`).then(r => r.data),
    retry: false,
    staleTime: 60000,
  });
}

export function useMunicipalitiesSearch(search: string) {
  return useQuery({
    queryKey: ['municipalities-search', search],
    queryFn: () => api.get<{ data: any[] }>(`/municipios/buscar?q=${search}`).then(r => r.data.data),
    enabled: search.length > 2,
    retry: false,
    staleTime: 300000,
  });
}
