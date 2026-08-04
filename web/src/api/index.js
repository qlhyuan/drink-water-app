import http from './http';

export const authApi = {
  login: (username, password) => http.post('/auth/login', { username, password }),
  register: (username, password, nickname) =>
    http.post('/auth/register', { username, password, nickname }),
  feishuConfig: () => http.get('/feishu/config'),
  feishuBind: (code) => http.post('/feishu/bind', { code }),
};

export const userApi = {
  me: () => http.get('/user'),
  update: (data) => http.put('/user', data),
  onboarding: (data) => http.post('/user/onboarding', data),
};

export const recordApi = {
  list: (date) => http.get('/records', { params: { date } }),
  add: (data) => http.post('/records', data),
  remove: (id) => http.delete(`/records/${id}`),
  undo: () => http.post('/records/undo'),
};

export const statsApi = {
  overview: (days = 7) => http.get('/stats/overview', { params: { days } }),
  today: () => http.get('/stats/today'),
};

export const cupApi = {
  list: () => http.get('/cups'),
  add: (data) => http.post('/cups', data),
  remove: (id) => http.delete(`/cups/${id}`),
};

export const reminderApi = {
  get: () => http.get('/reminders'),
  update: (data) => http.put('/reminders', data),
};