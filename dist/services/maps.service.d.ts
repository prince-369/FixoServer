export declare const geocodeAddress: (address: string) => Promise<{
    lat: number;
    lng: number;
} | null>;
export declare const getDistanceMatrix: (originLat: number, originLng: number, destLat: number, destLng: number) => Promise<{
    distance: string;
    duration: string;
} | null>;
//# sourceMappingURL=maps.service.d.ts.map