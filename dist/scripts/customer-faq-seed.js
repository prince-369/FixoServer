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
const CUSTOMER_FAQS = [
    {
        category: 'Bookings',
        question: 'Booking create karne ke baad next kya hota hai?',
        answer: 'Aapki request nearby eligible workers ko bheji jati hai. Worker accept hone ke baad booking status update hota hai aur aap booking details page par sab progress dekh sakte ho.',
        keywords: ['booking', 'request', 'worker accepted', 'status'],
        order: 1,
    },
    {
        category: 'Bookings',
        question: 'Kya main specific worker choose kar sakta/sakti hoon?',
        answer: 'Platform matching, bids aur availability ke basis par worker selection flow chalata hai. Aap booking details aur worker profile info dekhkar informed decision le sakte ho.',
        keywords: ['worker selection', 'choose worker', 'bid'],
        order: 2,
    },
    {
        category: 'Payments & Refunds',
        question: 'Payment ke kaunse options available hain?',
        answer: 'Booking ke according online payment aur cash payment options available ho sakte hain. Transaction history aapko Payments/Transactions page me mil jayegi.',
        keywords: ['payment', 'online', 'cash', 'transactions'],
        order: 3,
    },
    {
        category: 'Payments & Refunds',
        question: 'Cancellation ke baad refund kab milta hai?',
        answer: 'Refund timeline cancellation stage aur review par depend karti hai. Approved refund process hone par aapko notification milti hai, aur status booking/refund flow me track hota hai.',
        keywords: ['refund', 'cancel', 'timeline', 'approval'],
        order: 4,
    },
    {
        category: 'Tracking',
        question: 'Assigned worker ki live progress kaise dekhein?',
        answer: 'Bookings section me active booking open karke current status, assigned worker details aur important updates real time me dekh sakte ho.',
        keywords: ['tracking', 'assigned worker', 'active booking', 'status'],
        order: 5,
    },
    {
        category: 'Account',
        question: 'Profile details ya contact info update kaise karun?',
        answer: 'Settings aur Profile section se aap naam, bio, photo, aur relevant account details update kar sakte ho. Save karne ke turant baad updated info reflect ho jata hai.',
        keywords: ['profile', 'settings', 'update account', 'contact'],
        order: 6,
    },
    {
        category: 'Support',
        question: 'Issue resolve na ho to support ticket ka best tareeka kya hai?',
        answer: 'Help & Support me right category choose karke clear issue description ke saath ticket raise karein. Ticket thread me same issue continue karein aur urgent cases me escalation option use karein.',
        keywords: ['support', 'help ticket', 'escalation', 'faq'],
        order: 7,
    },
];
const seedCustomerFaqs = async () => {
    let created = 0;
    let updated = 0;
    try {
        console.log('[INFO] Connecting to MongoDB...');
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('[OK] Connected!');
        for (const faq of CUSTOMER_FAQS) {
            const existing = await ChatbotQA_1.default.findOne({
                targetAudience: 'customer',
                question: faq.question,
            });
            if (!existing) {
                await ChatbotQA_1.default.create({
                    ...faq,
                    targetAudience: 'customer',
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
        console.log(`\n[DONE] Customer FAQ seed complete. ${created} created, ${updated} updated.`);
    }
    catch (error) {
        console.error('[ERROR] Customer FAQ seed failed:', error);
        process.exitCode = 1;
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('[INFO] Disconnected from MongoDB.');
    }
};
seedCustomerFaqs();
//# sourceMappingURL=customer-faq-seed.js.map