const mongoose = require('mongoose');
const { Centre, Booking } = require('../models');
const logger = require('../utils/logger');

// In-memory fallback for centres when DB is in testing/mock mode
const inMemoryCentres = new Map();

const centreService = {
  /**
   * List all centres with computed live traffic load status (Green / Amber / Red)
   */
  getAllCentres: async (filters = {}) => {
    let centres = [];
    const query = {};

    if (filters.crop) {
      query.cropsHandled = { $in: [filters.crop] };
    }

    try {
      if (mongoose.connection.readyState === 1) {
        centres = await Centre.find(query).lean();
      } else {
        centres = Array.from(inMemoryCentres.values());
      }
    } catch (err) {
      logger.warn(`Fallback to memory for centres: ${err.message}`);
      centres = Array.from(inMemoryCentres.values());
    }

    // Default seed centre if none exist yet
    if (centres.length === 0) {
      const defaultCentre = {
        _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
        name: 'APMC Central Hub - Nagpur',
        location: {
          type: 'Point',
          coordinates: [79.0882, 21.1458] // [lng, lat]
        },
        cropsHandled: ['Soybean', 'Cotton', 'Wheat', 'Paddy'],
        workingHours: { start: '08:00', end: '18:00' },
        capacityConfig: [
          {
            crop: 'Soybean',
            maxDailySlots: 60,
            quantityBands: ['0-5q', '5-15q', '15q+'],
            lanes: 3,
            durationMinutes: 30
          },
          {
            crop: 'Cotton',
            maxDailySlots: 40,
            quantityBands: ['0-5q', '5-15q', '15q+'],
            lanes: 2,
            durationMinutes: 30
          }
        ],
        currentStatus: 'Green'
      };

      try {
        if (mongoose.connection.readyState === 1) {
          const created = await Centre.create(defaultCentre);
          centres = [created.toObject()];
        } else {
          inMemoryCentres.set(defaultCentre._id.toString(), defaultCentre);
          centres = [defaultCentre];
        }
      } catch (e) {
        inMemoryCentres.set(defaultCentre._id.toString(), defaultCentre);
        centres = [defaultCentre];
      }
    }

    // Compute live capacity and load for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const enrichedCentres = await Promise.all(
      centres.map(async (centre) => {
        let activeBookingsCount = 0;
        try {
          if (mongoose.connection.readyState === 1) {
            activeBookingsCount = await Booking.countDocuments({
              centreId: centre._id,
              status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
              arrivalWindowStart: { $gte: todayStart, $lte: todayEnd }
            });
          }
        } catch (e) {
          activeBookingsCount = 0;
        }

        // Sum max daily slots across capacityConfig
        const totalCapacity =
          centre.capacityConfig?.reduce((sum, c) => sum + (c.maxDailySlots || 50), 0) || 100;

        const utilizationPercent = Math.min(100, Math.round((activeBookingsCount / totalCapacity) * 100));

        // Traffic Light Logic: Green (<70%), Amber (70-90%), Red (>90%)
        let computedStatus = 'Green';
        if (utilizationPercent > 90) {
          computedStatus = 'Red';
        } else if (utilizationPercent >= 70) {
          computedStatus = 'Amber';
        }

        return {
          ...centre,
          currentStatus: computedStatus,
          activeBookingsCount,
          totalCapacity,
          utilizationPercent
        };
      })
    );

    return enrichedCentres;
  },

  /**
   * Get single centre details
   */
  getCentreById: async (id) => {
    let centre = null;
    try {
      if (mongoose.connection.readyState === 1) {
        centre = await Centre.findById(id);
      } else if (inMemoryCentres.has(id.toString())) {
        centre = inMemoryCentres.get(id.toString());
      }
    } catch (err) {
      if (inMemoryCentres.has(id.toString())) {
        centre = inMemoryCentres.get(id.toString());
      }
    }

    if (!centre) {
      throw new Error(`Centre with ID ${id} not found`);
    }

    return centre;
  },

  /**
   * Compute available arrival windows for a specific crop and date
   */
  getCentreAvailability: async (centreId, { crop, quantityBand, date }) => {
    const centre = await centreService.getCentreById(centreId);

    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Find capacity config for the crop
    const cropConfig = centre.capacityConfig?.find((c) => c.crop.toLowerCase() === (crop || '').toLowerCase()) ||
      centre.capacityConfig?.[0] || {
        crop: crop || 'General',
        maxDailySlots: 50,
        lanes: 2,
        durationMinutes: 30
      };

    const durationMinutes = cropConfig.durationMinutes || 30;
    const workingHours = centre.workingHours || { start: '08:00', end: '18:00' };

    const [startHour, startMin] = workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workingHours.end.split(':').map(Number);

    const startTime = new Date(dateStr);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(dateStr);
    endTime.setHours(endHour, endMin, 0, 0);

    // Calculate slots per window based on total lanes and daily slots
    const totalMinutes = (endTime - startTime) / (1000 * 60);
    const totalWindows = Math.max(1, Math.floor(totalMinutes / durationMinutes));
    const slotsPerWindow = Math.max(2, Math.ceil((cropConfig.maxDailySlots || 50) / totalWindows));

    const windows = [];
    let currentWindowStart = new Date(startTime);

    while (currentWindowStart < endTime) {
      const currentWindowEnd = new Date(currentWindowStart.getTime() + durationMinutes * 60 * 1000);
      if (currentWindowEnd > endTime) break;

      // Count booked slots in this arrival window
      let bookedSlots = 0;
      try {
        if (mongoose.connection.readyState === 1) {
          bookedSlots = await Booking.countDocuments({
            centreId: centre._id,
            crop: cropConfig.crop,
            status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] },
            arrivalWindowStart: { $lt: currentWindowEnd },
            arrivalWindowEnd: { $gt: currentWindowStart }
          });
        }
      } catch (err) {
        bookedSlots = 0;
      }

      const availableSlots = Math.max(0, slotsPerWindow - bookedSlots);
      const isAvailable = availableSlots > 0;

      const formatTime = (d) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      windows.push({
        windowStart: currentWindowStart.toISOString(),
        windowEnd: currentWindowEnd.toISOString(),
        timeLabel: `${formatTime(currentWindowStart)} - ${formatTime(currentWindowEnd)}`,
        maxSlots: slotsPerWindow,
        bookedSlots,
        availableSlots,
        isAvailable
      });

      currentWindowStart = currentWindowEnd;
    }

    return {
      centreId: centre._id,
      centreName: centre.name,
      date: dateStr,
      crop: cropConfig.crop,
      quantityBand: quantityBand || '0-5q',
      durationMinutes,
      totalWindows: windows.length,
      windows
    };
  },

  /**
   * Create a new Centre (Admin / Supervisor)
   */
  createCentre: async (centreData) => {
    let centre = null;
    try {
      if (mongoose.connection.readyState === 1) {
        centre = await Centre.create(centreData);
      }
    } catch (err) {
      logger.warn(`Direct DB create bypassed: ${err.message}`);
    }

    if (!centre) {
      centre = {
        _id: new mongoose.Types.ObjectId(),
        ...centreData,
        currentStatus: 'Green'
      };
      inMemoryCentres.set(centre._id.toString(), centre);
    }

    return centre;
  }
};

module.exports = centreService;
