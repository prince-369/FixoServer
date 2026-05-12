"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const ChatbotQA_1 = __importDefault(require("../models/ChatbotQA"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixo';
const WORKER_FAQS = [
    {
        category: 'Jobs',
        question: 'Online hone ke baad mujhe job requests kitni jaldi milti hain?',
        answer: 'Job requests aapke service categories, location, rating, aur current demand par depend karti hain. Online rehne aur fast response dene se chances improve hote hain.',
        keywords: ['online', 'jobs', 'requests', 'availability', 'worker'],
        order: 1,
    },
    {
        category: 'Jobs',
        question: 'Bid kaise kaam karta hai aur mujhe kya amount quote karna chahiye?',
        answer: 'Available request par aap apna quote submit kar sakte ho. Competitive aur realistic quote dena best hai. Customer compare karke accept karta hai, isliye clear pricing strategy rakhein.',
        keywords: ['bid', 'quote', 'pricing', 'job request'],
        order: 2,
    },
    {
        category: 'Wallet & Payments',
        question: 'Mera withdrawal locked kyu dikh raha hai?',
        answer: 'Aksar withdrawal pending dues ki wajah se lock hota hai. Wallet section me dues clear karne ke baad withdrawal dobara enable ho jata hai.',
        keywords: ['withdrawal', 'dues', 'wallet', 'locked'],
        order: 3,
    },
    {
        category: 'Wallet & Payments',
        question: 'Bank account details update kaise karun?',
        answer: 'Worker Wallet/Settings section me Add or Update Bank option se account holder name, bank name, account number aur IFSC update kar sakte ho.',
        keywords: ['bank', 'ifsc', 'account', 'update', 'withdrawal'],
        order: 4,
    },
    {
        category: 'Account & Profile',
        question: 'Bio, categories ya service location kaise update karun?',
        answer: 'Worker Settings me profile section se bio edit, service categories update aur location pin set kiya ja sakta hai. Changes save karte hi profile me reflect ho jate hain.',
        keywords: ['bio', 'categories', 'location', 'profile', 'settings'],
        order: 5,
    },
    {
        category: 'Ratings',
        question: 'Meri rating kaise calculate hoti hai?',
        answer: 'Rating completed bookings ke baad customer feedback par based hoti hai. Better service quality, punctual arrival, aur professional behavior se rating improve hoti hai.',
        keywords: ['rating', 'reviews', 'feedback', 'completed bookings'],
        order: 6,
    },
    {
        category: 'Support',
        question: 'Issue ho to support team se fastest help kaise milegi?',
        answer: 'Help & Support me relevant category ke saath ticket raise karein aur clear issue details dein. Agar urgent ho to ticket escalate karein, support team priority se respond karti hai.',
        keywords: ['support', 'ticket', 'escalate', 'help'],
        order: 7,
    },
];
const seedWorkerFaqs = async () => {
    let created = 0;
    let updated = 0;
    try {
        console.log('[INFO] Connecting to MongoDB...');
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('[OK] Connected!');
        for (const faq of WORKER_FAQS) {
            const existing = await ChatbotQA_1.default.findOne({
                targetAudience: 'worker',
                question: faq.question,
            });
            if (!existing) {
                await ChatbotQA_1.default.create({
                    ...faq,
                    targetAudience: 'worker',
                    isActive: true,
                });
                created += 1;
                console.log(`[CREATED] ${faq.question}`);
            }
            else {
                await ChatbotQA_1.default.updateOne({ _id: existing._id }, {
                    $set: {
                        category: faq.category,
                        answer: faq.answer,
                        keywords: faq.keywords,
                        order: faq.order,
                        isActive: true,
                    },
                });
                updated += 1;
                console.log(`[UPDATED] ${faq.question}`);
            }
        }
        console.log(`\n[DONE] Worker FAQ seed complete. ${created} created, ${updated} updated.`);
    }
    catch (error) {
        console.error('[ERROR] Worker FAQ seed failed:', error);
        process.exitCode = 1;
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('[INFO] Disconnected from MongoDB.');
    }
};
seedWorkerFaqs();
//# sourceMappingURL=worker-faq-seed.js.map