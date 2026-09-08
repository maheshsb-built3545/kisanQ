const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Farmer, StaffUser } = require('../models');
const logger = require('../utils/logger');

// In-memory OTP & Staff storage with TTL for development/testing fallback
const otpStore = new Map();
const inMemoryStaff = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const authService = {
  /**
   * Helper to sign JWT tokens
   */
  generateToken: (payload) => {
    const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
    return jwt.sign(payload, secret, { expiresIn: '7d' });
  },

  /**
   * Request OTP for Farmer
   */
  requestFarmerOtp: async ({ phone, name, preferredLanguage, registeredVia }) => {
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      throw new Error('Valid 10-digit mobile number required');
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP in cache
    otpStore.set(phone, {
      otp,
      expiresAt,
      metadata: { name, preferredLanguage, registeredVia }
    });

    // Mock SMS Delivery log
    logger.info(`[SMS Dispatch] OTP for +91${phone}: ${otp} (Valid for 5 minutes)`);

    return {
      phone,
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
      // Dev helper: return devOtp in non-production for automated testing
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    };
  },

  /**
   * Verify Farmer OTP and issue session JWT
   */
  verifyFarmerOtp: async ({ phone, otp, name, preferredLanguage, registeredVia }) => {
    if (!phone || !otp) {
      throw new Error('Phone and OTP are required');
    }

    const storedData = otpStore.get(phone);

    if (!storedData) {
      throw new Error('No OTP requested for this phone number or OTP expired');
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(phone);
      throw new Error('OTP has expired. Please request a new one.');
    }

    if (storedData.otp !== otp.toString()) {
      throw new Error('Invalid OTP');
    }

    // Clear used OTP
    otpStore.delete(phone);

    // Upsert farmer record in DB
    const updateData = {};
    if (name || storedData.metadata.name) {
      updateData.name = name || storedData.metadata.name;
    }
    if (preferredLanguage || storedData.metadata.preferredLanguage) {
      updateData.preferredLanguage = preferredLanguage || storedData.metadata.preferredLanguage;
    }
    if (registeredVia || storedData.metadata.registeredVia) {
      updateData.registeredVia = registeredVia || storedData.metadata.registeredVia;
    }

    let farmer = null;
    try {
      if (mongoose.connection.readyState === 1) {
        farmer = await Farmer.findOne({ phone });
        if (!farmer) {
          farmer = await Farmer.create({
            phone,
            name: updateData.name || `Farmer ${phone.slice(-4)}`,
            preferredLanguage: updateData.preferredLanguage || 'mr',
            registeredVia: updateData.registeredVia || 'app'
          });
        } else if (Object.keys(updateData).length > 0) {
          Object.assign(farmer, updateData);
          await farmer.save();
        }
      }
    } catch (err) {
      logger.warn(`Database write bypassed in auth: ${err.message}`);
    }

    if (!farmer) {
      farmer = {
        _id: new mongoose.Types.ObjectId(),
        phone,
        name: updateData.name || `Farmer ${phone.slice(-4)}`,
        preferredLanguage: updateData.preferredLanguage || 'mr',
        registeredVia: updateData.registeredVia || 'app'
      };
    }

    const token = authService.generateToken({
      id: farmer._id,
      role: 'farmer',
      phone: farmer.phone,
      name: farmer.name,
      preferredLanguage: farmer.preferredLanguage
    });

    return {
      token,
      user: {
        id: farmer._id,
        role: 'farmer',
        phone: farmer.phone,
        name: farmer.name,
        preferredLanguage: farmer.preferredLanguage,
        registeredVia: farmer.registeredVia
      }
    };
  },

  /**
   * Staff login with bcrypt password verification
   */
  staffLogin: async ({ name, password }) => {
    if (!name || !password) {
      throw new Error('Username/Name and password are required');
    }

    let staff = null;
    try {
      if (mongoose.connection.readyState === 1) {
        staff = await StaffUser.findOne({ name });
      } else if (inMemoryStaff.has(name)) {
        staff = inMemoryStaff.get(name);
      }
    } catch (err) {
      if (inMemoryStaff.has(name)) {
        staff = inMemoryStaff.get(name);
      }
    }

    if (!staff) {
      throw new Error('Invalid staff credentials');
    }

    if (!staff.isActive) {
      throw new Error('Staff account is inactive. Contact centre administrator.');
    }

    const isMatch = await bcrypt.compare(password, staff.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid staff credentials');
    }

    const token = authService.generateToken({
      id: staff._id,
      role: staff.role,
      name: staff.name,
      centreId: staff.centreId
    });

    return {
      token,
      user: {
        id: staff._id,
        role: staff.role,
        name: staff.name,
        centreId: staff.centreId
      }
    };
  },

  /**
   * Staff account creation (for testing/administrative onboarding)
   */
  staffRegister: async ({ name, role, centreId, password }) => {
    if (!name || !role || !password) {
      throw new Error('Name, role, and password are required');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let newStaff = null;
    try {
      if (mongoose.connection.readyState === 1) {
        const existing = await StaffUser.findOne({ name });
        if (existing) {
          throw new Error(`Staff user '${name}' already exists`);
        }
        newStaff = await StaffUser.create({
          name,
          role,
          centreId: centreId || null,
          passwordHash,
          isActive: true
        });
      }
    } catch (err) {
      logger.warn(`Database write bypassed in staff register: ${err.message}`);
    }

    if (!newStaff) {
      newStaff = {
        _id: new mongoose.Types.ObjectId(),
        name,
        role,
        centreId: centreId || null,
        passwordHash,
        isActive: true
      };
      inMemoryStaff.set(name, newStaff);
    }

    const token = authService.generateToken({
      id: newStaff._id,
      role: newStaff.role,
      name: newStaff.name,
      centreId: newStaff.centreId
    });

    return {
      token,
      user: {
        id: newStaff._id,
        role: newStaff.role,
        name: newStaff.name,
        centreId: newStaff.centreId
      }
    };
  }
};

module.exports = authService;
