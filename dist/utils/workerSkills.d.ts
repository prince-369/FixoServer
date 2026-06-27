/**
 * Helpers for the worker skill lifecycle. `categories` is always the derived
 * list of APPROVED skill categories (used for job matching); `skills` holds the
 * full records (experience, confirmation, status, review state).
 */
interface SkillLike {
    category: unknown;
    status: string;
}
export declare const syncCategoriesFromSkills: (worker: {
    skills?: SkillLike[];
    categories?: unknown;
}) => void;
export declare const accountAgeMonths: (createdAt?: Date | string | null) => number;
export declare const maxExperienceBumps: (createdAt?: Date | string | null) => number;
export interface SkillInput {
    categoryId: string;
    experienceYears: number;
    confirmed: boolean;
}
export declare const parseSkillsInput: (raw: unknown) => SkillInput[];
export {};
//# sourceMappingURL=workerSkills.d.ts.map