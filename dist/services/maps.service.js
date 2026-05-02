"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDistanceMatrix = exports.geocodeAddress = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = __importDefault(require("../config/env"));
const REQUEST_HEADERS = {
    'User-Agent': 'Fixo/1.0 (+https://fixo.app)',
    Accept: 'application/json',
};
const formatDistance = (meters) => {
    if (!Number.isFinite(meters) || meters <= 0)
        return '0 m';
    if (meters < 1000)
        return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
};
const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0)
        return '1 min';
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60)
        return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0)
        return `${hours} hr`;
    return `${hours} hr ${remainingMinutes} min`;
};
const geocodeAddress = async (address) => {
    try {
        const response = await axios_1.default.get(env_1.default.MAPCN_GEOCODE_URL, {
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
    }
    catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
};
exports.geocodeAddress = geocodeAddress;
const getDistanceMatrix = async (originLat, originLng, destLat, destLng) => {
    try {
        const response = await axios_1.default.get(`${env_1.default.MAPCN_ROUTING_URL}/${originLng},${originLat};${destLng},${destLat}`, {
            params: {
                overview: 'false',
            },
            headers: REQUEST_HEADERS,
        });
        const route = response.data.routes?.[0];
        if (route) {
            return {
                distance: formatDistance(route.distance),
                duration: formatDuration(route.duration),
            };
        }
        return null;
    }
    catch (error) {
        console.error('Distance matrix error:', error);
        return null;
    }
};
exports.getDistanceMatrix = getDistanceMatrix;
//# sourceMappingURL=maps.service.js.map