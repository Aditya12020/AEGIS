const BASE = '/api';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('aegis_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const parsed = JSON.parse(errorText);
      throw new Error(parsed.error || errorText);
    } catch {
      throw new Error(errorText);
    }
  }
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getHeaders(),
  };
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const parsed = JSON.parse(errorText);
      throw new Error(parsed.error || errorText);
    } catch {
      throw new Error(errorText);
    }
  }
  return res.json();
}

export const api = {
  health: () => get<{ status: string }>('/health'),
  auth: {
    login: (credentials: { email: string; password: string }) =>
      post<{ token: string; user: any }>('/auth/login', credentials),
    register: (data: { email: string; password: string; name: string; badgeNumber?: string; role?: string }) =>
      post<{ token: string; user: any }>('/auth/register', data),
    me: () => get<{ user: any }>('/auth/me'),
  },
  incidents: {
    list: () => get<any[]>('/incidents'),
    get: (code: string) => get<any>('/incidents/' + code),
    create: (body: any) => post<any>('/incidents', body),
  },
  investigations: {
    status: (code: string) => get<any>('/investigations/' + code + '/status'),
    run: (code: string) => post<any>('/investigations/' + code + '/run'),
  },
  satellite: Object.assign(
    (code: string) => get<any>('/satellite/' + code),
    {
      get: (code: string) => get<any>('/satellite/' + code),
      search: (params: { minLat: number; minLon: number; maxLat: number; maxLon: number; startDate?: string; endDate?: string; limit?: number }) =>
        post<any>('/satellite/search', params),
    }
  ),
  timeMachine: (code: string) => get<any>('/time-machine/' + code),
  drift: (code: string) => get<any>('/drift/' + code),
  origin: (code: string) => get<any>('/origin/' + code),
  ais: (code: string) => get<any>('/ais/' + code + '/vessels'),
  suspects: (code: string) => get<any>('/suspects/' + code),
  report: (code: string) => get<any>('/reports/' + code),
  weather: {
    status: () => get<any>('/weather/status'),
    getPoint: (lat: number, lon: number, timestamp: string) =>
      get<any>(`/weather/era5/point?lat=${lat}&lon=${lon}&timestamp=${encodeURIComponent(timestamp)}`),
    getForIncident: (code: string) => get<any>(`/weather/era5/incident/${code}`),
    request: (body: { latitude: number; longitude: number; timestamp: string; bbox?: number[]; async?: boolean }) =>
      post<any>('/weather/era5/request', body),
    jobStatus: (jobId: string) => get<any>(`/weather/era5/jobs/${jobId}`),
    files: () => get<any>('/weather/era5/files'),
  },
};
