"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = __importDefault(require("./env"));
const connectDB = async () => {
    try {
        const conn = await mongoose_1.default.connect(env_1.default.MONGODB_URI, {
            maxPoolSize: env_1.default.MONGODB_MAX_POOL_SIZE,
            minPoolSize: env_1.default.MONGODB_MIN_POOL_SIZE,
            serverSelectionTimeoutMS: env_1.default.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
            socketTimeoutMS: env_1.default.MONGODB_SOCKET_TIMEOUT_MS,
            connectTimeoutMS: env_1.default.MONGODB_CONNECT_TIMEOUT_MS,
            maxIdleTimeMS: env_1.default.MONGODB_MAX_IDLE_TIME_MS,
            retryWrites: true,
            autoIndex: env_1.default.NODE_ENV !== 'production',
        });
        mongoose_1.default.connection.on('error', (error) => {
            console.error('MongoDB runtime error:', error);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
exports.default = connectDB;
//# sourceMappingURL=db.js.map