const { AuditLog } = require('../models');

const auditService = {
  /**
   * Query AuditLog with optional targetId and actorRole filters.
   * Returns up to 100 entries sorted by timestamp descending.
   */
  getAuditLogs: async ({ targetId, actorRole } = {}) => {
    const filter = {};
    if (targetId)  filter.targetId  = targetId;
    if (actorRole) filter.actorRole = actorRole;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return logs;
  }
};

module.exports = auditService;
