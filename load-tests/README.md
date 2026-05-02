# k6 Load Testing Pack

This folder contains baseline load tests for API and Socket.IO capacity checks.

## Prerequisites

- k6 installed on your machine.
- Server running and reachable.
- Optional: valid bearer token for authenticated API routes.

## API Load Test

Run:

npm run loadtest:api

Optional environment variables:
- API_BASE_URL (default: http://localhost:5000/api)
- AUTH_TOKEN (optional bearer token)

## Socket Soak Test

Run:

npm run loadtest:socket

Optional environment variables:
- SOCKET_URL (default: http://localhost:5000)
- SOCKET_SESSION_MS (default: 30000)
- SOCKET_EVENT_INTERVAL_MS (default: 5000)

## Combined Run

Run:

npm run loadtest:all

## What to watch during tests

- fixo_http_request_duration_seconds (p95, p99)
- fixo_http_requests_total and 5xx ratio
- fixo_http_requests_in_flight
- fixo_socket_connected_clients
- fixo_socket_connections_total / fixo_socket_disconnects_total
- CPU, memory, and DB connection usage
