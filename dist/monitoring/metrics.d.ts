import type { NextFunction, Request, Response } from 'express';
import { Registry } from 'prom-client';
declare const metricsRegistry: Registry<"text/plain; version=0.0.4; charset=utf-8">;
export declare const metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const serveMetrics: (req: Request, res: Response) => Promise<void>;
export declare const recordSocketConnected: (transport?: string) => void;
export declare const recordSocketDisconnected: (reason?: string) => void;
export declare const recordSocketEvent: (eventName: string) => void;
export declare const setActiveEkycRooms: (count: number) => void;
export { metricsRegistry };
//# sourceMappingURL=metrics.d.ts.map