const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ['dine-in', 'takeaway', 'delivery'],
      default: 'dine-in',
      index: true,
    },
    // Table is only required for dine-in orders; takeaway/delivery have no table.
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: function () { return (this.orderType || 'dine-in') === 'dine-in'; },
    },
    // Set when an order is placed on a table that has an active reservation, so the
    // reservation's advance can be reconciled against this bill.
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
    customerPhone: {
      type: String,
      default: null,
      index: true
    },
    customerName: {
      type: String,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Required for staff-placed orders; null for customer self-orders (QR/online).
      required: function () { return (this.source || 'staff') === 'staff'; },
    },
    // How the order was placed: staff (POS), or a customer self-order via QR/online.
    source: {
      type: String,
      enum: ['staff', 'qr', 'online'],
      default: 'staff',
    },
    assignedChef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
          required: true,
        },
        itemName: String, // Snapshot name
        price: {
          type: Number,
          required: true,
          default: 0,
        },
        costPrice: {
          type: Number,
          default: 0,
        },
        // Selected customizations (size, add-ons, etc.) snapshotted at order time.
        // priceDelta is the SERVER-validated value (never trusted from the client);
        // `price` above already includes the sum of these deltas.
        modifiers: {
          type: [
            {
              groupName: String,
              label: String,
              priceDelta: { type: Number, default: 0 },
              _id: false,
            },
          ],
          default: [],
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity cannot be less than 1'],
        },
        notes: {
          type: String,
        },
        // Per-item kitchen status (KOT). Lets the kitchen prepare/ready items of an
        // order independently; the order-level status remains the billing source.
        status: {
          type: String,
          enum: ['pending', 'preparing', 'ready', 'served'],
          default: 'pending',
        },
      },
    ],
    status: {
      type: String,
      enum: [
        'PLACED',
        'ACCEPTED',
        'PREPARING',
        'READY',
        'SERVED',
        'COMPLETED',
        'CANCELLED',
        'REJECTED',
      ],
      default: 'PLACED',
      index: true,
    },
    isBilled: {
      type: Boolean,
      default: false,
    },
    isRefunded: {
      type: Boolean,
      default: false,
    },
    refundReason: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    chefNote: {
      type: String,
    },
    rejectReason: {
      type: String,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    paymentType: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'ONLINE', 'GIFT_CARD', 'OTHER'],
      default: 'CASH',
    },
    // Payment settlement, separate from the kitchen lifecycle. An order can be
    // COMPLETED but still unpaid (running tab / credit), or partially paid.
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
      index: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Amount paid cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    // GST collected on this order (5% of the post-discount taxable amount),
    // captured at completion so it can be reported for tax filing. Revenue itself
    // stays GST-exclusive (GST is a pass-through liability, not income).
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Service charge applied on the bill (₹), from branch settings.
    serviceCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    // The actual amount the customer pays = (subtotal - discount) + service + GST.
    // Distinct from totalAmount (GST-exclusive sales value used for revenue).
    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Sequential, GST-compliant invoice number assigned at bill generation.
    invoiceNumber: {
      type: String,
      default: null,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Index for analytical and dashboard capabilities
orderSchema.index({ createdAt: -1 });
orderSchema.index({ createdBy: 1 });
orderSchema.index({ assignedChef: 1 });
orderSchema.index({ servedBy: 1 });
orderSchema.index({ paymentType: 1 });

// Hot path: list/analytics queries filter on (branch, status) and sort by createdAt desc
orderSchema.index({ branch: 1, status: 1, createdAt: -1 });
// Hot path: per-table order lookups (anti-spam check, table billing)
orderSchema.index({ table: 1, branch: 1, createdAt: -1 });
// Hot path: status history tracking for kitchen efficiency reports
orderSchema.index({ 'statusHistory.status': 1 });
// Hot path: customer-centric CRM lookups
orderSchema.index({ customerPhone: 1, branch: 1 });

orderSchema.query.byBranch = function(branchId) {
  return this.where({ branch: branchId });
};

orderSchema.query.active = function() {
  return this.where({ status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] } });
};

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
