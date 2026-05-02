import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE_URL = (__ENV.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  tags: {
    service: 'fixo-api',
    test_type: 'api-smoke',
  },
  scenarios: {
    baseline_traffic: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 300,
      stages: [
        { target: 20, duration: '2m' },
        { target: 60, duration: '5m' },
        { target: 120, duration: '5m' },
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<900', 'p(99)<1800'],
    checks: ['rate>0.97'],
  },
};

function authHeaders() {
  if (!AUTH_TOKEN) return {};
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };
}

function hitPublicEndpoints() {
  const health = http.get(`${API_BASE_URL}/health`);
  check(health, {
    'health status is 200': (r) => r.status === 200,
    'health payload has status': (r) => r.json('status') === 'ok',
  });

  const ready = http.get(`${API_BASE_URL}/ready`);
  check(ready, {
    'ready returns 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  const categories = http.get(`${API_BASE_URL}/customer/categories`);
  check(categories, {
    'categories status is 200': (r) => r.status === 200,
  });

  const banners = http.get(`${API_BASE_URL}/customer/banners`);
  check(banners, {
    'banners status is 200': (r) => r.status === 200,
  });
}

function hitAuthenticatedEndpoints() {
  if (!AUTH_TOKEN) return;

  const workerRequests = http.get(`${API_BASE_URL}/worker/work-requests`, {
    headers: authHeaders(),
  });

  check(workerRequests, {
    'worker requests status is 200': (r) => r.status === 200,
  });

  const customerBookings = http.get(`${API_BASE_URL}/customer/bookings`, {
    headers: authHeaders(),
  });

  check(customerBookings, {
    'customer bookings status is 200': (r) => r.status === 200,
  });
}

export default function () {
  hitPublicEndpoints();
  hitAuthenticatedEndpoints();
  sleep(Math.random() * 0.8 + 0.2);
}
