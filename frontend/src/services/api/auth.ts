import { apiClient, setAuthToken } from './client';
import { LoginResponse, UserResponse } from '@/types';

export async function loginStaff(username: string, password: string): Promise<LoginResponse> {
  const res = await apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username_or_email: username,
      password: password,
    }),
  });
  if (res.access_token) {
    setAuthToken(res.access_token);
  }
  return res;
}

export async function logoutStaff(): Promise<void> {
  try {
    await apiClient('/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}

export async function getMe(): Promise<UserResponse> {
  return apiClient<UserResponse>('/auth/me');
}
