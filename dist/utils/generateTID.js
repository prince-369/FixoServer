"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTID = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateTID = () => {
    const prefix = 'TXN';
    const random = crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
    return `${prefix}${random}`;
};
exports.generateTID = generateTID;
//# sourceMappingURL=generateTID.js.map