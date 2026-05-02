# Monitoring Pack

This folder contains production-ready monitoring artifacts for the backend.

## Included

- Prometheus metrics endpoint: controlled by METRICS_ENABLED and METRICS_ROUTE.
- Grafana dashboard JSON: monitoring/grafana/fixo-backend-overview.dashboard.json
- Prometheus alerts: monitoring/prometheus/alerts.yml
- Prometheus scrape sample: monitoring/prometheus/prometheus.scrape.example.yml

## Endpoint Security

If METRICS_AUTH_TOKEN is set, metrics scrape requests must include either:
- Authorization: Bearer <token>
- x-metrics-token: <token>

## Key Metrics

- fixo_http_requests_total
- fixo_http_request_duration_seconds
- fixo_http_requests_in_flight
- fixo_socket_connected_clients
- fixo_socket_connections_total
- fixo_socket_disconnects_total
- fixo_socket_events_total
- fixo_socket_ekyc_rooms_active
- fixo_process_resident_memory_bytes

## Recommended Alert Thresholds

- 5xx error ratio > 2% for 10m
- API p95 latency > 1.2s for 10m
- in-flight requests > 500 for 5m
- socket connected clients > 5000 for 10m
- disconnect rate > 200/min for 10m
- process RSS > 1.5GB for 10m

Tune thresholds after observing your real traffic baseline.
