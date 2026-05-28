declare const swaggerSpec: {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
        contact: {
            email: string;
        };
    };
    servers: {
        url: string;
        description: string;
    }[];
    tags: {
        name: string;
        description: string;
    }[];
    components: {
        securitySchemes: {
            BearerAuth: {
                type: string;
                scheme: string;
                bearerFormat: string;
                description: string;
            };
        };
        schemas: {
            MessageResponse: {
                type: string;
                properties: {
                    message: {
                        type: string;
                    };
                };
            };
            PaginatedMeta: {
                type: string;
                properties: {
                    total: {
                        type: string;
                    };
                    page: {
                        type: string;
                    };
                    limit: {
                        type: string;
                    };
                    totalPages: {
                        type: string;
                    };
                };
            };
            AuthTokens: {
                type: string;
                properties: {
                    accessToken: {
                        type: string;
                    };
                    refreshToken: {
                        type: string;
                    };
                    role: {
                        type: string;
                        enum: string[];
                    };
                };
            };
            CustomerRegisterBody: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        example: string;
                    };
                    email: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    phone: {
                        type: string;
                        example: string;
                    };
                    password: {
                        type: string;
                        minLength: number;
                        example: string;
                    };
                };
            };
            LoginBody: {
                type: string;
                required: string[];
                properties: {
                    email: {
                        type: string;
                        format: string;
                    };
                    password: {
                        type: string;
                    };
                };
            };
            WorkerLoginBody: {
                type: string;
                required: string[];
                properties: {
                    phone: {
                        type: string;
                        example: string;
                    };
                    password: {
                        type: string;
                    };
                };
            };
            ForgotPasswordBody: {
                type: string;
                required: string[];
                properties: {
                    email: {
                        type: string;
                        format: string;
                    };
                };
            };
            VerifyOTPBody: {
                type: string;
                required: string[];
                properties: {
                    email: {
                        type: string;
                        format: string;
                    };
                    otp: {
                        type: string;
                        example: string;
                    };
                };
            };
            ResetPasswordBody: {
                type: string;
                required: string[];
                properties: {
                    email: {
                        type: string;
                        format: string;
                    };
                    otp: {
                        type: string;
                    };
                    newPassword: {
                        type: string;
                        minLength: number;
                    };
                };
            };
            GoogleAuthBody: {
                type: string;
                required: string[];
                properties: {
                    idToken: {
                        type: string;
                        description: string;
                    };
                };
            };
            MeResponse: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    email: {
                        type: string;
                    };
                    phone: {
                        type: string;
                    };
                    role: {
                        type: string;
                    };
                    profileImage: {
                        type: string;
                    };
                    status: {
                        type: string;
                        description: string;
                    };
                };
            };
            Category: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    icon: {
                        type: string;
                    };
                    description: {
                        type: string;
                    };
                    basePrice: {
                        type: string;
                    };
                    isActive: {
                        type: string;
                    };
                };
            };
            Banner: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    title: {
                        type: string;
                    };
                    imageUrl: {
                        type: string;
                    };
                    link: {
                        type: string;
                    };
                    order: {
                        type: string;
                    };
                };
            };
            CustomerProfile: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    email: {
                        type: string;
                    };
                    phone: {
                        type: string;
                    };
                    profileImage: {
                        type: string;
                    };
                    addresses: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                label: {
                                    type: string;
                                };
                                fullAddress: {
                                    type: string;
                                };
                                lat: {
                                    type: string;
                                };
                                lng: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
            Booking: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    category: {
                        $ref: string;
                    };
                    customer: {
                        type: string;
                        properties: {
                            _id: {
                                type: string;
                            };
                            name: {
                                type: string;
                            };
                        };
                    };
                    worker: {
                        type: string;
                        properties: {
                            _id: {
                                type: string;
                            };
                            name: {
                                type: string;
                            };
                        };
                    };
                    status: {
                        type: string;
                        enum: string[];
                    };
                    address: {
                        type: string;
                    };
                    scheduledAt: {
                        type: string;
                        format: string;
                    };
                    totalAmount: {
                        type: string;
                    };
                    paymentMode: {
                        type: string;
                        enum: string[];
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            Bid: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    worker: {
                        type: string;
                        properties: {
                            _id: {
                                type: string;
                            };
                            name: {
                                type: string;
                            };
                            profileImage: {
                                type: string;
                            };
                            rating: {
                                type: string;
                            };
                            completedJobs: {
                                type: string;
                            };
                        };
                    };
                    amount: {
                        type: string;
                    };
                    eta: {
                        type: string;
                    };
                    note: {
                        type: string;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            Transaction: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    booking: {
                        type: string;
                    };
                    amount: {
                        type: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    status: {
                        type: string;
                        enum: string[];
                    };
                    method: {
                        type: string;
                        enum: string[];
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            Notification: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    title: {
                        type: string;
                    };
                    body: {
                        type: string;
                    };
                    type: {
                        type: string;
                    };
                    isRead: {
                        type: string;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            HelpTicket: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    subject: {
                        type: string;
                    };
                    status: {
                        type: string;
                        enum: string[];
                    };
                    messages: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                sender: {
                                    type: string;
                                    enum: string[];
                                };
                                text: {
                                    type: string;
                                };
                                createdAt: {
                                    type: string;
                                    format: string;
                                };
                            };
                        };
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            ChatbotQA: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    question: {
                        type: string;
                    };
                    answer: {
                        type: string;
                    };
                    category: {
                        type: string;
                    };
                };
            };
            CreateBookingBody: {
                type: string;
                description: string;
                required: string[];
                properties: {
                    categoryId: {
                        type: string;
                        description: string;
                    };
                    address: {
                        type: string;
                        example: string;
                    };
                    lat: {
                        type: string;
                        example: number;
                    };
                    lng: {
                        type: string;
                        example: number;
                    };
                    scheduledAt: {
                        type: string;
                        format: string;
                    };
                    paymentMode: {
                        type: string;
                        enum: string[];
                    };
                    description: {
                        type: string;
                    };
                    voiceNote: {
                        type: string;
                        format: string;
                        description: string;
                    };
                };
            };
            PaymentOrderResponse: {
                type: string;
                properties: {
                    orderId: {
                        type: string;
                        description: string;
                    };
                    amount: {
                        type: string;
                        description: string;
                    };
                    currency: {
                        type: string;
                        example: string;
                    };
                    key: {
                        type: string;
                        description: string;
                    };
                };
            };
            VerifyPaymentBody: {
                type: string;
                required: string[];
                properties: {
                    razorpay_order_id: {
                        type: string;
                    };
                    razorpay_payment_id: {
                        type: string;
                    };
                    razorpay_signature: {
                        type: string;
                    };
                };
            };
            WorkerProfile: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    phone: {
                        type: string;
                    };
                    profileImage: {
                        type: string;
                    };
                    status: {
                        type: string;
                        enum: string[];
                    };
                    isActive: {
                        type: string;
                    };
                    categories: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                    rating: {
                        type: string;
                    };
                    completedJobs: {
                        type: string;
                    };
                    bankDetails: {
                        type: string;
                        properties: {
                            accountNumber: {
                                type: string;
                            };
                            ifsc: {
                                type: string;
                            };
                            accountHolderName: {
                                type: string;
                            };
                        };
                    };
                };
            };
            WorkerDashboard: {
                type: string;
                properties: {
                    totalEarnings: {
                        type: string;
                    };
                    pendingJobs: {
                        type: string;
                    };
                    completedJobs: {
                        type: string;
                    };
                    activeBooking: {
                        $ref: string;
                    };
                    walletBalance: {
                        type: string;
                    };
                    pendingDues: {
                        type: string;
                    };
                };
            };
            BidBody: {
                type: string;
                required: string[];
                properties: {
                    amount: {
                        type: string;
                        example: number;
                    };
                    eta: {
                        type: string;
                        example: string;
                        description: string;
                    };
                    note: {
                        type: string;
                        example: string;
                    };
                };
            };
            WorkerFunds: {
                type: string;
                properties: {
                    walletBalance: {
                        type: string;
                    };
                    totalEarned: {
                        type: string;
                    };
                    totalWithdrawn: {
                        type: string;
                    };
                    pendingDues: {
                        type: string;
                    };
                };
            };
            WithdrawalBody: {
                type: string;
                required: string[];
                properties: {
                    amount: {
                        type: string;
                        minimum: number;
                        example: number;
                    };
                };
            };
            BankDetailsBody: {
                type: string;
                required: string[];
                properties: {
                    accountNumber: {
                        type: string;
                    };
                    ifsc: {
                        type: string;
                        example: string;
                    };
                    accountHolderName: {
                        type: string;
                    };
                };
            };
            WorkerDue: {
                type: string;
                properties: {
                    _id: {
                        type: string;
                    };
                    worker: {
                        type: string;
                    };
                    amount: {
                        type: string;
                    };
                    reason: {
                        type: string;
                    };
                    dueDate: {
                        type: string;
                        format: string;
                    };
                    status: {
                        type: string;
                        enum: string[];
                    };
                };
            };
            AdminDashboard: {
                type: string;
                properties: {
                    totalCustomers: {
                        type: string;
                    };
                    totalWorkers: {
                        type: string;
                    };
                    totalBookings: {
                        type: string;
                    };
                    totalRevenue: {
                        type: string;
                    };
                    pendingEKYC: {
                        type: string;
                    };
                    pendingWithdrawals: {
                        type: string;
                    };
                    pendingRefunds: {
                        type: string;
                    };
                    recentBookings: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            WebPushSubscribeBody: {
                type: string;
                required: string[];
                properties: {
                    subscription: {
                        type: string;
                        description: string;
                        properties: {
                            endpoint: {
                                type: string;
                            };
                            keys: {
                                type: string;
                                properties: {
                                    p256dh: {
                                        type: string;
                                    };
                                    auth: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
            MobileTokenBody: {
                type: string;
                required: string[];
                properties: {
                    token: {
                        type: string;
                        description: string;
                    };
                    platform: {
                        type: string;
                        enum: string[];
                        example: string;
                    };
                };
            };
        };
    };
    security: {
        BearerAuth: never[];
    }[];
    paths: {
        '/auth/customer/register': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                    409: {
                        description: string;
                    };
                };
            };
        };
        '/auth/customer/login': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                    };
                };
            };
        };
        '/auth/customer/google': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/auth/customer/google/complete': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    idToken: {
                                        type: string;
                                    };
                                    phone: {
                                        type: string;
                                        example: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/worker/register': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    name: {
                                        type: string;
                                    };
                                    phone: {
                                        type: string;
                                    };
                                    password: {
                                        type: string;
                                    };
                                    aadhaarNumber: {
                                        type: string;
                                    };
                                    aadhaarFront: {
                                        type: string;
                                        format: string;
                                    };
                                    aadhaarBack: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    409: {
                        description: string;
                    };
                };
            };
        };
        '/auth/worker/login': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                    };
                };
            };
        };
        '/auth/worker/google': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/worker/google/register': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    idToken: {
                                        type: string;
                                    };
                                    phone: {
                                        type: string;
                                    };
                                    aadhaarFront: {
                                        type: string;
                                        format: string;
                                    };
                                    aadhaarBack: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                    };
                };
            };
        };
        '/auth/admin/login': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    403: {
                        description: string;
                    };
                };
            };
        };
        '/auth/forgot-password': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/auth/verify-otp': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/auth/reset-password': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/me': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                    };
                };
            };
        };
        '/auth/refresh': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        accessToken: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                    };
                };
            };
        };
        '/auth/logout': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/categories': {
            get: {
                tags: string[];
                summary: string;
                security: never[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/categories/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: never[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/customer/banners': {
            get: {
                tags: string[];
                summary: string;
                security: never[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/profile': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                properties: {
                                    name: {
                                        type: string;
                                    };
                                    phone: {
                                        type: string;
                                    };
                                    profileImage: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/account/deactivation/send-otp': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/account/deactivation/confirm': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    otp: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/bookings': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        enum?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        bookings: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        meta: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/bookings/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/customer/bookings/{id}/cancel': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    reason: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/customer/bookings/{id}/reveal-completion-code': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        completionCode: {
                                            type: string;
                                            example: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/bookings/{id}/refund-details': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    accountNumber: {
                                        type: string;
                                    };
                                    ifsc: {
                                        type: string;
                                    };
                                    accountHolderName: {
                                        type: string;
                                    };
                                    reason: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/bookings/{id}/review': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    rating: {
                                        type: string;
                                        minimum: number;
                                        maximum: number;
                                    };
                                    comment: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/transactions': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        transactions: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        meta: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/notifications': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/notifications/{id}/read': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/notifications/read-all': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/notifications/{id}': {
            delete: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/chatbot-qa': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/help-tickets': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    subject: {
                                        type: string;
                                    };
                                    message: {
                                        type: string;
                                    };
                                    bookingId: {
                                        type: string;
                                        description: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/help-tickets/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/help-tickets/{id}/message': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    message: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/customer/help-tickets/{id}/escalate': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/booking': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/booking/workers/availability-summary': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        availableCount: {
                                            type: string;
                                        };
                                        nearestEta: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/booking/{id}/bids': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/booking/{id}/bids/{bidId}/accept': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/booking/{id}/payment': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/booking/{id}/payment/verify': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/booking/{id}/payment/reconcile': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/booking/webhook/razorpay': {
            post: {
                tags: string[];
                summary: string;
                security: never[];
                description: string;
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/worker/profile': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                properties: {
                                    name: {
                                        type: string;
                                    };
                                    bio: {
                                        type: string;
                                    };
                                    profileImage: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/complete-profile': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    categories: {
                                        type: string;
                                        description: string;
                                    };
                                    profileImage: {
                                        type: string;
                                        format: string;
                                    };
                                    bio: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/ekyc/re-request': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    aadhaarFront: {
                                        type: string;
                                        format: string;
                                    };
                                    aadhaarBack: {
                                        type: string;
                                        format: string;
                                    };
                                    aadhaarNumber: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/worker/toggle-active': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        isActive: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/location': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    lat: {
                                        type: string;
                                        example: number;
                                    };
                                    lng: {
                                        type: string;
                                        example: number;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/dashboard': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/work-requests': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        workRequests: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        meta: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/work-requests/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/work-requests/{bookingId}/bid': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    409: {
                        description: string;
                    };
                };
            };
        };
        '/worker/booking/{id}/approve': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/booking/{id}/reject': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/booking/{id}/cancel': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    reason: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/booking/{id}/message': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    message: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/booking/{id}/request-completion-code': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/booking/{id}/complete': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    completionCode: {
                                        type: string;
                                        example: string;
                                    };
                                    proofImages: {
                                        type: string;
                                        items: {
                                            type: string;
                                            format: string;
                                        };
                                        description: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/worker/funds': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/funds/history': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        earnings: {
                                            type: string;
                                            items: {
                                                type: string;
                                            };
                                        };
                                        meta: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/wallet/transactions': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/bank-details': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/withdraw': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/worker/withdrawals': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/dues/pay': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/dues/pay-wallet': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/worker/dues/verify': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/notifications': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/notifications/{id}/read': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/notifications/read-all': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/notifications/{id}': {
            delete: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/chatbot-qa': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/help-tickets': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    subject: {
                                        type: string;
                                    };
                                    message: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/help-tickets/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/help-tickets/{id}/message': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    message: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/worker/help-tickets/{id}/escalate': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/dashboard': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/bootstrap-status': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        isBootstrapped: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/pending-badges': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        pendingEKYC: {
                                            type: string;
                                        };
                                        pendingWithdrawals: {
                                            type: string;
                                        };
                                        pendingRefunds: {
                                            type: string;
                                        };
                                        openTickets: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/ekyc/pending': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/ekyc/{workerId}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/ekyc/{workerId}/video-result': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    result: {
                                        type: string;
                                        enum: string[];
                                    };
                                    notes: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/ekyc/{workerId}/approve': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/ekyc/{workerId}/reject': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    reason: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/ekyc/{workerId}/capture': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    imageData: {
                                        type: string;
                                        description: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/withdrawals': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        enum?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/withdrawals/{id}/complete': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    transactionRef: {
                                        type: string;
                                        description: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/withdrawals/{id}/decline': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    reason: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/categories': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    name: {
                                        type: string;
                                    };
                                    description: {
                                        type: string;
                                    };
                                    basePrice: {
                                        type: string;
                                    };
                                    icon: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/categories/{id}': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                properties: {
                                    name: {
                                        type: string;
                                    };
                                    description: {
                                        type: string;
                                    };
                                    basePrice: {
                                        type: string;
                                    };
                                    isActive: {
                                        type: string;
                                    };
                                    icon: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/categories/{id}/details': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                description: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/banners': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    title: {
                                        type: string;
                                    };
                                    link: {
                                        type: string;
                                    };
                                    image: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/banners/reorder': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    order: {
                                        type: string;
                                        items: {
                                            type: string;
                                        };
                                        description: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/banners/{id}': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: string;
                                properties: {
                                    title: {
                                        type: string;
                                    };
                                    link: {
                                        type: string;
                                    };
                                    image: {
                                        type: string;
                                        format: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/customers': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        customers: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        meta: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/commissions': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        type: string;
                                        properties: {
                                            categoryId: {
                                                type: string;
                                            };
                                            categoryName: {
                                                type: string;
                                            };
                                            commissionPercent: {
                                                type: string;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/worker-dues': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/worker-dues/{workerId}/notify': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/help-tickets': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        enum?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/help-tickets/{id}/resolve': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/help-tickets/{id}/reply': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    message: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/refunds': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/refunds/{bookingId}/process': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    transactionRef: {
                                        type: string;
                                    };
                                    notes: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/refunds/{bookingId}/reject': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    reason: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/chatbot-qa': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    question: {
                                        type: string;
                                    };
                                    answer: {
                                        type: string;
                                    };
                                    category: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/chatbot-qa/{id}': {
            put: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    question: {
                                        type: string;
                                    };
                                    answer: {
                                        type: string;
                                    };
                                    category: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/cash-payments': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/workers': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        enum?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                        default?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default?: undefined;
                        enum?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        workers: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        meta: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/workers/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/admin/notifications': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    items: {
                                        $ref: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/notifications/{id}/read': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/notifications/read-all': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/admin/notifications/{id}': {
            delete: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/push/config': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        publicKey: {
                                            type: string;
                                            description: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/push/subscribe': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/push/unsubscribe': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/push/unsubscribe-all': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/mobile/register': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/mobile/unregister': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    token: {
                                        type: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/mobile/unregister-all': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    BearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
    };
};
export default swaggerSpec;
//# sourceMappingURL=swagger.d.ts.map