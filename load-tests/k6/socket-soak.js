import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const socketConnectSuccess = new Rate('socket_connect_success');
const socketProtocolErrors = new Counter('socket_protocol_errors_total');

const SOCKET_BASE = (__ENV.SOCKET_URL || 'http://localhost:5000').replace(/\/$/, '');
const SESSION_MS = Number(__ENV.SOCKET_SESSION_MS || '30000');
const EVENT_INTERVAL_MS = Number(__ENV.SOCKET_EVENT_INTERVAL_MS || '5000');

function toWebSocketEndpoint(baseUrl) {
  if (baseUrl.startsWith('https://')) {
    return `${baseUrl.replace('https://', 'wss://')}/socket.io/?EIO=4&transport=websocket`;
  }
  if (baseUrl.startsWith('http://')) {
    return `${baseUrl.replace('http://', 'ws://')}/socket.io/?EIO=4&transport=websocket`;
  }
  if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
    return `${baseUrl}/socket.io/?EIO=4&transport=websocket`;
  }

  return `ws://${baseUrl}/socket.io/?EIO=4&transport=websocket`;
}

const SOCKET_ENDPOINT = toWebSocketEndpoint(SOCKET_BASE);

export const options = {
  tags: {
    service: 'fixo-socket',
    test_type: 'socket-soak',
  },
  scenarios: {
    socket_soak: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.96'],
    socket_connect_success: ['rate>0.95'],
  },
};

export default function () {
  const userId = `k6-worker-${__VU}-${__ITER}`;

  const response = ws.connect(SOCKET_ENDPOINT, null, (socket) => {
    let namespaceConnected = false;
    let eventTimer = null;

    socket.on('open', () => {
      // Socket.IO namespace connect packet.
      socket.send('40');
    });

    socket.on('message', (rawMessage) => {
      const message = String(rawMessage);

      // Engine.IO ping -> pong.
      if (message === '2') {
        socket.send('3');
        return;
      }

      // Namespace connected.
      if (message.startsWith('40')) {
        if (namespaceConnected) return;

        namespaceConnected = true;
        socketConnectSuccess.add(true);

        socket.send(`42["register",{"userId":"${userId}","role":"worker"}]`);

        eventTimer = socket.setInterval(() => {
          const lng = 77 + ((__VU % 50) / 1000);
          const lat = 28 + ((__VU % 50) / 1000);

          socket.send(`42["worker:location-update",{"bookingId":"k6-booking","coordinates":[${lng},${lat}]}]`);
        }, EVENT_INTERVAL_MS);

        return;
      }

      // Socket.IO error packet.
      if (message.startsWith('44')) {
        socketProtocolErrors.add(1);
      }
    });

    socket.on('error', () => {
      socketProtocolErrors.add(1);
      socketConnectSuccess.add(false);
    });

    socket.on('close', () => {
      if (eventTimer) {
        socket.clearInterval(eventTimer);
      }

      if (!namespaceConnected) {
        socketConnectSuccess.add(false);
      }
    });

    socket.setTimeout(() => {
      socket.close();
    }, SESSION_MS);
  });

  check(response, {
    'socket upgrade status is 101': (r) => r && r.status === 101,
  });

  sleep(1);
}
