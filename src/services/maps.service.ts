import axios from 'axios';
import env from '../config/env';

interface NominatimSearchItem {
  lat: string;
  lon: string;
}

interface OsrmRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
  }>;
}

const REQUEST_HEADERS = {
  'User-Agent': 'Fixo/1.0 (+https://fixo.app)',
  Accept: 'application/json',
};

const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '1 min';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr`;

  return `${hours} hr ${remainingMinutes} min`;
};

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const response = await axios.get<NominatimSearchItem[]>(env.MAPCN_GEOCODE_URL, {
      params: {
        q: address,
        format: 'jsonv2',
        limit: 1,
        countrycodes: 'in',
      },
      headers: REQUEST_HEADERS,
    });

    const first = response.data?.[0];
    if (first) {
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

export const getDistanceMatrix = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distance: string; duration: string } | null> => {
  try {
    const response = await axios.get<OsrmRouteResponse>(
      `${env.MAPCN_ROUTING_URL}/${originLng},${originLat};${destLng},${destLat}`,
      {
        params: {
          overview: 'false',
        },
        headers: REQUEST_HEADERS,
      }
    );

    const route = response.data.routes?.[0];
    if (route) {
      return {
        distance: formatDistance(route.distance),
        duration: formatDuration(route.duration),
      };
    }

    return null;
  } catch (error) {
    console.error('Distance matrix error:', error);
    return null;
  }
};
