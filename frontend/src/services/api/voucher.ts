import { apiClient, API_BASE, getAuthToken } from './client';
import { OrderVoucherResponse } from '@/types';

export async function fetchOrderVoucher(orderId: number): Promise<OrderVoucherResponse> {
  return apiClient<OrderVoucherResponse>(`/orders/${orderId}/voucher`);
}

export async function downloadVoucherPdf(orderId: number, orderNumber: string): Promise<void> {
  const url = `${API_BASE}/orders/${orderId}/voucher/pdf`;
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error('Failed to generate PDF voucher');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = `VOUCHER-${orderNumber || orderId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}
