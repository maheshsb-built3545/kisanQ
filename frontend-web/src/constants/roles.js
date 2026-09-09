export const ROLES = {
  FARMER: 'farmer',
  GATE_GUARD: 'operator',
  WEIGHMASTER: 'staff',
  AUCTIONEER: 'operator',
  SUPERVISOR: 'supervisor',
  DISTRICT_ADMIN: 'district_admin',
  AUDITOR: 'auditor',
};

export const STAFF_ROLE_OPTIONS = [
  { id: 'gate_guard', role: ROLES.GATE_GUARD, emoji: '🛡️', label: 'Gate Guard / द्वारपाल', sub: 'Gate check-in & Queue management', route: '/guard-terminal' },
  { id: 'weighmaster', role: ROLES.WEIGHMASTER, emoji: '⚖️', label: 'Weighmaster / तौलिया', sub: 'Weighbridge & Grade verification', route: '/weighmaster-desk' },
  { id: 'auctioneer', role: ROLES.AUCTIONEER, emoji: '🔨', label: 'Auctioneer / नीलामकर्ता', sub: 'Live auction & Hammer operations', route: '/auction-board' },
  { id: 'supervisor', role: ROLES.SUPERVISOR, emoji: '👨‍💼', label: 'Supervisor / पर्यवेक्षक', sub: 'Full access – Exceptions & Overrides', route: '/supervisor-exceptions' },
  { id: 'district_admin', role: ROLES.DISTRICT_ADMIN, emoji: '🏛️', label: 'District Admin / जिला अधिकारी', sub: 'Multi-mandi oversight & Reports', route: '/dashboard' },
];

export const CAN_MANAGE_NOTIFICATIONS = [ROLES.SUPERVISOR, ROLES.DISTRICT_ADMIN];
export const CAN_OVERRIDE_EXCEPTIONS = [ROLES.SUPERVISOR, ROLES.DISTRICT_ADMIN];
