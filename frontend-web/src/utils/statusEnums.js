/**
 * Standardized KisanQ Token Status Enums and Normalization Utility (Frontend)
 */
export const TOKEN_STATUS = {
  BOOKED: 'Booked',
  IN_PROGRESS: 'In-Progress',
  GATE_EXIT_REQUESTED: 'Gate-Exit-Requested',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

export function normalizeStatus(status) {
  if (!status) return TOKEN_STATUS.BOOKED;
  const s = String(status).trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (
    s === 'GATE-EXIT-REQUESTED' ||
    s === 'GATE-EXIT-REQUEST' ||
    s === 'GATE_EXIT_REQUESTED' ||
    s === 'EXIT-REQUESTED' ||
    s === 'EXIT_REQUESTED' ||
    s === 'GATEEXITREQUESTED'
  ) {
    return TOKEN_STATUS.GATE_EXIT_REQUESTED;
  }
  if (s === 'COMPLETED' || s === 'DONE') {
    return TOKEN_STATUS.COMPLETED;
  }
  if (s === 'CANCELLED' || s === 'CANCELED') {
    return TOKEN_STATUS.CANCELLED;
  }
  if (
    s === 'IN-PROGRESS' ||
    s === 'INPROGRESS' ||
    s === 'GATE-IN' ||
    s === 'GATE_IN' ||
    s === 'INSPECTED' ||
    s === 'WEIGHED' ||
    s === 'PROCUREMENT' ||
    s === 'PAYOUT'
  ) {
    return TOKEN_STATUS.IN_PROGRESS;
  }
  if (s === 'BOOKED' || s === 'PENDING') {
    return TOKEN_STATUS.BOOKED;
  }
  return status;
}

export function isTokenActive(status) {
  const norm = normalizeStatus(status);
  return norm !== TOKEN_STATUS.COMPLETED && norm !== TOKEN_STATUS.CANCELLED;
}
