"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'FIXO API',
        version: '1.0.0',
        description: 'Complete API reference for FIXO — home services platform. Three roles: Customer, Worker, Admin.',
        contact: { email: 'support@fixo.in' },
    },
    servers: [
        { url: '/api', description: 'Current server' },
    ],
    tags: [
        { name: 'Auth', description: 'Authentication — register, login, OTP, refresh' },
        { name: 'Customer', description: 'Customer profile, bookings, notifications, support' },
        { name: 'Booking', description: 'Create bookings, bids, payments (customer-facing)' },
        { name: 'Worker', description: 'Worker profile, work requests, earnings, dues, eKYC' },
        { name: 'Admin', description: 'Admin dashboard, eKYC review, payouts, categories, content' },
        { name: 'Rewards & Incentives', description: 'Customer rewards/coupons, worker promotions, and admin incentive management' },
        { name: 'Notifications', description: 'Web push & mobile push subscription management' },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Access token from login response. Prefix: Bearer <token>',
            },
        },
        schemas: {
            // ── Common ────────────────────────────────────────────────────────
            MessageResponse: {
                type: 'object',
                properties: { message: { type: 'string' } },
            },
            PaginatedMeta: {
                type: 'object',
                properties: {
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    totalPages: { type: 'integer' },
                },
            },
            // ── Auth ─────────────────────────────────────────────────────────
            AuthTokens: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    role: { type: 'string', enum: ['customer', 'worker', 'admin'] },
                },
            },
            CustomerRegisterBody: {
                type: 'object',
                required: ['name', 'email', 'phone', 'password'],
                properties: {
                    name: { type: 'string', example: 'Rahul Sharma' },
                    email: { type: 'string', format: 'email', example: 'rahul@example.com' },
                    phone: { type: 'string', example: '9876543210' },
                    password: { type: 'string', minLength: 6, example: 'Pass@123' },
                },
            },
            LoginBody: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                },
            },
            WorkerLoginBody: {
                type: 'object',
                required: ['phone', 'password'],
                properties: {
                    phone: { type: 'string', example: '9876543210' },
                    password: { type: 'string' },
                },
            },
            ForgotPasswordBody: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
            },
            VerifyOTPBody: {
                type: 'object',
                required: ['email', 'otp'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    otp: { type: 'string', example: '123456' },
                },
            },
            ResetPasswordBody: {
                type: 'object',
                required: ['email', 'otp', 'newPassword'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    otp: { type: 'string' },
                    newPassword: { type: 'string', minLength: 6 },
                },
            },
            GoogleAuthBody: {
                type: 'object',
                required: ['idToken'],
                properties: { idToken: { type: 'string', description: 'Firebase ID token from Google sign-in' } },
            },
            MeResponse: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    role: { type: 'string' },
                    profileImage: { type: 'string' },
                    status: { type: 'string', description: 'Worker: test | ekyc_pending | ekyc_done | approved | live' },
                },
            },
            // ── Customer ─────────────────────────────────────────────────────
            Category: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    icon: { type: 'string' },
                    description: { type: 'string' },
                    basePrice: { type: 'number' },
                    isActive: { type: 'boolean' },
                },
            },
            Banner: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    imageUrl: { type: 'string' },
                    link: { type: 'string' },
                    order: { type: 'integer' },
                },
            },
            CustomerProfile: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    profileImage: { type: 'string' },
                    addresses: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string' },
                                fullAddress: { type: 'string' },
                                lat: { type: 'number' },
                                lng: { type: 'number' },
                            },
                        },
                    },
                },
            },
            Booking: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    category: { $ref: '#/components/schemas/Category' },
                    customer: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' } } },
                    worker: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' } } },
                    status: {
                        type: 'string',
                        enum: ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done', 'in_progress', 'completed', 'cancelled'],
                    },
                    address: { type: 'string' },
                    scheduledAt: { type: 'string', format: 'date-time' },
                    totalAmount: { type: 'number' },
                    paymentMode: { type: 'string', enum: ['online', 'cash'] },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            NegotiationEntry: {
                type: 'object',
                properties: {
                    by: { type: 'string', enum: ['customer', 'worker'] },
                    amount: { type: 'number', example: 450 },
                    message: { type: 'string', example: 'Can you do it for ₹450?' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Bid: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    worker: {
                        type: 'object',
                        properties: {
                            _id: { type: 'string' },
                            name: { type: 'string' },
                            profileImage: { type: 'string' },
                            rating: { type: 'number' },
                            completedJobs: { type: 'integer' },
                        },
                    },
                    priceOffered: { type: 'number', example: 500 },
                    status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
                    negotiationStatus: {
                        type: 'string',
                        enum: ['none', 'customer_offered', 'worker_offered', 'agreed', 'declined'],
                        description: 'Current stage of price negotiation',
                    },
                    negotiations: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/NegotiationEntry' },
                        description: 'Full back-and-forth negotiation thread',
                    },
                    agreedAmount: { type: 'number', description: 'Final agreed price (set when negotiationStatus = agreed)' },
                    amount: { type: 'number' },
                    eta: { type: 'string' },
                    note: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Transaction: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    booking: { type: 'string' },
                    amount: { type: 'number' },
                    type: { type: 'string', enum: ['payment', 'refund'] },
                    status: { type: 'string', enum: ['pending', 'success', 'failed'] },
                    method: { type: 'string', enum: ['online', 'cash'] },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Notification: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                    type: { type: 'string' },
                    isRead: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            HelpTicket: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    subject: { type: 'string' },
                    status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'escalated'] },
                    messages: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                sender: { type: 'string', enum: ['user', 'admin'] },
                                text: { type: 'string' },
                                createdAt: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            ChatbotQA: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    question: { type: 'string' },
                    answer: { type: 'string' },
                    category: { type: 'string' },
                },
            },
            // ── Booking ───────────────────────────────────────────────────────
            CreateBookingBody: {
                type: 'object',
                description: 'multipart/form-data',
                required: ['categoryId', 'address', 'scheduledAt', 'paymentMode'],
                properties: {
                    categoryId: { type: 'string', description: 'Service category ID' },
                    address: { type: 'string', example: '42 MG Road, Bengaluru' },
                    lat: { type: 'number', example: 12.9716 },
                    lng: { type: 'number', example: 77.5946 },
                    scheduledAt: { type: 'string', format: 'date-time' },
                    paymentMode: { type: 'string', enum: ['online', 'cash'] },
                    description: { type: 'string' },
                    voiceNote: { type: 'string', format: 'binary', description: 'Audio file (optional)' },
                },
            },
            PaymentOrderResponse: {
                type: 'object',
                properties: {
                    orderId: { type: 'string', description: 'Razorpay order ID' },
                    amount: { type: 'number', description: 'Amount in paise' },
                    currency: { type: 'string', example: 'INR' },
                    key: { type: 'string', description: 'Razorpay key_id for checkout' },
                },
            },
            VerifyPaymentBody: {
                type: 'object',
                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
                properties: {
                    razorpay_order_id: { type: 'string' },
                    razorpay_payment_id: { type: 'string' },
                    razorpay_signature: { type: 'string' },
                },
            },
            // ── Worker ────────────────────────────────────────────────────────
            WorkerProfile: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    profileImage: { type: 'string' },
                    status: { type: 'string', enum: ['test', 'ekyc_pending', 'ekyc_done', 'approved', 'live'] },
                    isActive: { type: 'boolean' },
                    categories: { type: 'array', items: { type: 'string' } },
                    rating: { type: 'number' },
                    completedJobs: { type: 'integer' },
                    bankDetails: {
                        type: 'object',
                        properties: {
                            accountNumber: { type: 'string' },
                            ifsc: { type: 'string' },
                            accountHolderName: { type: 'string' },
                        },
                    },
                },
            },
            WorkerDashboard: {
                type: 'object',
                properties: {
                    totalEarnings: { type: 'number' },
                    pendingJobs: { type: 'integer' },
                    completedJobs: { type: 'integer' },
                    activeBooking: { $ref: '#/components/schemas/Booking' },
                    walletBalance: { type: 'number' },
                    pendingDues: { type: 'number' },
                },
            },
            BidBody: {
                type: 'object',
                required: ['amount'],
                properties: {
                    amount: { type: 'number', example: 500 },
                    eta: { type: 'string', example: '30 mins', description: 'Estimated time of arrival' },
                    note: { type: 'string', example: 'I have all required tools' },
                },
            },
            WorkerFunds: {
                type: 'object',
                properties: {
                    walletBalance: { type: 'number' },
                    totalEarned: { type: 'number' },
                    totalWithdrawn: { type: 'number' },
                    pendingDues: { type: 'number' },
                },
            },
            WithdrawalBody: {
                type: 'object',
                required: ['amount'],
                properties: {
                    amount: { type: 'number', minimum: 100, example: 500 },
                },
            },
            BankDetailsBody: {
                type: 'object',
                required: ['accountNumber', 'ifsc', 'accountHolderName'],
                properties: {
                    accountNumber: { type: 'string' },
                    ifsc: { type: 'string', example: 'SBIN0001234' },
                    accountHolderName: { type: 'string' },
                },
            },
            WorkerDue: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    worker: { type: 'string' },
                    amount: { type: 'number' },
                    reason: { type: 'string' },
                    dueDate: { type: 'string', format: 'date' },
                    status: { type: 'string', enum: ['pending', 'paid', 'overdue'] },
                },
            },
            // ── Admin ─────────────────────────────────────────────────────────
            AdminDashboard: {
                type: 'object',
                properties: {
                    totalCustomers: { type: 'integer' },
                    totalWorkers: { type: 'integer' },
                    totalBookings: { type: 'integer' },
                    totalRevenue: { type: 'number' },
                    pendingEKYC: { type: 'integer' },
                    pendingWithdrawals: { type: 'integer' },
                    pendingRefunds: { type: 'integer' },
                    recentBookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
                },
            },
            // ── Notifications ─────────────────────────────────────────────────
            WebPushSubscribeBody: {
                type: 'object',
                required: ['subscription'],
                properties: {
                    subscription: {
                        type: 'object',
                        description: 'PushSubscription object from browser Push API',
                        properties: {
                            endpoint: { type: 'string' },
                            keys: {
                                type: 'object',
                                properties: {
                                    p256dh: { type: 'string' },
                                    auth: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
            MobileTokenBody: {
                type: 'object',
                required: ['token', 'platform'],
                properties: {
                    token: { type: 'string', description: 'FCM device token' },
                    platform: { type: 'string', enum: ['android', 'ios'], example: 'android' },
                },
            },
            // ── Rewards & Incentives schemas ──
            RewardMilestone: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    key: { type: 'string', example: 'm10' },
                    bookingsRequired: { type: 'integer', example: 10 },
                    rewardAmount: { type: 'number', example: 150 },
                    label: { type: 'string', example: 'Bronze Reward' },
                    isActive: { type: 'boolean' },
                    order: { type: 'integer' },
                },
            },
            RewardMilestoneView: {
                type: 'object',
                properties: {
                    key: { type: 'string', example: 'm10' },
                    bookingsRequired: { type: 'integer' },
                    rewardAmount: { type: 'number' },
                    label: { type: 'string' },
                    achieved: { type: 'boolean' },
                    claimed: { type: 'boolean' },
                    claimable: { type: 'boolean' },
                    claimStatus: { type: 'string', enum: ['pending_approval', 'approved', 'paid', 'rejected'], nullable: true },
                    claimRejectionReason: { type: 'string', nullable: true },
                    progressPercent: { type: 'integer', example: 80 },
                },
            },
            RewardClaim: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    customer: { type: 'string' },
                    milestoneKey: { type: 'string' },
                    bookingsRequired: { type: 'integer' },
                    rewardAmount: { type: 'number' },
                    status: { type: 'string', enum: ['pending_approval', 'approved', 'paid', 'rejected'] },
                    payoutDetails: {
                        type: 'object',
                        properties: {
                            method: { type: 'string', enum: ['upi', 'bank'] },
                            upiId: { type: 'string' },
                            holderName: { type: 'string' },
                            bankName: { type: 'string' },
                            bankAccountNumber: { type: 'string' },
                            ifscCode: { type: 'string' },
                        },
                    },
                    eligibleCountAtClaim: { type: 'integer' },
                    rejectionReason: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Coupon: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    code: { type: 'string', example: 'FIXO20' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    discountType: { type: 'string', enum: ['percentage', 'flat'] },
                    discountValue: { type: 'number', example: 20 },
                    minOrderAmount: { type: 'number' },
                    maxDiscount: { type: 'number', nullable: true },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                    usageLimit: { type: 'integer', nullable: true },
                    perUserLimit: { type: 'integer' },
                    usedCount: { type: 'integer' },
                    budgetLimit: { type: 'number', nullable: true },
                    spentBudget: { type: 'number' },
                    isActive: { type: 'boolean' },
                    status: { type: 'string', enum: ['active', 'paused'] },
                },
            },
            CouponPublic: {
                type: 'object',
                description: 'Customer-facing coupon (internal budget fields hidden)',
                properties: {
                    _id: { type: 'string' },
                    code: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    discountType: { type: 'string', enum: ['percentage', 'flat'] },
                    discountValue: { type: 'number' },
                    minOrderAmount: { type: 'number' },
                    maxDiscount: { type: 'number', nullable: true },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            CouponCreateBody: {
                type: 'object',
                required: ['code', 'title', 'discountType', 'discountValue'],
                properties: {
                    code: { type: 'string', example: 'FIXO20' },
                    title: { type: 'string', example: '20% Off First Service' },
                    description: { type: 'string' },
                    discountType: { type: 'string', enum: ['percentage', 'flat'] },
                    discountValue: { type: 'number', example: 20 },
                    minOrderAmount: { type: 'number', example: 500 },
                    maxDiscount: { type: 'number', example: 200 },
                    expiresAt: { type: 'string', format: 'date', example: '2026-07-31' },
                    usageLimit: { type: 'integer', example: 1000 },
                    perUserLimit: { type: 'integer', example: 1 },
                    budgetLimit: { type: 'number', example: 50000 },
                },
            },
            WorkerPromotion: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    type: { type: 'string', enum: ['reduced_commission', 'zero_commission', 'bonus_earning'] },
                    commissionRate: { type: 'number', example: 0.1 },
                    zeroCommissionScope: { type: 'string', enum: ['first_orders', 'date_range'] },
                    firstOrdersCount: { type: 'integer' },
                    bonusTiers: {
                        type: 'array',
                        items: { type: 'object', properties: { jobsRequired: { type: 'integer' }, bonusAmount: { type: 'number' } } },
                    },
                    appliesToAllWorkers: { type: 'boolean' },
                    startsAt: { type: 'string', format: 'date-time' },
                    endsAt: { type: 'string', format: 'date-time', nullable: true },
                    budgetLimit: { type: 'number', nullable: true },
                    spentBudget: { type: 'number' },
                    isActive: { type: 'boolean' },
                    status: { type: 'string', enum: ['active', 'paused'] },
                },
            },
            WorkerPromotionView: {
                type: 'object',
                description: 'Worker-facing promotion with progress',
                properties: {
                    _id: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    type: { type: 'string', enum: ['reduced_commission', 'zero_commission', 'bonus_earning'] },
                    commissionRate: { type: 'number' },
                    defaultRate: { type: 'number' },
                    zeroCommissionScope: { type: 'string' },
                    firstOrdersCount: { type: 'integer' },
                    ordersUsed: { type: 'integer' },
                    bonusTiers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                jobsRequired: { type: 'integer' },
                                bonusAmount: { type: 'number' },
                                progress: { type: 'integer' },
                                progressPercent: { type: 'integer' },
                                claimed: { type: 'boolean' },
                                claimable: { type: 'boolean' },
                            },
                        },
                    },
                },
            },
            WorkerPromotionCreateBody: {
                type: 'object',
                required: ['title', 'type'],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    type: { type: 'string', enum: ['reduced_commission', 'zero_commission', 'bonus_earning'] },
                    commissionRate: { type: 'number', description: 'For reduced_commission (0–1, e.g. 0.10)', example: 0.1 },
                    zeroCommissionScope: { type: 'string', enum: ['first_orders', 'date_range'], description: 'For zero_commission' },
                    firstOrdersCount: { type: 'integer', description: 'For zero_commission first_orders scope', example: 5 },
                    bonusTiers: {
                        type: 'array',
                        description: 'For bonus_earning',
                        items: { type: 'object', properties: { jobsRequired: { type: 'integer', example: 20 }, bonusAmount: { type: 'number', example: 500 } } },
                    },
                    appliesToAllWorkers: { type: 'boolean', default: true },
                    targetWorkers: { type: 'array', items: { type: 'string' } },
                    startsAt: { type: 'string', format: 'date-time' },
                    endsAt: { type: 'string', format: 'date-time' },
                    durationDays: { type: 'integer', example: 7 },
                    budgetLimit: { type: 'number' },
                },
            },
            IncentiveAnalytics: {
                type: 'object',
                properties: {
                    totalIncentiveCost: { type: 'number' },
                    coupons: { type: 'object', properties: { used: { type: 'integer' }, discountTotal: { type: 'number' }, activeCount: { type: 'integer' } } },
                    rewards: { type: 'object', properties: { paidTotal: { type: 'number' }, byStatus: { type: 'object', additionalProperties: { type: 'object', properties: { count: { type: 'integer' }, total: { type: 'number' } } } } } },
                    workerPromotions: { type: 'object', properties: { bonusPaidTotal: { type: 'number' }, commissionSavingTotal: { type: 'number' }, participatingWorkers: { type: 'integer' }, activeCount: { type: 'integer' } } },
                },
            },
        },
    },
    security: [{ BearerAuth: [] }],
    paths: {
        // ════════════════════════════════════════════════════════════════
        // AUTH
        // ════════════════════════════════════════════════════════════════
        '/auth/customer/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new customer',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerRegisterBody' } } },
                },
                responses: {
                    201: { description: 'Customer registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                    400: { description: 'Validation error' },
                    409: { description: 'Email/phone already in use' },
                },
            },
        },
        '/auth/customer/login': {
            post: {
                tags: ['Auth'],
                summary: 'Customer login with email + password',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } },
                },
                responses: {
                    200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                    401: { description: 'Invalid credentials' },
                },
            },
        },
        '/auth/customer/google': {
            post: {
                tags: ['Auth'],
                summary: 'Customer Google sign-in (existing account)',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoogleAuthBody' } } } },
                responses: {
                    200: { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                    404: { description: 'Account not found — use /complete to register' },
                },
            },
        },
        '/auth/customer/google/complete': {
            post: {
                tags: ['Auth'],
                summary: 'Complete Google registration (new customer)',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['idToken', 'phone'],
                                properties: {
                                    idToken: { type: 'string' },
                                    phone: { type: 'string', example: '9876543210' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Customer created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                },
            },
        },
        '/auth/worker/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new worker (multipart — includes Aadhaar images)',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['name', 'phone', 'password', 'aadhaarFront', 'aadhaarBack'],
                                properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    password: { type: 'string' },
                                    aadhaarNumber: { type: 'string' },
                                    aadhaarFront: { type: 'string', format: 'binary' },
                                    aadhaarBack: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Worker registered, status=test (pending eKYC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                    409: { description: 'Phone already registered' },
                },
            },
        },
        '/auth/worker/login': {
            post: {
                tags: ['Auth'],
                summary: 'Worker login with phone + password',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerLoginBody' } } } },
                responses: {
                    200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                    401: { description: 'Invalid credentials' },
                },
            },
        },
        '/auth/worker/google': {
            post: {
                tags: ['Auth'],
                summary: 'Worker Google sign-in (existing account)',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoogleAuthBody' } } } },
                responses: {
                    200: { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                },
            },
        },
        '/auth/worker/google/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register worker via Google (multipart — includes Aadhaar)',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['idToken', 'phone', 'aadhaarFront', 'aadhaarBack'],
                                properties: {
                                    idToken: { type: 'string' },
                                    phone: { type: 'string' },
                                    aadhaarFront: { type: 'string', format: 'binary' },
                                    aadhaarBack: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Worker created via Google auth' },
                },
            },
        },
        '/auth/admin/login': {
            post: {
                tags: ['Auth'],
                summary: 'Admin login',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } } },
                responses: {
                    200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
                    403: { description: 'Not an admin account' },
                },
            },
        },
        '/auth/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Send OTP to email for password reset',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordBody' } } } },
                responses: {
                    200: { description: 'OTP sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    404: { description: 'Email not found' },
                },
            },
        },
        '/auth/verify-otp': {
            post: {
                tags: ['Auth'],
                summary: 'Verify OTP (for password reset flow)',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyOTPBody' } } } },
                responses: {
                    200: { description: 'OTP valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    400: { description: 'Invalid or expired OTP' },
                },
            },
        },
        '/auth/reset-password': {
            post: {
                tags: ['Auth'],
                summary: 'Reset password after OTP verification',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordBody' } } } },
                responses: {
                    200: { description: 'Password updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get current logged-in user profile',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Current user', content: { 'application/json': { schema: { $ref: '#/components/schemas/MeResponse' } } } },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token using refresh token cookie',
                security: [],
                responses: {
                    200: { description: 'New access token', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } } },
                    401: { description: 'Refresh token missing or expired' },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout — clears refresh token cookie',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Logged out', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // CUSTOMER
        // ════════════════════════════════════════════════════════════════
        '/customer/categories': {
            get: {
                tags: ['Customer'],
                summary: 'List all active service categories',
                security: [],
                responses: {
                    200: { description: 'Categories list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } },
                },
            },
        },
        '/customer/categories/{id}': {
            get: {
                tags: ['Customer'],
                summary: 'Get single category detail',
                security: [],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Category detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
                    404: { description: 'Not found' },
                },
            },
        },
        '/customer/banners': {
            get: {
                tags: ['Customer'],
                summary: 'Get promotional banners for home screen',
                security: [],
                responses: {
                    200: { description: 'Banners list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Banner' } } } } },
                },
            },
        },
        '/customer/profile': {
            get: {
                tags: ['Customer'],
                summary: 'Get customer profile',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerProfile' } } } },
                },
            },
            put: {
                tags: ['Customer'],
                summary: 'Update customer profile (multipart — profile image optional)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    profileImage: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerProfile' } } } },
                },
            },
        },
        '/customer/account/deactivation/send-otp': {
            post: {
                tags: ['Customer'],
                summary: 'Send OTP to verify before deactivating account',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'OTP sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/account/deactivation/confirm': {
            post: {
                tags: ['Customer'],
                summary: 'Confirm account deactivation with OTP',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['otp'], properties: { otp: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Account deactivated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/bookings': {
            get: {
                tags: ['Customer'],
                summary: 'Get customer\'s booking history',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done', 'in_progress', 'completed', 'cancelled'] } },
                ],
                responses: {
                    200: { description: 'Bookings list', content: { 'application/json': { schema: { type: 'object', properties: { bookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } }, meta: { $ref: '#/components/schemas/PaginatedMeta' } } } } } },
                },
            },
        },
        '/customer/bookings/{id}': {
            get: {
                tags: ['Customer'],
                summary: 'Get booking detail',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Booking detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
                    404: { description: 'Not found' },
                },
            },
        },
        '/customer/bookings/{id}/cancel': {
            post: {
                tags: ['Customer'],
                summary: 'Cancel a booking',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    400: { description: 'Cannot cancel at this status' },
                },
            },
        },
        '/customer/bookings/{id}/reveal-completion-code': {
            post: {
                tags: ['Customer'],
                summary: 'Reveal the 4-digit completion code to give the worker',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Completion code', content: { 'application/json': { schema: { type: 'object', properties: { completionCode: { type: 'string', example: '4821' } } } } } },
                },
            },
        },
        '/customer/bookings/{id}/refund-details': {
            post: {
                tags: ['Customer'],
                summary: 'Submit bank details for refund request',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['accountNumber', 'ifsc', 'accountHolderName'],
                                properties: {
                                    accountNumber: { type: 'string' },
                                    ifsc: { type: 'string' },
                                    accountHolderName: { type: 'string' },
                                    reason: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Refund request submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/bookings/{id}/review': {
            post: {
                tags: ['Customer'],
                summary: 'Submit rating & review for completed booking',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['rating'],
                                properties: {
                                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                                    comment: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Review submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/transactions': {
            get: {
                tags: ['Customer'],
                summary: 'Get customer transaction history',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: { description: 'Transactions list', content: { 'application/json': { schema: { type: 'object', properties: { transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } }, meta: { $ref: '#/components/schemas/PaginatedMeta' } } } } } },
                },
            },
        },
        '/customer/notifications': {
            get: {
                tags: ['Customer'],
                summary: 'Get customer in-app notifications',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Notifications list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } },
                },
            },
        },
        '/customer/notifications/{id}/read': {
            patch: {
                tags: ['Customer'],
                summary: 'Mark a single notification as read',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/notifications/read-all': {
            patch: {
                tags: ['Customer'],
                summary: 'Mark all notifications as read',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'All marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/notifications/{id}': {
            delete: {
                tags: ['Customer'],
                summary: 'Delete a notification',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/customer/chatbot-qa': {
            get: {
                tags: ['Customer'],
                summary: 'Get chatbot FAQ list for customer support bot',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'QA list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ChatbotQA' } } } } },
                },
            },
        },
        '/customer/help-tickets': {
            post: {
                tags: ['Customer'],
                summary: 'Create a new help/support ticket',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['subject', 'message'], properties: { subject: { type: 'string' }, message: { type: 'string' }, bookingId: { type: 'string', description: 'Optional booking reference' } } } } },
                },
                responses: {
                    201: { description: 'Ticket created', content: { 'application/json': { schema: { $ref: '#/components/schemas/HelpTicket' } } } },
                },
            },
            get: {
                tags: ['Customer'],
                summary: 'Get all support tickets for this customer',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Tickets list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/HelpTicket' } } } } },
                },
            },
        },
        '/customer/help-tickets/{id}': {
            get: {
                tags: ['Customer'],
                summary: 'Get support ticket detail with full message thread',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Ticket detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/HelpTicket' } } } },
                },
            },
        },
        '/customer/help-tickets/{id}/message': {
            post: {
                tags: ['Customer'],
                summary: 'Append a message to an existing ticket',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Message appended', content: { 'application/json': { schema: { $ref: '#/components/schemas/HelpTicket' } } } },
                },
            },
        },
        '/customer/help-tickets/{id}/escalate': {
            post: {
                tags: ['Customer'],
                summary: 'Escalate a ticket to higher priority',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Escalated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // BOOKING
        // ════════════════════════════════════════════════════════════════
        '/booking': {
            post: {
                tags: ['Booking'],
                summary: 'Create a new booking (multipart — voice note optional)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: { $ref: '#/components/schemas/CreateBookingBody' },
                        },
                    },
                },
                responses: {
                    201: { description: 'Booking created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
                    400: { description: 'Validation error' },
                },
            },
        },
        '/booking/workers/availability-summary': {
            get: {
                tags: ['Booking'],
                summary: 'Check worker availability before booking',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'categoryId', in: 'query', required: true, schema: { type: 'string' } },
                    { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
                    { name: 'lng', in: 'query', required: true, schema: { type: 'number' } },
                ],
                responses: {
                    200: { description: 'Availability summary', content: { 'application/json': { schema: { type: 'object', properties: { availableCount: { type: 'integer' }, nearestEta: { type: 'string' } } } } } },
                },
            },
        },
        '/booking/{id}/bids': {
            get: {
                tags: ['Booking'],
                summary: 'Get all bids on a booking',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Bids list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Bid' } } } } },
                },
            },
        },
        '/booking/{id}/bids/{bidId}/accept': {
            post: {
                tags: ['Booking'],
                summary: 'Accept a worker\'s bid',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'bidId', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Bid accepted, booking moves to worker_accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
                },
            },
        },
        '/booking/{id}/bids/{bidId}/counter': {
            post: {
                tags: ['Booking'],
                summary: 'Customer sends a counter offer on a bid (negotiation)',
                description: 'Allows the customer to negotiate price with a worker. Sets negotiationStatus to `customer_offered` and notifies the worker via socket + push notification. Max 10 negotiation rounds per bid.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, description: 'Booking ID', schema: { type: 'string' } },
                    { name: 'bidId', in: 'path', required: true, description: 'Bid ID to counter', schema: { type: 'string' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['amount'],
                                properties: {
                                    amount: { type: 'number', example: 450, description: 'Counter price offered by customer' },
                                    message: { type: 'string', example: 'Can you do it for ₹450?', description: 'Optional message to worker' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Counter offer sent to worker',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string', example: 'Counter offer sent' },
                                        bid: { $ref: '#/components/schemas/Bid' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid amount / cannot negotiate at this stage / max rounds reached' },
                    404: { description: 'Bid not found' },
                },
            },
        },
        '/booking/{id}/payment': {
            post: {
                tags: ['Booking'],
                summary: 'Initiate Razorpay payment — creates order',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Payment order created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentOrderResponse' } } } },
                },
            },
        },
        '/booking/{id}/payment/verify': {
            post: {
                tags: ['Booking'],
                summary: 'Verify Razorpay payment signature after checkout',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyPaymentBody' } } } },
                responses: {
                    200: { description: 'Payment verified, booking moves to payment_done', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    400: { description: 'Invalid signature' },
                },
            },
        },
        '/booking/{id}/payment/reconcile': {
            post: {
                tags: ['Booking'],
                summary: 'Reconcile payment status (poll Razorpay if verify missed)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Reconciled status', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/booking/webhook/razorpay': {
            post: {
                tags: ['Booking'],
                summary: 'Razorpay webhook (server-to-server — no auth)',
                security: [],
                description: 'Called by Razorpay to reconcile payment events. Uses X-Razorpay-Signature header for verification.',
                responses: {
                    200: { description: 'Webhook processed' },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // WORKER
        // ════════════════════════════════════════════════════════════════
        '/worker/profile': {
            get: {
                tags: ['Worker'],
                summary: 'Get worker profile',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Worker profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerProfile' } } } },
                },
            },
            put: {
                tags: ['Worker'],
                summary: 'Update worker profile (multipart — profile image optional)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    bio: { type: 'string' },
                                    profileImage: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerProfile' } } } },
                },
            },
        },
        '/worker/complete-profile': {
            post: {
                tags: ['Worker'],
                summary: 'Complete worker profile after registration (multipart)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['categories'],
                                properties: {
                                    categories: { type: 'string', description: 'JSON array of category IDs, e.g. ["id1","id2"]' },
                                    profileImage: { type: 'string', format: 'binary' },
                                    bio: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Profile completed', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerProfile' } } } },
                },
            },
        },
        '/worker/ekyc/re-request': {
            post: {
                tags: ['Worker'],
                summary: 'Re-submit Aadhaar documents after rejection (multipart)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['aadhaarFront', 'aadhaarBack'],
                                properties: {
                                    aadhaarFront: { type: 'string', format: 'binary' },
                                    aadhaarBack: { type: 'string', format: 'binary' },
                                    aadhaarNumber: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Documents re-submitted, status reset to ekyc_pending' },
                },
            },
        },
        '/worker/toggle-active': {
            put: {
                tags: ['Worker'],
                summary: 'Toggle worker online/offline availability',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Status toggled', content: { 'application/json': { schema: { type: 'object', properties: { isActive: { type: 'boolean' } } } } } },
                },
            },
        },
        '/worker/location': {
            put: {
                tags: ['Worker'],
                summary: 'Update worker GPS location (called periodically when online)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['lat', 'lng'], properties: { lat: { type: 'number', example: 12.9716 }, lng: { type: 'number', example: 77.5946 } } } } },
                },
                responses: {
                    200: { description: 'Location updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/dashboard': {
            get: {
                tags: ['Worker'],
                summary: 'Get worker dashboard summary',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Dashboard data', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerDashboard' } } } },
                },
            },
        },
        '/worker/work-requests': {
            get: {
                tags: ['Worker'],
                summary: 'Get available work requests near worker',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: { description: 'Work requests list', content: { 'application/json': { schema: { type: 'object', properties: { workRequests: { type: 'array', items: { $ref: '#/components/schemas/Booking' } }, meta: { $ref: '#/components/schemas/PaginatedMeta' } } } } } },
                },
            },
        },
        '/worker/work-requests/{id}': {
            get: {
                tags: ['Worker'],
                summary: 'Get work request detail',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Work request detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
                },
            },
        },
        '/worker/work-requests/{bookingId}/bid': {
            post: {
                tags: ['Worker'],
                summary: 'Submit a bid on a work request',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BidBody' } } } },
                responses: {
                    201: { description: 'Bid submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bid' } } } },
                    409: { description: 'Already bid on this booking' },
                },
            },
        },
        '/worker/booking/{id}/bids/{bidId}/negotiate-respond': {
            post: {
                tags: ['Worker'],
                summary: 'Worker responds to customer\'s counter offer (accept / counter / decline)',
                description: 'Worker can accept the customer\'s offered price, send their own counter amount, or decline. Only valid when negotiationStatus = `customer_offered`. Notifies customer via socket in real-time.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, description: 'Booking ID', schema: { type: 'string' } },
                    { name: 'bidId', in: 'path', required: true, description: 'Bid ID', schema: { type: 'string' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['action'],
                                properties: {
                                    action: { type: 'string', enum: ['accept', 'counter', 'decline'], description: 'accept — agrees to customer price; counter — sends new amount; decline — ends negotiation' },
                                    amount: { type: 'number', example: 480, description: 'Required only when action = counter' },
                                    message: { type: 'string', example: 'Best I can do is ₹480', description: 'Optional message (counter only)' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Response recorded and customer notified',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string', example: 'Response sent' },
                                        bid: { $ref: '#/components/schemas/Bid' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'No pending customer offer / invalid action / invalid amount / max rounds reached' },
                    404: { description: 'Bid not found or does not belong to this worker' },
                },
            },
        },
        '/worker/booking/{id}/approve': {
            post: {
                tags: ['Worker'],
                summary: 'Approve a booking (after customer selects worker)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Booking approved by worker', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/booking/{id}/reject': {
            post: {
                tags: ['Worker'],
                summary: 'Reject an assigned booking',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Booking rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/booking/{id}/cancel': {
            post: {
                tags: ['Worker'],
                summary: 'Cancel a booking (worker-initiated)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/booking/{id}/message': {
            post: {
                tags: ['Worker'],
                summary: 'Send a message to customer about the booking',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Message sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/booking/{id}/request-completion-code': {
            post: {
                tags: ['Worker'],
                summary: 'Request the customer\'s 4-digit completion code to finish job',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Request sent to customer', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/booking/{id}/complete': {
            post: {
                tags: ['Worker'],
                summary: 'Mark booking complete — enter code + upload proof images',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['completionCode'],
                                properties: {
                                    completionCode: { type: 'string', example: '4821' },
                                    proofImages: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Before/after photos' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Booking completed, earnings credited', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    400: { description: 'Wrong completion code' },
                },
            },
        },
        '/worker/funds': {
            get: {
                tags: ['Worker'],
                summary: 'Get wallet balance and earnings summary',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Funds overview', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerFunds' } } } },
                },
            },
        },
        '/worker/funds/history': {
            get: {
                tags: ['Worker'],
                summary: 'Get earnings history (per-booking breakdown)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: { description: 'Earnings history', content: { 'application/json': { schema: { type: 'object', properties: { earnings: { type: 'array', items: { type: 'object' } }, meta: { $ref: '#/components/schemas/PaginatedMeta' } } } } } },
                },
            },
        },
        '/worker/wallet/transactions': {
            get: {
                tags: ['Worker'],
                summary: 'Get wallet transaction log (credits, debits, dues, withdrawals)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: { description: 'Wallet transactions', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },
        '/worker/bank-details': {
            put: {
                tags: ['Worker'],
                summary: 'Save bank account details for withdrawals',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BankDetailsBody' } } } },
                responses: {
                    200: { description: 'Bank details saved', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/withdraw': {
            post: {
                tags: ['Worker'],
                summary: 'Request a withdrawal from wallet to bank',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WithdrawalBody' } } } },
                responses: {
                    201: { description: 'Withdrawal request created (status: pending)', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    400: { description: 'Insufficient balance or bank details missing' },
                },
            },
        },
        '/worker/withdrawals': {
            get: {
                tags: ['Worker'],
                summary: 'Get worker withdrawal history',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Withdrawals list', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
                },
            },
        },
        '/worker/dues/pay': {
            post: {
                tags: ['Worker'],
                summary: 'Pay dues via Razorpay (creates payment order)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Payment order for dues', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentOrderResponse' } } } },
                },
            },
        },
        '/worker/dues/pay-wallet': {
            post: {
                tags: ['Worker'],
                summary: 'Pay dues directly from wallet balance',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Dues paid from wallet', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                    400: { description: 'Insufficient wallet balance' },
                },
            },
        },
        '/worker/dues/verify': {
            post: {
                tags: ['Worker'],
                summary: 'Verify Razorpay dues payment after checkout',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyPaymentBody' } } } },
                responses: {
                    200: { description: 'Dues payment verified and cleared', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/notifications': {
            get: {
                tags: ['Worker'],
                summary: 'Get worker in-app notifications',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Notifications list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } },
                },
            },
        },
        '/worker/notifications/{id}/read': {
            patch: {
                tags: ['Worker'],
                summary: 'Mark notification as read',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/notifications/read-all': {
            patch: {
                tags: ['Worker'],
                summary: 'Mark all worker notifications as read',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'All marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/notifications/{id}': {
            delete: {
                tags: ['Worker'],
                summary: 'Delete a worker notification',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/worker/chatbot-qa': {
            get: {
                tags: ['Worker'],
                summary: 'Get chatbot FAQ list for worker support bot',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'QA list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ChatbotQA' } } } } },
                },
            },
        },
        '/worker/help-tickets': {
            post: {
                tags: ['Worker'],
                summary: 'Create a worker support ticket',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['subject', 'message'], properties: { subject: { type: 'string' }, message: { type: 'string' } } } } },
                },
                responses: {
                    201: { description: 'Ticket created', content: { 'application/json': { schema: { $ref: '#/components/schemas/HelpTicket' } } } },
                },
            },
            get: {
                tags: ['Worker'],
                summary: 'Get all support tickets for this worker',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Tickets list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/HelpTicket' } } } } },
                },
            },
        },
        '/worker/help-tickets/{id}': {
            get: {
                tags: ['Worker'],
                summary: 'Get worker support ticket detail',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Ticket detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/HelpTicket' } } } },
                },
            },
        },
        '/worker/help-tickets/{id}/message': {
            post: {
                tags: ['Worker'],
                summary: 'Append message to worker ticket',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Message appended', content: { 'application/json': { schema: { $ref: '#/components/schemas/HelpTicket' } } } },
                },
            },
        },
        '/worker/help-tickets/{id}/escalate': {
            post: {
                tags: ['Worker'],
                summary: 'Escalate worker support ticket',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Escalated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // ADMIN
        // ════════════════════════════════════════════════════════════════
        '/admin/dashboard': {
            get: {
                tags: ['Admin'],
                summary: 'Get admin dashboard metrics',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Dashboard data', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminDashboard' } } } },
                },
            },
        },
        '/admin/bootstrap-status': {
            get: {
                tags: ['Admin'],
                summary: 'Check if admin account has been bootstrapped',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Bootstrap status', content: { 'application/json': { schema: { type: 'object', properties: { isBootstrapped: { type: 'boolean' } } } } } },
                },
            },
        },
        '/admin/pending-badges': {
            get: {
                tags: ['Admin'],
                summary: 'Get pending badge counts (eKYC, withdrawals, refunds, tickets)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Badge counts',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        pendingEKYC: { type: 'integer' },
                                        pendingWithdrawals: { type: 'integer' },
                                        pendingRefunds: { type: 'integer' },
                                        openTickets: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/admin/ekyc/pending': {
            get: {
                tags: ['Admin'],
                summary: 'List workers pending eKYC review',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Pending eKYC list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/WorkerProfile' } } } } },
                },
            },
        },
        '/admin/ekyc/{workerId}': {
            get: {
                tags: ['Admin'],
                summary: 'Get full eKYC details for a worker',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'workerId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'eKYC details with Aadhaar images', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },
        '/admin/ekyc/{workerId}/video-result': {
            post: {
                tags: ['Admin'],
                summary: 'Save video KYC call result',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'workerId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['result'], properties: { result: { type: 'string', enum: ['pass', 'fail'] }, notes: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Video KYC result saved', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/ekyc/{workerId}/approve': {
            post: {
                tags: ['Admin'],
                summary: 'Approve worker eKYC — moves status to approved/live',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'workerId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Worker approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/ekyc/{workerId}/reject': {
            post: {
                tags: ['Admin'],
                summary: 'Reject worker eKYC with reason',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'workerId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Worker rejected, notified via push notification', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/ekyc/{workerId}/capture': {
            post: {
                tags: ['Admin'],
                summary: 'Save a video KYC frame capture',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'workerId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { imageData: { type: 'string', description: 'Base64 image' } } } } } },
                responses: {
                    200: { description: 'Capture saved', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/withdrawals': {
            get: {
                tags: ['Admin'],
                summary: 'List pending withdrawal requests',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'completed', 'declined'] } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                ],
                responses: {
                    200: { description: 'Withdrawals list', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },
        '/admin/withdrawals/{id}/complete': {
            post: {
                tags: ['Admin'],
                summary: 'Mark withdrawal as completed (payment transferred)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: { 'application/json': { schema: { type: 'object', properties: { transactionRef: { type: 'string', description: 'Bank UTR/reference number' } } } } },
                },
                responses: {
                    200: { description: 'Withdrawal completed, worker notified', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/withdrawals/{id}/decline': {
            post: {
                tags: ['Admin'],
                summary: 'Decline a withdrawal — credits amount back to worker wallet',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Declined, amount refunded to wallet', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/categories': {
            get: {
                tags: ['Admin'],
                summary: 'List all service categories (including inactive)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'All categories', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } },
                },
            },
            post: {
                tags: ['Admin'],
                summary: 'Create a new service category (multipart — icon image)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    basePrice: { type: 'number' },
                                    icon: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Category created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
                },
            },
        },
        '/admin/categories/{id}': {
            put: {
                tags: ['Admin'],
                summary: 'Update category (multipart — icon optional)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, basePrice: { type: 'number' }, isActive: { type: 'boolean' }, icon: { type: 'string', format: 'binary' } } },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
                },
            },
            delete: {
                tags: ['Admin'],
                summary: 'Delete a service category',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/categories/{id}/details': {
            put: {
                tags: ['Admin'],
                summary: 'Update category extra details (pricing tiers, inclusions, etc.)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Flexible category detail fields' } } } },
                responses: {
                    200: { description: 'Details updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
                },
            },
        },
        '/admin/banners': {
            get: {
                tags: ['Admin'],
                summary: 'List all promotional banners',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Banners', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Banner' } } } } },
                },
            },
            post: {
                tags: ['Admin'],
                summary: 'Create a banner (multipart — image required)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: { type: 'object', required: ['title', 'image'], properties: { title: { type: 'string' }, link: { type: 'string' }, image: { type: 'string', format: 'binary' } } },
                        },
                    },
                },
                responses: {
                    201: { description: 'Banner created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Banner' } } } },
                },
            },
        },
        '/admin/banners/reorder': {
            post: {
                tags: ['Admin'],
                summary: 'Reorder banners by changing display order',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['order'], properties: { order: { type: 'array', items: { type: 'string' }, description: 'Array of banner IDs in desired order' } } } } },
                },
                responses: {
                    200: { description: 'Reordered', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/banners/{id}': {
            put: {
                tags: ['Admin'],
                summary: 'Update banner (multipart — image optional)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { title: { type: 'string' }, link: { type: 'string' }, image: { type: 'string', format: 'binary' } } } } } },
                responses: {
                    200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Banner' } } } },
                },
            },
            delete: {
                tags: ['Admin'],
                summary: 'Delete a banner',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/customers': {
            get: {
                tags: ['Admin'],
                summary: 'List all customers',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Customers list', content: { 'application/json': { schema: { type: 'object', properties: { customers: { type: 'array', items: { $ref: '#/components/schemas/CustomerProfile' } }, meta: { $ref: '#/components/schemas/PaginatedMeta' } } } } } },
                },
            },
        },
        '/admin/commissions': {
            get: {
                tags: ['Admin'],
                summary: 'Get platform commission settings per category',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Commission settings', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { categoryId: { type: 'string' }, categoryName: { type: 'string' }, commissionPercent: { type: 'number' } } } } } } },
                },
            },
        },
        '/admin/worker-dues': {
            get: {
                tags: ['Admin'],
                summary: 'List all worker dues (overdue commissions)',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'overdue', 'paid'] } },
                ],
                responses: {
                    200: { description: 'Worker dues list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/WorkerDue' } } } } },
                },
            },
        },
        '/admin/worker-dues/{workerId}/notify': {
            post: {
                tags: ['Admin'],
                summary: 'Send push notification to worker about pending dues',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'workerId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Notification sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/help-tickets': {
            get: {
                tags: ['Admin'],
                summary: 'List all customer and worker support tickets',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'escalated'] } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                ],
                responses: {
                    200: { description: 'All tickets', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },
        '/admin/help-tickets/{id}/resolve': {
            post: {
                tags: ['Admin'],
                summary: 'Mark a support ticket as resolved',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Resolved', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/help-tickets/{id}/reply': {
            post: {
                tags: ['Admin'],
                summary: 'Send admin reply to a support ticket',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Reply sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/refunds': {
            get: {
                tags: ['Admin'],
                summary: 'List refund requests',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'processed', 'rejected'] } }],
                responses: {
                    200: { description: 'Refunds list', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },
        '/admin/refunds/{bookingId}/process': {
            post: {
                tags: ['Admin'],
                summary: 'Process (approve) a refund request',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: { 'application/json': { schema: { type: 'object', properties: { transactionRef: { type: 'string' }, notes: { type: 'string' } } } } },
                },
                responses: {
                    200: { description: 'Refund processed', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/refunds/{bookingId}/reject': {
            post: {
                tags: ['Admin'],
                summary: 'Reject a refund request',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'bookingId', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Refund rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/chatbot-qa': {
            get: {
                tags: ['Admin'],
                summary: 'List all chatbot QA entries',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'QA list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ChatbotQA' } } } } },
                },
            },
            post: {
                tags: ['Admin'],
                summary: 'Create a chatbot QA entry',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['question', 'answer'], properties: { question: { type: 'string' }, answer: { type: 'string' }, category: { type: 'string' } } } } },
                },
                responses: {
                    201: { description: 'QA created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatbotQA' } } } },
                },
            },
        },
        '/admin/chatbot-qa/{id}': {
            put: {
                tags: ['Admin'],
                summary: 'Update a chatbot QA entry',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' }, category: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatbotQA' } } } },
                },
            },
            delete: {
                tags: ['Admin'],
                summary: 'Delete a chatbot QA entry',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/cash-payments': {
            get: {
                tags: ['Admin'],
                summary: 'List completed cash payment bookings',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
                responses: {
                    200: { description: 'Cash payments list', content: { 'application/json': { schema: { type: 'object' } } } },
                },
            },
        },
        '/admin/workers': {
            get: {
                tags: ['Admin'],
                summary: 'List all workers',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['test', 'ekyc_pending', 'ekyc_done', 'approved', 'live'] } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Workers list', content: { 'application/json': { schema: { type: 'object', properties: { workers: { type: 'array', items: { $ref: '#/components/schemas/WorkerProfile' } }, meta: { $ref: '#/components/schemas/PaginatedMeta' } } } } } },
                },
            },
        },
        '/admin/workers/{id}': {
            get: {
                tags: ['Admin'],
                summary: 'Get worker detail (admin view — full info)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Worker detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerProfile' } } } },
                    404: { description: 'Not found' },
                },
            },
        },
        '/admin/notifications': {
            get: {
                tags: ['Admin'],
                summary: 'Get admin in-app notifications',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Notifications list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } },
                },
            },
        },
        '/admin/notifications/{id}/read': {
            patch: {
                tags: ['Admin'],
                summary: 'Mark admin notification as read',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/notifications/read-all': {
            patch: {
                tags: ['Admin'],
                summary: 'Mark all admin notifications as read',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'All marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/admin/notifications/{id}': {
            delete: {
                tags: ['Admin'],
                summary: 'Delete an admin notification',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // REWARDS & INCENTIVES — Customer
        // ════════════════════════════════════════════════════════════════
        '/customer/rewards': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'Get customer reward milestones + live progress',
                description: 'Returns all reward milestones with the customer\'s completed-booking count, which milestones are achieved/claimed/claimable, and total amount already paid out.',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Rewards progress',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        completedBookings: { type: 'integer', example: 12 },
                                        totalClaimedAmount: { type: 'number', example: 150 },
                                        nextMilestone: { $ref: '#/components/schemas/RewardMilestoneView' },
                                        milestones: { type: 'array', items: { $ref: '#/components/schemas/RewardMilestoneView' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/customer/rewards/{milestoneKey}/claim': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Claim a reward milestone (creates a payout request)',
                description: 'Customer submits bank details to claim an achieved milestone. Admin reviews and marks it paid. A previously rejected milestone can be claimed again. Eligibility (completed + paid bookings) is re-checked server-side.',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'milestoneKey', in: 'path', required: true, description: 'Milestone key e.g. m10', schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['method'],
                                properties: {
                                    method: { type: 'string', enum: ['upi', 'bank'], example: 'bank' },
                                    upiId: { type: 'string', description: 'Required if method = upi' },
                                    holderName: { type: 'string', description: 'Required if method = bank' },
                                    bankName: { type: 'string' },
                                    bankAccountNumber: { type: 'string' },
                                    ifscCode: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Claim submitted for review', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, claim: { $ref: '#/components/schemas/RewardClaim' } } } } } },
                    403: { description: 'Not enough completed bookings to claim' },
                    404: { description: 'Milestone not found' },
                    409: { description: 'Already claimed (active claim exists)' },
                },
            },
        },
        '/customer/rewards/claims': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'Get the customer\'s reward claim history',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Claims list', content: { 'application/json': { schema: { type: 'object', properties: { claims: { type: 'array', items: { $ref: '#/components/schemas/RewardClaim' } } } } } } },
                },
            },
        },
        '/customer/coupons': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'List coupons available to this customer',
                description: 'Active, non-expired coupons the customer has not yet exhausted (respects per-user limit).',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Available coupons', content: { 'application/json': { schema: { type: 'object', properties: { coupons: { type: 'array', items: { $ref: '#/components/schemas/CouponPublic' } } } } } } },
                },
            },
        },
        '/customer/coupons/validate': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Validate a coupon and preview the discount',
                description: 'Read-only check (no redemption). Pass a bookingId (uses its amount) or an explicit amount. Discounts apply to online payment only.',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code'],
                                properties: {
                                    code: { type: 'string', example: 'FIXO20' },
                                    bookingId: { type: 'string', description: 'Booking to price against (preferred)' },
                                    amount: { type: 'number', description: 'Order amount if no bookingId' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Coupon valid — discount preview', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, code: { type: 'string' }, discountAmount: { type: 'number' }, finalAmount: { type: 'number' }, orderAmount: { type: 'number' } } } } } },
                    400: { description: 'Invalid / expired / min-order not met / already used' },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // REWARDS & INCENTIVES — Worker
        // ════════════════════════════════════════════════════════════════
        '/worker/promotions': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'Get active worker promotions + progress summary',
                description: 'Returns reduced/zero-commission and bonus-earning promotions applicable to the worker, with bonus-tier progress (claimable flags), current effective commission rate, total commission saved and bonus earned.',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Promotions + summary',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        promotions: { type: 'array', items: { $ref: '#/components/schemas/WorkerPromotionView' } },
                                        summary: {
                                            type: 'object',
                                            properties: {
                                                totalWorkDone: { type: 'integer' },
                                                currentCommissionRate: { type: 'number', example: 0.1 },
                                                defaultCommissionRate: { type: 'number', example: 0.2 },
                                                commissionSavedTotal: { type: 'number' },
                                                bonusEarnedTotal: { type: 'number' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/worker/promotions/history': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'Worker promotion redemption history (bonuses + commission savings)',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'History list', content: { 'application/json': { schema: { type: 'object', properties: { history: { type: 'array', items: { type: 'object' } } } } } } },
                },
            },
        },
        '/worker/promotions/{id}/claim-bonus': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Claim an unlocked bonus tier → credit wallet',
                description: 'Worker claims a bonus milestone they have reached. The bonus is credited to their wallet balance (a worker_bonus transaction) and can then be withdrawn or used against dues. Idempotent — each tier can be claimed once.',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, description: 'Promotion ID', schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['jobsRequired'],
                                properties: { jobsRequired: { type: 'integer', example: 5, description: 'The tier (jobs threshold) being claimed' } },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Bonus credited', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, bonusAmount: { type: 'number' }, newBalance: { type: 'number' } } } } } },
                    400: { description: 'Not eligible / already claimed / budget exhausted' },
                    404: { description: 'Worker or promotion not found' },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // REWARDS & INCENTIVES — Admin: Coupons
        // ════════════════════════════════════════════════════════════════
        '/admin/coupons': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'List all coupon campaigns',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Coupons', content: { 'application/json': { schema: { type: 'object', properties: { coupons: { type: 'array', items: { $ref: '#/components/schemas/Coupon' } } } } } } } },
            },
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Create a coupon campaign',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CouponCreateBody' } } } },
                responses: { 201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { coupon: { $ref: '#/components/schemas/Coupon' } } } } } }, 409: { description: 'Code already exists' } },
            },
        },
        '/admin/coupons/{id}': {
            put: {
                tags: ['Rewards & Incentives'],
                summary: 'Update a coupon campaign',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CouponCreateBody' } } } },
                responses: { 200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { coupon: { $ref: '#/components/schemas/Coupon' } } } } } }, 404: { description: 'Not found' } },
            },
            delete: {
                tags: ['Rewards & Incentives'],
                summary: 'Delete a coupon campaign',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } } },
            },
        },
        '/admin/coupons/{id}/toggle': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Pause or resume a coupon',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['pause', 'resume'] } } } } } },
                responses: { 200: { description: 'Toggled', content: { 'application/json': { schema: { type: 'object', properties: { coupon: { $ref: '#/components/schemas/Coupon' } } } } } } },
            },
        },
        // ─── Admin: Worker Promotions ───
        '/admin/promotions': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'List all worker promotions',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Promotions', content: { 'application/json': { schema: { type: 'object', properties: { promotions: { type: 'array', items: { $ref: '#/components/schemas/WorkerPromotion' } } } } } } } },
            },
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Create a worker promotion',
                description: 'Type reduced_commission needs commissionRate; zero_commission needs zeroCommissionScope (+ firstOrdersCount); bonus_earning needs bonusTiers.',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerPromotionCreateBody' } } } },
                responses: { 201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { promotion: { $ref: '#/components/schemas/WorkerPromotion' } } } } } } },
            },
        },
        '/admin/promotions/{id}': {
            put: {
                tags: ['Rewards & Incentives'],
                summary: 'Update a worker promotion',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkerPromotionCreateBody' } } } },
                responses: { 200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { promotion: { $ref: '#/components/schemas/WorkerPromotion' } } } } } } },
            },
            delete: {
                tags: ['Rewards & Incentives'],
                summary: 'Delete a worker promotion',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } } },
            },
        },
        '/admin/promotions/{id}/toggle': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Pause or resume a worker promotion',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['pause', 'resume'] } } } } } },
                responses: { 200: { description: 'Toggled', content: { 'application/json': { schema: { type: 'object', properties: { promotion: { $ref: '#/components/schemas/WorkerPromotion' } } } } } } },
            },
        },
        // ─── Admin: Reward Milestones ───
        '/admin/reward-milestones': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'List reward milestones',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Milestones', content: { 'application/json': { schema: { type: 'object', properties: { milestones: { type: 'array', items: { $ref: '#/components/schemas/RewardMilestone' } } } } } } } },
            },
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Create or upsert a reward milestone (by key)',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['key', 'bookingsRequired', 'rewardAmount'], properties: { key: { type: 'string', example: 'm10' }, bookingsRequired: { type: 'integer', example: 10 }, rewardAmount: { type: 'number', example: 150 }, label: { type: 'string' }, order: { type: 'integer' }, isActive: { type: 'boolean' } } } } } },
                responses: { 200: { description: 'Upserted', content: { 'application/json': { schema: { type: 'object', properties: { milestone: { $ref: '#/components/schemas/RewardMilestone' } } } } } } },
            },
        },
        '/admin/reward-milestones/{id}': {
            put: {
                tags: ['Rewards & Incentives'],
                summary: 'Update a reward milestone',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { bookingsRequired: { type: 'integer' }, rewardAmount: { type: 'number' }, label: { type: 'string' }, order: { type: 'integer' }, isActive: { type: 'boolean' } } } } } },
                responses: { 200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { milestone: { $ref: '#/components/schemas/RewardMilestone' } } } } } } },
            },
        },
        // ─── Admin: Reward Claims review ───
        '/admin/reward-claims': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'List reward claims for review',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending_approval', 'paid', 'rejected', 'all'] } }],
                responses: { 200: { description: 'Claims', content: { 'application/json': { schema: { type: 'object', properties: { claims: { type: 'array', items: { $ref: '#/components/schemas/RewardClaim' } } } } } } } },
            },
        },
        '/admin/reward-claims/{id}/approve': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Approve a reward claim & mark it paid',
                description: 'Marks the claim paid (records a reward_payout transaction) after the admin has manually transferred the funds. Notifies the customer.',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Approved & paid', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, claim: { $ref: '#/components/schemas/RewardClaim' } } } } } }, 400: { description: 'Already paid' }, 404: { description: 'Not found' } },
            },
        },
        '/admin/reward-claims/{id}/reject': {
            post: {
                tags: ['Rewards & Incentives'],
                summary: 'Reject a reward claim (reason required)',
                description: 'Rejects with a reason the customer can see. A rejected milestone can be claimed again by the customer with corrected details.',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', example: 'Bank account details are incorrect' } } } } } },
                responses: { 200: { description: 'Rejected', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, claim: { $ref: '#/components/schemas/RewardClaim' } } } } } } },
            },
        },
        // ─── Admin: Incentive analytics ───
        '/admin/incentive-analytics': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'Aggregate incentive analytics (cost, ROI, participation)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Analytics', content: { 'application/json': { schema: { $ref: '#/components/schemas/IncentiveAnalytics' } } } } },
            },
        },
        '/admin/coupon-redemptions': {
            get: {
                tags: ['Rewards & Incentives'],
                summary: 'Coupon redemptions ledger (per-use financial impact)',
                description: 'Lists each coupon use with order value, customer-paid amount, and the discount the platform absorbed (worker earning is always the full order value).',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Redemptions ledger',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        totalPlatformCost: { type: 'number' },
                                        redemptions: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    couponCode: { type: 'string' },
                                                    orderAmount: { type: 'number' },
                                                    discountAmount: { type: 'number' },
                                                    customerPaid: { type: 'number' },
                                                    platformBorne: { type: 'number' },
                                                    createdAt: { type: 'string', format: 'date-time' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        // ════════════════════════════════════════════════════════════════
        // PUSH NOTIFICATIONS
        // ════════════════════════════════════════════════════════════════
        '/notifications/push/config': {
            get: {
                tags: ['Notifications'],
                summary: 'Get VAPID public key for web push subscription',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'VAPID config', content: { 'application/json': { schema: { type: 'object', properties: { publicKey: { type: 'string', description: 'VAPID public key' } } } } } },
                },
            },
        },
        '/notifications/push/subscribe': {
            post: {
                tags: ['Notifications'],
                summary: 'Subscribe to web push notifications',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WebPushSubscribeBody' } } } },
                responses: {
                    200: { description: 'Subscribed', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/notifications/push/unsubscribe': {
            post: {
                tags: ['Notifications'],
                summary: 'Unsubscribe a specific web push subscription',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WebPushSubscribeBody' } } } },
                responses: {
                    200: { description: 'Unsubscribed', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/notifications/push/unsubscribe-all': {
            post: {
                tags: ['Notifications'],
                summary: 'Unsubscribe all web push subscriptions for current user',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'All unsubscribed', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/notifications/mobile/register': {
            post: {
                tags: ['Notifications'],
                summary: 'Register FCM mobile push token',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileTokenBody' } } } },
                responses: {
                    200: { description: 'Token registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/notifications/mobile/unregister': {
            post: {
                tags: ['Notifications'],
                summary: 'Unregister a specific FCM token',
                security: [{ BearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } } },
                responses: {
                    200: { description: 'Token unregistered', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
        '/notifications/mobile/unregister-all': {
            post: {
                tags: ['Notifications'],
                summary: 'Unregister all FCM tokens for current user',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'All tokens cleared', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
                },
            },
        },
    },
};
exports.default = swaggerSpec;
//# sourceMappingURL=swagger.js.map