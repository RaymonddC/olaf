'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Query key factory ────────────────────────────────────────────────────────

export const queryKeys = {
  user: (userId: string) => ['user', userId] as const,
  me: () => ['me'] as const,
  healthLogs: (userId: string, range: string) => ['health-logs', userId, range] as const,
  memories: (userId: string) => ['memories', userId] as const,
  memory: (memoryId: string) => ['memory', memoryId] as const,
  alerts: (userId: string) => ['alerts', userId] as const,
  reports: (userId: string) => ['reports', userId] as const,
  medications: (userId: string) => ['medications', userId] as const,
  familyLinks: (userId: string) => ['family-links', userId] as const,
  reminders: (userId: string) => ['reminders', userId] as const,
  conversations: (userId: string) => ['conversations', userId] as const,
};

// ── Types (matching api-contracts.md) ────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error' | 'accepted' | 'pending';
  data?: T;
  errorMessage?: string;
}

export interface LinkedAccount {
  userId: string;
  name: string;
  relationship: string;
  role: 'elderly' | 'family';
}

export interface UserProfile {
  userId: string;
  role: 'elderly' | 'family';
  name: string;
  age?: number;
  linkedAccounts: LinkedAccount[];
}

export interface MedicationTaken {
  name: string;
  time: string;
  confirmed: boolean;
}

export interface HydrationReminders {
  sent: number;
  acknowledged: number;
}

export interface HealthLog {
  id?: string;
  date: string;
  mood: string;
  moodScore: number;
  painLevel: number;
  medicationsTaken: MedicationTaken[];
  hydrationReminders: HydrationReminders;
  activityNotes: string;
}

export interface HealthReport {
  id: string;
  type: 'daily' | 'weekly';
  content: string;
  imageUrls: string[];
  moodTrend: number[];
  medicationAdherence: number;
  concerns: string[];
  highlights: string[];
  generatedAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  type: 'emotional_distress' | 'missed_medication' | 'health_anomaly' | 'inactivity';
  severity: 'low' | 'medium' | 'high';
  title?: string;
  message: string;
  source: 'companion' | 'storyteller' | 'navigator' | 'system';
  acknowledged: boolean;
  createdAt: string;
}

export interface Reminder {
  id: string;
  type: 'medication' | 'appointment' | 'hydration' | 'custom';
  message: string;
  scheduledTime: string;
  status: 'pending' | 'sent' | 'acknowledged';
  recurring: boolean;
}

export interface MemoryListItem {
  id: string;
  title: string;
  createdAt: string;
  illustrationUrls: string[];
  snippet: string;
}

export interface MemoryChapter {
  id: string;
  title: string;
  narrativeText: string;
  illustrationUrls: string[];
  audioScript: string;
  tags: string[];
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  scheduledTime: string;
  status: 'upcoming' | 'taken' | 'missed';
}

export interface Conversation {
  conversationId: string;
  summary: string;
  moodScore: number;
  sessionDuration: number;
  flags: string[];
  transcriptCount: number;
  createdAt: string;
}

// ── Auth hooks ───────────────────────────────────────────────────────────────

export function useMe(options?: Partial<UseQueryOptions<ApiResponse<UserProfile>>>) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get<ApiResponse<UserProfile>>('/api/auth/me'),
    ...options,
  });
}

// ── Health hooks ─────────────────────────────────────────────────────────────

export function useHealthLogs(
  userId: string,
  range: string = 'today',
  options?: Partial<UseQueryOptions<ApiResponse<{ logs: HealthLog[] }>>>,
) {
  return useQuery({
    queryKey: queryKeys.healthLogs(userId, range),
    queryFn: () =>
      api.get<ApiResponse<{ logs: HealthLog[] }>>(
        `/api/health/logs?userId=${encodeURIComponent(userId)}&range=${encodeURIComponent(range)}`,
      ),
    enabled: !!userId,
    ...options,
  });
}

export function useLogHealthCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; args: { mood: string; painLevel: number; notes?: string } }) =>
      api.post<ApiResponse>('/api/companion/log-health-checkin', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['health-logs', vars.userId] });
    },
  });
}

// ── Medication hooks ──────────────────────────────────────────────────────────

export function useMedications(userId: string) {
  return useQuery({
    queryKey: queryKeys.medications(userId),
    queryFn: () => api.get<Medication[]>(`/api/health/${userId}/medications`),
    enabled: !!userId,
  });
}

// ── Report hooks ────────────────────────────────────────────────────────────

export function useReports(
  userId: string,
  type?: 'daily' | 'weekly',
  options?: Partial<UseQueryOptions<ApiResponse<{ reports: HealthReport[] }>>>,
) {
  const params = new URLSearchParams({ userId });
  if (type) params.set('type', type);
  return useQuery({
    queryKey: queryKeys.reports(userId),
    queryFn: () =>
      api.get<ApiResponse<{ reports: HealthReport[] }>>(`/api/health/reports?${params}`),
    enabled: !!userId,
    ...options,
  });
}

// ── Alert hooks ───────────────────────────────────────────────────────────────

export function useAlerts(
  userId: string,
  acknowledged?: boolean,
  options?: Partial<UseQueryOptions<ApiResponse<{ alerts: Alert[] }>>>,
) {
  const params = new URLSearchParams({ userId });
  if (acknowledged !== undefined) params.set('acknowledged', String(acknowledged));
  return useQuery({
    queryKey: queryKeys.alerts(userId),
    queryFn: () =>
      api.get<ApiResponse<{ alerts: Alert[] }>>(`/api/alerts?${params}`),
    enabled: !!userId,
    refetchInterval: 30_000,
    ...options,
  });
}

export function useAcknowledgeAlert(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      api.patch<ApiResponse>(`/api/alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts(userId) });
    },
  });
}

// ── Memory hooks ─────────────────────────────────────────────────────────────

interface MemoriesResponse {
  status: string;
  data: {
    memories: MemoryListItem[];
    total: number;
    hasMore: boolean;
  };
}

interface MemoryDetailResponse {
  status: string;
  data: MemoryChapter;
}

export function useMemories(userId: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: [...queryKeys.memories(userId), limit, offset],
    queryFn: async () => {
      const res = await api.get<MemoriesResponse>(
        `/api/storyteller/memories?userId=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`,
      );
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useMemory(memoryId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.memory(memoryId),
    queryFn: async () => {
      const res = await api.get<MemoryDetailResponse>(
        `/api/storyteller/memories/${encodeURIComponent(memoryId)}?userId=${encodeURIComponent(userId)}`,
      );
      return res.data;
    },
    enabled: !!memoryId && !!userId,
  });
}

export function useCreateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; transcript: string; title?: string }) =>
      api.post('/api/storyteller/create-memory', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.memories(vars.userId) });
    },
  });
}

// ── Reminder hooks ──────────────────────────────────────────────────────────

export function useReminders(userId: string, status?: string) {
  const params = new URLSearchParams({ userId });
  if (status) params.set('status', status);
  return useQuery({
    queryKey: queryKeys.reminders(userId),
    queryFn: () =>
      api.get<ApiResponse<{ reminders: Reminder[] }>>(`/api/health/reminders?${params}`),
    enabled: !!userId,
  });
}

// ── Family link hooks ─────────────────────────────────────────────────────────

export interface FamilyLink {
  linkedUserId: string;
  displayName: string;
  relationship: string;
}

export function useFamilyLinks(userId: string) {
  return useQuery({
    queryKey: queryKeys.familyLinks(userId),
    queryFn: () => api.get<FamilyLink[]>(`/api/auth/${userId}/family-links`),
    enabled: !!userId,
  });
}

// ── Notification hooks ──────────────────────────────────────────────────────

export function useRegisterFCMToken() {
  return useMutation({
    mutationFn: (data: { token: string; deviceId?: string }) =>
      api.post<ApiResponse>('/api/notifications/register-token', {
        token: data.token,
        device_id: data.deviceId ?? '',
      }),
  });
}

// ── Conversation hooks ───────────────────────────────────────────────────────

interface ConversationsResponse {
  status: string;
  data: {
    conversations: Conversation[];
    total: number;
  };
}

export function useConversations(
  userId: string,
  limit = 20,
  options?: Partial<UseQueryOptions<ConversationsResponse>>,
) {
  return useQuery({
    queryKey: queryKeys.conversations(userId),
    queryFn: () =>
      api.get<ConversationsResponse>(
        `/api/companion/conversations?userId=${encodeURIComponent(userId)}&limit=${limit}`,
      ),
    enabled: !!userId,
    ...options,
  });
}

// ── Notification preferences hooks ─────────────────────────────────────────

export interface NotificationPrefs {
  alertsEnabled: boolean;
  dailyReportEnabled: boolean;
  weeklyReportEnabled: boolean;
  emailDigestEnabled: boolean;
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; prefs: NotificationPrefs }) =>
      api.patch<ApiResponse>(`/api/auth/notification-prefs`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}
