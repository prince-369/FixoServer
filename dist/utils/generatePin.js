"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePin = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generatePin = () => {
    return crypto_1.default.randomInt(100000, 999999).toString();
};
exports.generatePin = generatePin;
//# sourceMappingURL=generatePin.js.map