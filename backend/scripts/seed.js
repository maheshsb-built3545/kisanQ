const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Centre = require('../src/models/Centre');
const StaffUser = require('../src/models/StaffUser');
const Farmer = require('../src/models/Farmer');

const SEED_CENTRES = [
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
    name: 'लासलगांव कृषि उपज मंडी (Lasalgaon APMC)',
    location: {
      type: 'Point',
      coordinates: [74.2294, 20.1478]
    },
    cropsHandled: ['Red Onion', 'Sharbati Wheat', 'Yellow Maize'],
    workingHours: {
      start: '08:00',
      end: '18:00'
    },
    currentStatus: 'Green',
    capacityConfig: [
      {
        crop: 'Red Onion',
        maxDailySlots: 60,
        quantityBands: ['0-5q', '5-15q', '15q+'],
        lanes: 4,
        durationMinutes: 20
      },
      {
        crop: 'Sharbati Wheat',
        maxDailySlots: 40,
        quantityBands: ['0-5q', '5-15q', '15q+'],
        lanes: 2,
        durationMinutes: 30
      }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d2'),
    name: 'पिंपलगांव बसवंत मंडी (Pimpalgaon Baswant APMC)',
    location: {
      type: 'Point',
      coordinates: [73.9856, 20.1692]
    },
    cropsHandled: ['Tomato', 'Grapes', 'Soybean'],
    workingHours: {
      start: '08:00',
      end: '18:00'
    },
    currentStatus: 'Amber',
    capacityConfig: [
      {
        crop: 'Tomato',
        maxDailySlots: 35,
        quantityBands: ['0-5q', '5-15q', '15q+'],
        lanes: 2,
        durationMinutes: 25
      }
    ]
  },
  {
    _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d3'),
    name: 'नासिक मुख्य मंडी (Nashik Main APMC Yard)',
    location: {
      type: 'Point',
      coordinates: [73.7900, 20.0000]
    },
    cropsHandled: ['Sharbati Wheat', 'Yellow Maize', 'Soybean'],
    workingHours: {
      start: '08:00',
      end: '18:00'
    },
    currentStatus: 'Red',
    capacityConfig: [
      {
        crop: 'Sharbati Wheat',
        maxDailySlots: 20,
        quantityBands: ['0-5q', '5-15q', '15q+'],
        lanes: 1,
        durationMinutes: 40
      }
    ]
  }
];

async function seedDatabase() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kisanq';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB successfully.');

    // 1. Seed Mandi Centres
    console.log('Seeding Mandi Centres...');
    for (const centreData of SEED_CENTRES) {
      await Centre.findByIdAndUpdate(
        centreData._id,
        centreData,
        { upsert: true, new: true, runValidators: true }
      );
      console.log(`  ✓ Centre seeded: ${centreData.name} [Status: ${centreData.currentStatus}]`);
    }

    // 2. Seed Staff Accounts
    console.log('Seeding Staff Accounts...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const staffSeedData = [
      {
        name: 'supervisor',
        role: 'supervisor',
        centreId: SEED_CENTRES[0]._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'guard',
        role: 'operator',
        centreId: SEED_CENTRES[0]._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'weighmaster',
        role: 'staff',
        centreId: SEED_CENTRES[0]._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'admin',
        role: 'district_admin',
        centreId: null,
        passwordHash,
        isActive: true
      }
    ];

    for (const staff of staffSeedData) {
      await StaffUser.findOneAndUpdate(
        { name: staff.name },
        staff,
        { upsert: true, new: true }
      );
      console.log(`  ✓ Staff seeded: ${staff.name} (Role: ${staff.role})`);
    }

    // 3. Seed Sample Farmer
    console.log('Seeding Sample Farmer...');
    const farmerSeed = {
      phone: '9876543210',
      name: 'रामचंद्र पाटील (Ramchandra Patil)',
      preferredLanguage: 'mr',
      registeredVia: 'app'
    };
    await Farmer.findOneAndUpdate(
      { phone: farmerSeed.phone },
      farmerSeed,
      { upsert: true, new: true }
    );
    console.log(`  ✓ Sample Farmer seeded: ${farmerSeed.name} (${farmerSeed.phone})`);

    console.log('\n✅ Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    if (error.name === 'MongooseServerSelectionError' || error.message.includes('ECONNREFUSED')) {
      console.warn('\n⚠️ [Seed Notice] MongoDB server is not running on localhost:27017.');
      console.warn('   The backend server automatically operates with in-memory fallbacks when MongoDB is offline.');
      console.warn('   To populate a real MongoDB instance, start your MongoDB service (mongod or Docker container) and re-run:');
      console.warn('   👉 npm run seed\n');
      process.exit(0);
    }
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
}

seedDatabase();
