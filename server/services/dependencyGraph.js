// Dependency registry for destructive super_admin operations.
//
// Deleting a cafe, a branch or a person touches 74 reference fields spread over
// 30 collections. Rather than scatter that knowledge across controllers, every
// relationship is declared once here, and `cascadeDelete.js` both *counts* and
// *executes* from the same table. A preview can therefore never disagree with
// what the delete actually does — they read the identical entries.
//
// Each entry carries a disposition:
//
//   'cascade'  The row only exists because the parent exists (a table belongs to
//              a branch, a branch belongs to a cafe). It is removed.
//   'preserve' The row is a financial or audit record. It is NEVER removed by a
//              cascade, at any depth, under any flag — including a forced
//              delete. Revenue history must keep reconciling after a person
//              leaves. These rows survive and re-attribute on screen to
//              "<name> (removed)".
//   'detach'   The row outlives the parent but must stop pointing at it, e.g. a
//              cafe-wide menu item listing a branch that no longer exists.
//
// `preserve` is deliberately not overridable. It is the guarantee behind
// "other data entries can't be deleted from these actions": the only way to
// remove a financial record is to delete that specific record on its own page,
// one at a time, as a considered act.

const mongoose = require('mongoose');

const M = (name) => mongoose.model(name);

// ---------------------------------------------------------------------------
// Branch (Location) dependents
// ---------------------------------------------------------------------------

const LOCATION_DEPENDENTS = [
  // --- cascade: pure branch configuration -----------------------------------
  {
    key: 'tables',
    label: 'Tables',
    disposition: 'cascade',
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('Table').deleteMany({ locationId: { $in: ids } }),
  },
  {
    key: 'menuItemsBranchOnly',
    label: 'Branch-only menu items',
    disposition: 'cascade',
    // Items *owned* by this branch. Cafe-wide items merely list the branch in
    // `availableBranches` and are handled by the detach entry below — deleting
    // them here would silently strip the menu from every other branch.
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('MenuItem').deleteMany({ locationId: { $in: ids } }),
  },
  {
    key: 'branchStock',
    label: 'Stock rows',
    disposition: 'cascade',
    filter: (ids) => ({ branch: { $in: ids } }),
    exec: (ids) => M('BranchStock').deleteMany({ branch: { $in: ids } }),
  },
  {
    key: 'branchInventory',
    label: 'Inventory rows',
    disposition: 'cascade',
    filter: (ids) => ({ branch: { $in: ids } }),
    exec: (ids) => M('BranchInventory').deleteMany({ branch: { $in: ids } }),
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    disposition: 'cascade',
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('Supplier').deleteMany({ locationId: { $in: ids } }),
  },
  {
    key: 'waitlist',
    label: 'Waitlist entries',
    disposition: 'cascade',
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('Waitlist').deleteMany({ locationId: { $in: ids } }),
  },
  {
    key: 'reservations',
    label: 'Reservations',
    disposition: 'cascade',
    // Forward commitments against a branch that will not exist. Keeping them
    // would leave guests holding bookings nobody can honour.
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('Reservation').deleteMany({ locationId: { $in: ids } }),
  },
  {
    key: 'bookings',
    label: 'Table bookings',
    disposition: 'cascade',
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('Booking').deleteMany({ locationId: { $in: ids } }),
  },
  {
    key: 'settingsBranch',
    label: 'Branch settings',
    disposition: 'cascade',
    filter: (ids) => ({ locationId: { $in: ids } }),
    exec: (ids) => M('Settings').deleteMany({ locationId: { $in: ids } }),
  },

  // --- preserve: money and audit trail --------------------------------------
  {
    key: 'orders',
    label: 'Orders',
    disposition: 'preserve',
    filter: (ids) => ({ branch: { $in: ids } }),
  },
  {
    key: 'transactions',
    label: 'Revenue transactions',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'expenses',
    label: 'Expenses',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'payroll',
    label: 'Payroll records',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'cashSessions',
    label: 'Cash drawer sessions',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'giftCards',
    label: 'Gift cards',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'purchaseOrders',
    label: 'Purchase orders',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'wasteRecords',
    label: 'Waste records',
    disposition: 'preserve',
    filter: (ids) => ({ branch: { $in: ids } }),
  },
  {
    key: 'attendance',
    label: 'Attendance records',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'leaveRequests',
    label: 'Leave requests',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'feedback',
    label: 'Customer feedback',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },
  {
    key: 'auditLogs',
    label: 'Audit log entries',
    disposition: 'preserve',
    filter: (ids) => ({ locationId: { $in: ids } }),
  },

  // --- detach: survives, but must stop referencing the branch ---------------
  {
    key: 'menuItemsShared',
    label: 'Cafe-wide menu items serving this branch',
    disposition: 'detach',
    filter: (ids) => ({ availableBranches: { $in: ids }, locationId: { $nin: ids } }),
    exec: (ids) =>
      M('MenuItem').updateMany(
        { availableBranches: { $in: ids } },
        { $pull: { availableBranches: { $in: ids } } }
      ),
  },
  {
    key: 'couponBranches',
    label: 'Coupons targeting this branch',
    disposition: 'detach',
    filter: (ids) => ({ branches: { $in: ids } }),
    exec: (ids) =>
      M('Coupon').updateMany({ branches: { $in: ids } }, { $pull: { branches: { $in: ids } } }),
  },
  {
    key: 'customerBranches',
    label: 'Customers who visited this branch',
    disposition: 'detach',
    filter: (ids) => ({ branches: { $in: ids } }),
    // Only the branch list is trimmed. The customer, their spend and their
    // loyalty balance are untouched — they belong to the cafe, not the branch.
    exec: (ids) =>
      M('Customer').updateMany({ branches: { $in: ids } }, { $pull: { branches: { $in: ids } } }),
  },
  {
    key: 'notificationTargets',
    label: 'Branch-targeted notifications',
    disposition: 'cascade',
    filter: (ids) => ({ locationTarget: { $in: ids } }),
    exec: (ids) => M('Notification').deleteMany({ locationTarget: { $in: ids } }),
  },
];

// ---------------------------------------------------------------------------
// Cafe dependents (branch-level rows are reached by expanding the cafe's
// branches first — see cascadeDelete.js — so this list covers only rows that
// hang off the cafe directly).
// ---------------------------------------------------------------------------

const CAFE_DEPENDENTS = [
  {
    key: 'branches',
    label: 'Branches',
    disposition: 'cascade',
    filter: (ids) => ({ cafe: { $in: ids }, isPermanentlyDeleted: { $ne: true } }),
    // Executed by the engine, which recurses into LOCATION_DEPENDENTS first.
    exec: null,
  },
  {
    key: 'coupons',
    label: 'Coupons',
    disposition: 'cascade',
    filter: (ids) => ({ cafe: { $in: ids } }),
    exec: (ids) => M('Coupon').deleteMany({ cafe: { $in: ids } }),
  },
  {
    key: 'settingsCafe',
    label: 'Cafe settings',
    disposition: 'cascade',
    filter: (ids) => ({ cafeId: { $in: ids } }),
    exec: (ids) => M('Settings').deleteMany({ cafeId: { $in: ids } }),
  },
  {
    key: 'customers',
    label: 'CRM customer profiles',
    disposition: 'cascade',
    // A customer's identity is global (one phone = one Customer) but their
    // membership — status, spend, loyalty points — is per cafe. Removing the
    // cafe removes that membership; the person survives for their other cafes.
    filter: (ids) => ({ 'memberships.cafe': { $in: ids } }),
    exec: (ids) =>
      M('Customer').updateMany(
        { 'memberships.cafe': { $in: ids } },
        { $pull: { memberships: { cafe: { $in: ids } } } }
      ),
  },
  {
    key: 'permissionPresets',
    label: 'Permission presets',
    disposition: 'detach',
    filter: (ids) => ({ cafes: { $in: ids } }),
    exec: (ids) =>
      M('PermissionPreset').updateMany({ cafes: { $in: ids } }, { $pull: { cafes: { $in: ids } } }),
  },
];

// ---------------------------------------------------------------------------
// User dependents.
//
// A removed person is soft-deleted, so nothing that references them breaks —
// every `populate` still resolves and renders "<name> (removed)". That is why
// this list has no 'detach' rows: there is no dangling pointer to repair.
// What it does describe is the *blast radius* the confirmation dialog needs to
// show, plus the one genuine cascade — the people who report to them.
// ---------------------------------------------------------------------------

const USER_DEPENDENTS = [
  {
    key: 'ordersCreated',
    label: 'Orders taken',
    disposition: 'preserve',
    filter: (ids) => ({ $or: [{ createdBy: { $in: ids } }, { assignedChef: { $in: ids } }, { servedBy: { $in: ids } }] }),
  },
  {
    key: 'transactions',
    label: 'Revenue entries',
    disposition: 'preserve',
    filter: (ids) => ({ $or: [{ staffId: { $in: ids } }, { createdBy: { $in: ids } }, { approvedBy: { $in: ids } }] }),
  },
  {
    key: 'expenses',
    label: 'Expenses recorded',
    disposition: 'preserve',
    filter: (ids) => ({ createdBy: { $in: ids } }),
  },
  {
    key: 'payroll',
    label: 'Payroll records',
    disposition: 'preserve',
    filter: (ids) => ({ user: { $in: ids } }),
  },
  {
    key: 'attendance',
    label: 'Attendance records',
    disposition: 'preserve',
    filter: (ids) => ({ user: { $in: ids } }),
  },
  {
    key: 'leaveRequests',
    label: 'Leave requests',
    disposition: 'preserve',
    filter: (ids) => ({ user: { $in: ids } }),
  },
  {
    key: 'cashSessions',
    label: 'Cash drawer sessions',
    disposition: 'preserve',
    filter: (ids) => ({ $or: [{ openedBy: { $in: ids } }, { closedBy: { $in: ids } }] }),
  },
  {
    key: 'auditLogs',
    label: 'Audit log entries',
    disposition: 'preserve',
    filter: (ids) => ({ performedBy: { $in: ids } }),
  },
];

// Model name per dependent key, so the engine can count without each entry
// repeating it.
const MODEL_FOR_KEY = {
  // location
  tables: 'Table',
  menuItemsBranchOnly: 'MenuItem',
  menuItemsShared: 'MenuItem',
  branchStock: 'BranchStock',
  branchInventory: 'BranchInventory',
  suppliers: 'Supplier',
  waitlist: 'Waitlist',
  reservations: 'Reservation',
  bookings: 'Booking',
  settingsBranch: 'Settings',
  orders: 'Order',
  transactions: 'Transaction',
  expenses: 'Expense',
  payroll: 'Payroll',
  cashSessions: 'CashSession',
  giftCards: 'GiftCard',
  purchaseOrders: 'PurchaseOrder',
  wasteRecords: 'WasteRecord',
  attendance: 'Attendance',
  leaveRequests: 'LeaveRequest',
  feedback: 'Feedback',
  auditLogs: 'AuditLog',
  couponBranches: 'Coupon',
  customerBranches: 'Customer',
  notificationTargets: 'Notification',
  // cafe
  branches: 'Location',
  coupons: 'Coupon',
  settingsCafe: 'Settings',
  customers: 'Customer',
  permissionPresets: 'PermissionPreset',
  // user
  ordersCreated: 'Order',
};

module.exports = {
  LOCATION_DEPENDENTS,
  CAFE_DEPENDENTS,
  USER_DEPENDENTS,
  MODEL_FOR_KEY,
};
