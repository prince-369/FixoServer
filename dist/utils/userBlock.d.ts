import type { IBlockInfo } from '../models/User';
export interface BlockStatusPayload {
    isBlocked: boolean;
    reason: string;
    blockedAt: string | null;
    blockedUntil: string | null;
    remainingMs: number;
}
export declare const isActivelyBlocked: (block?: IBlockInfo | null) => boolean;
export declare const blockPayload: (block?: IBlockInfo | null) => BlockStatusPayload;
interface BlockableDoc {
    block?: IBlockInfo;
    save: () => Promise<unknown>;
}
export declare const clearExpiredBlock: (doc: BlockableDoc | null | undefined) => Promise<boolean>;
export {};
//# sourceMappingURL=userBlock.d.ts.map