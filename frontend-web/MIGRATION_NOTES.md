# KisanQ Frontend V2 Architecture — Migration Notes

## Overview
The `frontend-web` application has been refactored into a modular, production-ready Single Page Application (SPA) with centralized state, hooks, constant definitions, and API client layers.

---

## 🏛️ Architecture & Folder Hierarchy

```
frontend-web/src/
├── api/                           # Resource-based modular API methods
│   ├── client.js                  # Axios instance with JWT & 401 interceptors
│   ├── auth.js                    # OTP request/verify & staff login/register API
│   ├── bookings.js                # Slot creation & booking history API
│   ├── centres.js                 # APMC Mandi discovery API
│   ├── exceptions.js              # Dispute & exception override API
│   ├── notifications.js           # Delivery logs & notification send API
│   ├── procurement.js             # Weighbridge weight & grade inspection API
│   └── queue.js                   # Live queue status & check-in API
├── components/                    # Reusable dumb UI components
│   ├── Banner.jsx                 # Status & error banners
│   ├── RequireRole.jsx            # Role-gated component wrapper
│   └── Spinner.jsx                # Loading indicator
├── constants/                     # Single Source of Truth
│   ├── events.js                  # Socket.IO event strings (queue:update)
│   ├── roles.js                   # Staff & Farmer RBAC roles
│   ├── routes.js                  # Application URL route paths
│   └── status.js                  # Booking & Mandi status enums
├── context/                       # Centralized React Contexts
│   ├── AuthContext.jsx            # Auth state, JWT persistence, role checks
│   └── SocketContext.jsx          # Socket.IO connection manager
├── hooks/                         # Custom React Hooks
│   ├── useAuth.js                 # Access AuthContext state & hasRole helper
│   └── useSocket.js               # Subscribe to room feeds & handle event cleanups
└── pages/                         # Route-level page components
    ├── Landing.jsx                # Main gateway selector (Farmer vs Staff)
    ├── Login.jsx                  # Mobile OTP request screen
    ├── OTPVerify.jsx              # OTP 6-digit verification screen
    ├── Dashboard.jsx              # Farmer central dashboard
    ├── MandiSelection.jsx         # APMC Mandi queue status feed
    ├── BookSlot.jsx               # Slot booking form (quantity band enum mapping)
    ├── LiveToken.jsx              # Digital Token tracking with socket & 10s fallback
    ├── StaffLogin.jsx             # Multi-role staff portal
    ├── GuardTerminal.jsx          # Gate entry check-in terminal
    ├── SupervisorExceptions.jsx   # Exception console & override form
    ├── WeighmasterDesk.jsx        # Weighbridge gross/tare weight & grade verification
    ├── AuctionBoard.jsx           # Live auctioneer bidding dashboard
    ├── PaymentCheckout.jsx        # Direct payout receipt & payment confirmation
    └── NotFound.jsx               # 404 Route fallback page
```

---

## 🔑 Key Preserved Fixes & Improvements

1. **Single Source of Truth Constants**:
   - String literals for Socket.IO events (`SOCKET_EVENTS.QUEUE_UPDATE`), user roles (`ROLES.SUPERVISOR`, `ROLES.GATE_GUARD`), and routes (`ROUTES.BOOK_SLOT`) are declared once in `src/constants/` and imported everywhere.
2. **Central Auth & Role-Based UI Gating**:
   - `AuthContext` provides a `hasRole(...allowedRoles)` utility.
   - `RequireRole` wrapper component conditionally hides sensitive actions (e.g. notification dispatch or supervisor override forms) for unauthorized roles.
3. **No Silent Error Swallowing**:
   - Every API invocation catches errors and surfaces user-friendly messages via `Banner` components.
   - Bypassing 401 redirects or mock state fallbacks is strictly gated behind `import.meta.env.VITE_DEMO_MODE === 'true'`.
4. **WebSocket Event Standardization**:
   - All real-time feed subscriptions strictly use `queue:update` with automatic listener cleanup on component unmount via `useSocket()`.
5. **Full-Stack Schema Alignment**:
   - `BookSlot.jsx` sends exact `quantityBand` enums (`'0-5q' | '5-15q' | '15q+'`) and valid 24-character Mongoose ObjectIds for `centreId`.
