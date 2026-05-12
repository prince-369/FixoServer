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

const CUSTOMER_FAQS: SeedFAQ[] = [
  {
    category: 'Bookings',
    question: 'What happens after I create a booking?',
    answer:
      'Your request is sent to nearby eligible workers. Once a worker accepts, the booking status updates and you can track progress from the booking details page.',
    keywords: ['booking', 'request', 'worker accepted', 'status'],
    order: 1,
  },
  {
    category: 'Bookings',
    question: 'Can I choose a specific worker?',
    answer:
      'The platform selects workers based on matching, bids, and availability. You can review booking details and worker profile information before making a decision.',
    keywords: ['worker selection', 'choose worker', 'bid'],
    order: 2,
  },
  {
    category: 'Payments & Refunds',
    question: 'What payment options are available?',
    answer:
      'Depending on the booking, online and cash payment options may be available. You can view complete payment history on the Payments or Transactions page.',
    keywords: ['payment', 'online', 'cash', 'transactions'],
    order: 3,
  },
  {
    category: 'Payments & Refunds',
    question: 'When will I receive a refund after cancellation?',
    answer:
      'Refund timelines depend on cancellation stage and review outcome. Once approved, you receive a notification and can track the refund status in your booking flow.',
    keywords: ['refund', 'cancel', 'timeline', 'approval'],
    order: 4,
  },
  {
    category: 'Tracking',
    question: 'How can I track the assigned worker live progress?',
    answer:
      'Open your active booking in the Bookings section to see current status, assigned worker details, and key updates in real time.',
    keywords: ['tracking', 'assigned worker', 'active booking', 'status'],
    order: 5,
  },
  {
    category: 'Account',
    question: 'How do I update my profile details or contact information?',
    answer:
      'You can update name, bio, photo, and related account details from the Profile and Settings sections. Changes are reflected immediately after saving.',
    keywords: ['profile', 'settings', 'update account', 'contact'],
    order: 6,
  },
  {
    category: 'Support',
    question: 'What is the best way to raise a support ticket for unresolved issues?',
    answer:
      'In Help & Support, choose the correct category and submit a clear issue description. Continue in the same ticket thread and use escalation for urgent cases.',
    keywords: ['support', 'help ticket', 'escalation', 'faq'],
    order: 7,
  },
];

const LEGACY_HINDI_CUSTOMER_QUESTIONS = [
  'Booking create karne ke baad next kya hota hai?',
  'Kya main specific worker choose kar sakta/sakti hoon?',
  'Payment ke kaunse options available hain?',
  'Cancellation ke baad refund kab milta hai?',
  'Assigned worker ki live progress kaise dekhein?',
  'Profile details ya contact info update kaise karun?',
  'Issue resolve na ho to support ticket ka best tareeka kya hai?',
];

const seedCustomerFaqs = async () => {
  let created = 0;
  let updated = 0;

  try {
    console.log('[INFO] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[OK] Connected!');

    // Remove previously seeded Hindi versions so only English FAQs remain.
    const cleanup = await ChatbotQA.deleteMany({
      targetAudience: 'customer',
      question: { $in: LEGACY_HINDI_CUSTOMER_QUESTIONS },
    });
    if (cleanup.deletedCount) {
      console.log(`[CLEANUP] Removed ${cleanup.deletedCount} legacy Hindi customer FAQs.`);
    }

    for (const faq of CUSTOMER_FAQS) {
      const existing = await ChatbotQA.findOne({
        targetAudience: 'customer',
        question: faq.question,
      });

      if (!existing) {
        await ChatbotQA.create({
          ...faq,
          targetAudience: 'customer',
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

    console.log(`\n[DONE] Customer FAQ seed complete. ${created} created, ${updated} updated.`);
  } catch (error) {
    console.error('[ERROR] Customer FAQ seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[INFO] Disconnected from MongoDB.');
  }
};

seedCustomerFaqs();
