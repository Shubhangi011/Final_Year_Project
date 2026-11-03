import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem('ks_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractErrorMessage(err: any): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || 'Request failed';
  }
  return err?.message || 'Unexpected error occurred';
}
