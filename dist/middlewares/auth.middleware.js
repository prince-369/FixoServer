"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUser = exports.authorize = exports.protect = void 0;
const generateToken_1 = require("../utils/generateToken");
const User_1 = __importDefault(require("../models/User"));
const Worker_1 = __importDefault(require("../models/Worker"));
const Admin_1 = __importDefault(require("../models/Admin"));
const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            res.status(401).json({ message: 'Not authorized, no token' });
            return;
        }
        const decoded = (0, generateToken_1.verifyAccessToken)(token);
        req.user = { id: decoded.id, role: decoded.role };
        next();
    }
    catch (error) {
        res.status(401).json({ message: 'Not authorized, token invalid' });
    }
};
exports.protect = protect;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Not authorized for this action' });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
const verifyUser = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        let userExists = false;
        switch (req.user.role) {
            case 'customer': {
                const customer = await User_1.default.findById(req.user.id).select('isActive');
                userExists = !!customer && customer.isActive !== false;
                break;
            }
            case 'worker':
                userExists = !!(await Worker_1.default.findById(req.user.id));
                break;
            case 'admin':
                userExists = !!(await Admin_1.default.findById(req.user.id));
                break;
        }
        if (!userExists) {
            res.status(401).json({ message: 'User no longer exists' });
            return;
        }
        next();
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.verifyUser = verifyUser;
//# sourceMappingURL=auth.middleware.js.map