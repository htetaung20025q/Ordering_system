import { apiClient, API_BASE, getAuthToken } from './client';
import { RestaurantTable, AdminAnalyticsResponse } from '@/types';

export async function fetchAdminAnalytics(range: 'today' | '7d' | '30d' = '7d'): Promise<AdminAnalyticsResponse> {
  return apiClient<AdminAnalyticsResponse>(`/admin/analytics?range=${range}`);
}

export async function fetchAdminTables(): Promise<RestaurantTable[]> {
  return apiClient<RestaurantTable[]>('/admin/tables');
}

export async function createAdminTable(tableNumber: string, seatingCapacity: number): Promise<RestaurantTable> {
  return apiClient<RestaurantTable>('/admin/tables', {
    method: 'POST',
    body: JSON.stringify({
      table_number: tableNumber,
      seating_capacity: seatingCapacity,
    }),
  });
}

export async function updateAdminTable(
  tableId: number,
  data: { table_number?: string; seating_capacity?: number; is_active?: boolean }
): Promise<RestaurantTable> {
  return apiClient<RestaurantTable>(`/admin/tables/${tableId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function rotateTableQR(tableId: number): Promise<{ message: string; qr_token: string; previous_qr_token: string }> {
  return apiClient(`/admin/tables/${tableId}/rotate-qr`, {
    method: 'POST',
  });
}

export function getTableQrUrl(tableId: number, format: 'png' | 'svg' = 'png'): string {
  const token = getAuthToken();
  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
  return `${API_BASE}/admin/tables/${tableId}/qr?format=${format}${tokenQuery}`;
}

export function getTableCardUrl(tableId: number): string {
  const token = getAuthToken();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${API_BASE}/admin/tables/${tableId}/card${tokenQuery}`;
}

export async function deleteAdminTable(tableId: number): Promise<{ message: string; table_id: number }> {
  return apiClient<{ message: string; table_id: number }>(`/admin/tables/${tableId}`, {
    method: 'DELETE',
  });
}
