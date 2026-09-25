import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

export type CustomFetchOptions = RequestInit & {
  responseType?: 'json' | 'text' | 'blob' | 'auto';
};

export type AuthTokenGetter = () => Promise<string | null> | string | null;

let baseUrl: string | null = null;
let authTokenGetter: AuthTokenGetter | null = null;
const clerkAuthProvider = process.env.EXPO_PUBLIC_CLERK_AUTH_PROVIDER;

export function setBaseUrl(url: string | null): void {
  baseUrl = url ? url.replace(/\/+$/, '') : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  authTokenGetter = getter;
}

export class ApiError<T = unknown> extends Error {
  readonly name = 'ApiError';
  readonly status: number;
  readonly data: T | null;

  constructor(response: Response, data: T | null) {
    super(`HTTP ${response.status} ${response.statusText}`);
    this.status = response.status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  options: CustomFetchOptions = {},
): Promise<T> {
  const { responseType = 'json', headers: initialHeaders, ...init } = options;
  const url = baseUrl && path.startsWith('/') ? `${baseUrl}${path}` : path;
  const headers = new Headers(initialHeaders);

  if (clerkAuthProvider === 'external' && !headers.has('x-clerk-auth-provider')) {
    headers.set('x-clerk-auth-provider', 'external');
  }

  if (authTokenGetter && !headers.has('authorization')) {
    const token = await authTokenGetter();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  if (typeof init.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      try {
        data = await response.text();
      } catch {
        data = null;
      }
    }
    throw new ApiError(response, data);
  }

  if (response.status === 204 || response.status === 205) {
    return null as T;
  }
  if (responseType === 'text') return (await response.text()) as T;
  if (responseType === 'blob') return (await response.blob()) as T;
  return (await response.json()) as T;
}

export interface WarungState {
  menus: Record<string, unknown>[];
  activeOrders: Record<string, unknown>[];
  kitchenOrders: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  stockMovements?: Record<string, unknown>[];
  consignments: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  sales: Record<string, unknown>[];
  auditTrail?: Record<string, unknown>[];
  cashClosures: Record<string, unknown>[];
  savingsRules: Record<string, unknown>[];
  savingsEntries: Record<string, unknown>[];
  qrisImageUri?: string | null;
  [key: string]: unknown;
}

export interface SaveWarungStateBody {
  state: WarungState;
  baseVersion: number | null;
}

export interface WarungStateResponse {
  state: WarungState;
  version: number;
  updatedAt: string;
}

export interface WarungStateConflict {
  error: 'WARUNG_STATE_CONFLICT';
  state: WarungState;
  version: number;
  updatedAt: string;
}

export interface SaveDriveBackupBody {
  state: WarungState;
}

export interface SaveDriveBackupResponse {
  id: string;
  name: string;
  webViewLink: string | null;
  createdAt: string;
}

export interface DriveImageUploadBody {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
}

export interface DriveImageUploadResponse {
  id: string;
  name?: string;
  mimeType: string;
}

export interface DriveImageResponse {
  id: string;
  name?: string;
  mimeType: string;
  base64: string;
}

export interface DriveBackupSummary {
  id: string;
  name: string;
  createdAt: string;
  webViewLink?: string | null;
}

export interface DriveBackupListResponse {
  backups: DriveBackupSummary[];
}

export interface RestoreDriveBackupResponse {
  format: 'kasir-miso-backup';
  version: 1;
  target: 'google-drive';
  createdAt: string;
  data: WarungState;
}

export interface DriveConnectionResponse {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export interface ConnectDriveBody {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface DisconnectDriveResponse {
  disconnected: boolean;
}

export async function getWarungState(
  options?: CustomFetchOptions,
): Promise<WarungStateResponse> {
  return request<WarungStateResponse>('/api/warung/state', {
    ...options,
    method: 'GET',
  });
}

export async function saveWarungState(
  data: SaveWarungStateBody,
  options?: CustomFetchOptions,
): Promise<WarungStateResponse> {
  return request<WarungStateResponse>('/api/warung/state', {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
  });
}

export async function saveDriveBackup(
  data: SaveDriveBackupBody,
  options?: CustomFetchOptions,
): Promise<SaveDriveBackupResponse> {
  return request<SaveDriveBackupResponse>('/api/drive/backup', {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
  });
}

export async function uploadDriveImage(
  data: DriveImageUploadBody,
  options?: CustomFetchOptions,
): Promise<DriveImageUploadResponse> {
  return request<DriveImageUploadResponse>('/api/drive/image', {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
  });
}

export async function getDriveImage(
  fileId: string,
  options?: CustomFetchOptions,
): Promise<DriveImageResponse> {
  return request<DriveImageResponse>(
    `/api/drive/image/${encodeURIComponent(fileId)}`,
    {
      ...options,
      method: 'GET',
    },
  );
}

export async function listDriveBackups(
  options?: CustomFetchOptions,
): Promise<DriveBackupListResponse> {
  return request<DriveBackupListResponse>('/api/drive/backups', {
    ...options,
    method: 'GET',
  });
}

export async function restoreDriveBackup(
  data: { fileId: string },
  options?: CustomFetchOptions,
): Promise<RestoreDriveBackupResponse> {
  return request<RestoreDriveBackupResponse>('/api/drive/restore', {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
  });
}

export async function getDriveConnection(
  options?: CustomFetchOptions,
): Promise<DriveConnectionResponse> {
  return request<DriveConnectionResponse>('/api/drive/connection', {
    ...options,
    method: 'GET',
  });
}

export async function connectDrive(
  data: ConnectDriveBody,
  options?: CustomFetchOptions,
): Promise<DriveConnectionResponse> {
  return request<DriveConnectionResponse>('/api/drive/oauth/exchange', {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
  });
}

export async function disconnectDrive(
  options?: CustomFetchOptions,
): Promise<DisconnectDriveResponse> {
  return request<DisconnectDriveResponse>('/api/drive/oauth/disconnect', {
    ...options,
    method: 'DELETE',
  });
}

function queryKey(path: string) {
  return [path] as const;
}

export function getGetDriveConnectionQueryKey() {
  return queryKey('/api/drive/connection');
}

export function getListDriveBackupsQueryKey() {
  return queryKey('/api/drive/backups');
}

function useApiQuery<T>(
  path: string,
  fetcher: (options: CustomFetchOptions) => Promise<T>,
  options?: { query?: UseQueryOptions<T, unknown, T>; request?: CustomFetchOptions },
): UseQueryResult<T, unknown> & { queryKey: readonly [string] } {
  const key = options?.query?.queryKey ?? queryKey(path);
  const query = useQuery({
    ...(options?.query ?? {}),
    queryKey: key,
    queryFn: ({ signal }) => fetcher({ signal, ...options?.request }),
  }) as UseQueryResult<T, unknown> & { queryKey: readonly [string] };
  query.queryKey = key as readonly [string];
  return query;
}

export function useGetDriveConnection(
  options?: { query?: UseQueryOptions<DriveConnectionResponse>; request?: CustomFetchOptions },
) {
  return useApiQuery('/api/drive/connection', getDriveConnection, options);
}

export function useListDriveBackups(
  options?: { query?: UseQueryOptions<DriveBackupListResponse>; request?: CustomFetchOptions },
) {
  return useApiQuery('/api/drive/backups', listDriveBackups, options);
}

function useApiMutation<TData, TVariables>(
  mutationKey: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: { mutation?: UseMutationOptions<TData, unknown, TVariables> },
) {
  return useMutation({
    mutationKey: [mutationKey],
    mutationFn,
    ...(options?.mutation ?? {}),
  });
}

export function useConnectDrive(
  options?: { mutation?: UseMutationOptions<DriveConnectionResponse, unknown, { data: ConnectDriveBody }> },
) {
  return useApiMutation('connectDrive', ({ data }) => connectDrive(data), options);
}

export function useDisconnectDrive(
  options?: { mutation?: UseMutationOptions<DisconnectDriveResponse, unknown, void> },
) {
  return useApiMutation('disconnectDrive', () => disconnectDrive(), options);
}

export function useSaveDriveBackup(
  options?: { mutation?: UseMutationOptions<SaveDriveBackupResponse, unknown, { data: SaveDriveBackupBody }> },
) {
  return useApiMutation('saveDriveBackup', ({ data }) => saveDriveBackup(data), options);
}