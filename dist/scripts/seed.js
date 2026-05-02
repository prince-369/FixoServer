"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
const Admin_1 = __importDefault(require("../models/Admin"));
const Category_1 = __importDefault(require("../models/Category"));
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
    const existingAdmin = await Admin_1.default.findOne({ email: 'fixo@princehub.in' });
    if (!existingAdmin) {
        const hashedPassword = await bcryptjs_1.default.hash('Admin123', 12);
        await Admin_1.default.create({
            email: 'fixo@princehub.in',
            password: hashedPassword,
            role: 'superadmin',
        });
        console.log('✅ Admin created (fixo@princehub.in / Admin123)');
    }
    else {
        console.log('ℹ️  Admin already exists');
    }
    // Seed Categories
    for (const cat of categories) {
        const exists = await Category_1.default.findOne({ slug: cat.slug });
        if (!exists) {
            await Category_1.default.create(cat);
            console.log(`✅ Category created: ${cat.name}`);
        }
        else {
            console.log(`ℹ️  Category exists: ${cat.name}`);
        }
    }
    console.log('\n🎉 Seeding complete!');
    await mongoose_1.default.disconnect();
    process.exit(0);
};
seed().catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map