"use strict";
/**
 * Helpers for the worker skill lifecycle. `categories` is always the derived
 * list of APPROVED skill categories (used for job matching); `skills` holds the
 * full records (experience, confirmation, status, review state).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSkillsInput = exports.maxExperienceBumps = exports.accountAgeMonths = exports.syncCategoriesFromSkills = void 0;
// Keep worker.categories in sync with the approved skills.
const syncCategoriesFromSkills = (worker) => {
    const approved = (worker.skills || [])
        .filter((s) => s.status === 'approved')
        .map((s) => s.category);
    worker.categories = approved;
};
exports.syncCategoriesFromSkills = syncCategoriesFromSkills;
// Account age in whole months (~30 day months).
const accountAgeMonths = (createdAt) => {
    if (!createdAt)
        return 0;
    const ms = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 30)));
};
exports.accountAgeMonths = accountAgeMonths;
// A worker may add +6 months of experience for every completed 6 months of
// account age (one bump per period). Returns how many bumps are allowed total.
const maxExperienceBumps = (createdAt) => Math.floor((0, exports.accountAgeMonths)(createdAt) / 6);
exports.maxExperienceBumps = maxExperienceBumps;
const parseSkillsInput = (raw) => {
    let arr = raw;
    if (typeof raw === 'string') {
        try {
            arr = JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    if (!Array.isArray(arr))
        return [];
    return arr
        .map((s) => {
        const o = s;
        const categoryId = typeof o.categoryId === 'string' ? o.categoryId : (typeof o.category === 'string' ? o.category : '');
        const experienceYears = Math.max(0, Math.min(60, Number(o.experienceYears) || 0));
        const confirmed = o.confirmed === true || o.confirmed === 'true';
        return { categoryId, experienceYears, confirmed };
    })
        .filter((s) => !!s.categoryId);
};
exports.parseSkillsInput = parseSkillsInput;
//# sourceMappingURL=workerSkills.js.map