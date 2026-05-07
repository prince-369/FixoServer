"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = __importDefault(require("../config/db"));
const Category_1 = __importDefault(require("../models/Category"));
const adminBootstrap_service_1 = require("../services/adminBootstrap.service");
const categories = [
    { name: 'Electricity', slug: 'electricity', description: 'Electrical repairs, wiring, fan installation, switchboard fixes', order: 1 },
    { name: 'Plumbing', slug: 'plumbing', description: 'Pipe fitting, leakage repair, tap installation, drainage', order: 2 },
    { name: 'Electronic Installation', slug: 'electronic-installation', description: 'TV mounting, AC installation, appliance setup', order: 3 },
    { name: 'Food Making', slug: 'food-making', description: 'Home cooking, party catering, tiffin service', order: 4 },
    { name: 'Cleaning', slug: 'cleaning', description: 'Home deep cleaning, bathroom cleaning, kitchen cleaning', order: 5 },
    { name: 'House Repairing', slug: 'house-repairing', description: 'Wall repair, painting, door/window fixes, carpentry', order: 6 },
    { name: 'Bike Repairing', slug: 'bike-repairing', description: 'Bike servicing, puncture repair, engine work', order: 7 },
    { name: 'Car & 4-Wheeler Repairing', slug: 'car-repairing', description: 'Car service, denting, painting, engine repair', order: 8 },
    { name: '3-Wheeler Repairing', slug: '3-wheeler-repairing', description: 'Auto rickshaw repair and servicing', order: 9 },
    { name: 'Washing Service', slug: 'washing-service', description: 'Laundry, dry cleaning, ironing service', order: 10 },
    { name: 'Planting', slug: 'planting', description: 'Garden setup, plant care, landscaping', order: 11 },
];
const seed = async () => {
    await (0, db_1.default)();
    console.log('Seeding database...');
    // Seed Admin
    await (0, adminBootstrap_service_1.syncSeedAdminCredentials)();
    // Seed Categories
    for (const cat of categories) {
        const exists = await Category_1.default.findOne({ slug: cat.slug });
        if (!exists) {
            await Category_1.default.create(cat);
            console.log(`[OK] Category created: ${cat.name}`);
        }
        else {
            console.log(`[INFO] Category exists: ${cat.name}`);
        }
    }
    console.log('\n[DONE] Seeding complete!');
    await mongoose_1.default.disconnect();
    process.exit(0);
};
seed().catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map