import mongoose from 'mongoose';
import dotenv from 'dotenv';

import ChatbotQA from '../models/ChatbotQA';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixo';

type SeedFAQ = {
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  order: number;
};

const WORKER_FAQS: SeedFAQ[] = [
  {
    category: 'Jobs',
    question: 'How quickly will I start receiving job requests after going online?',
    answer:
      'Job requests depend on your service categories, location coverage, rating, and live demand in your area. Staying online consistently and responding quickly improves your chances.',
    keywords: ['online', 'jobs', 'requests', 'availability', 'worker'],
    order: 1,
  },
  {
    category: 'Jobs',
    question: 'How does bidding work and what amount should I quote?',
    answer:
      'You can submit your quote for available requests. A competitive and realistic quote works best. Customers compare offers before accepting, so keep your pricing transparent and practical.',
    keywords: ['bid', 'quote', 'pricing', 'job request'],
    order: 2,
  },
  {
    category: 'Wallet & Payments',
    question: 'How much commission does Fixo charge?',
    answer:
      'Fixo is completely free for workers. There is no commission and no platform charges — you keep 100% of every job amount.',
    keywords: ['commission', 'charges', 'free', 'fees'],
    order: 3,
  },
  {
    category: 'Wallet & Payments',
    question: 'How can I update my bank account details?',
    answer:
      'Go to Worker Wallet or Settings and use the Add or Update Bank option. You can update account holder name, bank name, account number, and IFSC there.',
    keywords: ['bank', 'ifsc', 'account', 'update', 'withdrawal'],
    order: 4,
  },
  {
    category: 'Account & Profile',
    question: 'How do I update my bio, service categories, or service location?',
    answer:
      'In Worker Settings under Profile, you can edit your bio, update service categories, and set your service location pin. Changes reflect immediately after saving.',
    keywords: ['bio', 'categories', 'location', 'profile', 'settings'],
    order: 5,
  },
  {
    category: 'Ratings',
    question: 'How is my rating calculated?',
    answer:
      'Your rating is based on customer feedback after completed bookings. Better service quality, punctual arrival, and professional behavior help improve your rating.',
    keywords: ['rating', 'reviews', 'feedback', 'completed bookings'],
    order: 6,
  },
  {
    category: 'Support',
    question: 'What is the fastest way to get help from support?',
    answer:
      'Raise a ticket in Help & Support with the correct category and clear issue details. For urgent cases, use escalation so the support team can prioritize your request.',
    keywords: ['support', 'ticket', 'escalate', 'help'],
    order: 7,
  },
];

const LEGACY_HINDI_WORKER_QUESTIONS = [
  'Online hone ke baad mujhe job requests kitni jaldi milti hain?',
  'Bid kaise kaam karta hai aur mujhe kya amount quote karna chahiye?',
  'Mera withdrawal locked kyu dikh raha hai?',
  'Bank account details update kaise karun?',
  'Bio, categories ya service location kaise update karun?',
  'Meri rating kaise calculate hoti hai?',
  'Issue ho to support team se fastest help kaise milegi?',
];

const seedWorkerFaqs = async () => {
  let created = 0;
  let updated = 0;

  try {
    console.log('[INFO] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[OK] Connected!');

    // Remove previously seeded Hindi versions so only English FAQs remain.
    const cleanup = await ChatbotQA.deleteMany({
      targetAudience: 'worker',
      question: { $in: LEGACY_HINDI_WORKER_QUESTIONS },
    });
    if (cleanup.deletedCount) {
      console.log(`[CLEANUP] Removed ${cleanup.deletedCount} legacy Hindi worker FAQs.`);
    }

    for (const faq of WORKER_FAQS) {
      const existing = await ChatbotQA.findOne({
        targetAudience: 'worker',
        question: faq.question,
      });

      if (!existing) {
        await ChatbotQA.create({
          ...faq,
          targetAudience: 'worker',
          isActive: true,
        });
        created += 1;
        console.log(`[CREATED] ${faq.question}`);
      } else {
        await ChatbotQA.updateOne(
          { _id: existing._id },
          {
            $set: {
              category: faq.category,
              answer: faq.answer,
              keywords: faq.keywords,
              order: faq.order,
              isActive: true,
            },
          }
        );
        updated += 1;
        console.log(`[UPDATED] ${faq.question}`);
      }
    }

    console.log(`\n[DONE] Worker FAQ seed complete. ${created} created, ${updated} updated.`);
  } catch (error) {
    console.error('[ERROR] Worker FAQ seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[INFO] Disconnected from MongoDB.');
  }
};

seedWorkerFaqs();
