const mongoose = require('mongoose');

/**
 * StaffUser Schema
 * Internal authentication and role-based access for procurement centre operators, supervisors, and admins.
 */
const staffUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Staff user name is required'],
      trim: true
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['operator', 'staff', 'supervisor', 'district_admin', 'auditor'],
        message: '{VALUE} is not a valid staff role'
      }
    },
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      // Optional for system/district admins and multi-centre auditors
      required: function () {
        return ['operator', 'staff', 'supervisor'].includes(this.role);
      }
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

staffUserSchema.index({ role: 1, centreId: 1 });

const StaffUser = mongoose.model('StaffUser', staffUserSchema);

module.exports = StaffUser;
