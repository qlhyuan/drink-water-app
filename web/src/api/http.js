import axios from 'axios';
import { showToast } from 'vant';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r.data,
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.error || err.message || '请求失败';
    if (status === 401 && location.pathname !== '/login') {
      localStorage.removeItem('token');
      location.href = '/login';
    } else if (status && status !== 401) {
      showToast({ message: msg, type: 'fail' });
    }
    return Promise.reject(err);
  },
);

export default http;