"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const razorpay_1 = __importDefault(require("razorpay"));
const env_1 = __importDefault(require("./env"));
const razorpay = new razorpay_1.default({
    key_id: env_1.default.RAZORPAY_KEY_ID,
    key_secret: env_1.default.RAZORPAY_KEY_SECRET,
});
exports.default = razorpay;
//# sourceMappingURL=razorpay.js.map