"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTicketNumber = void 0;
const Counter_1 = __importDefault(require("../models/Counter"));
const getDateCode = (date) => {
    const yy = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
};
const generateTicketNumber = async () => {
    const now = new Date();
    const dateCode = getDateCode(now);
    const counterKey = `help-ticket:${dateCode}`;
    const counter = await Counter_1.default.findOneAndUpdate({ key: counterKey }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const sequence = String(counter.seq).padStart(5, '0');
    return `SUP-${dateCode}-${sequence}`;
};
exports.generateTicketNumber = generateTicketNumber;
//# sourceMappingURL=ticketNumber.service.js.map