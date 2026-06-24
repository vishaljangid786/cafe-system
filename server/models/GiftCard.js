const mongoose = require('mongoose');

const txnSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['issue', 'redeem', 'topup'], required: true },
    amount: { type: Number, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

// A prepaid gift card / store credit. Balance is a liability until redeemed, so
// issuing does NOT record sales revenue — redemption is settled against an order
// the normal way. locationId null = usable org-wide.
const giftCardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    initialBalance: { type: Number, required: true, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    issuedToName: { type: String, default: '' },
    issuedToPhone: { type: String, default: '' },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    transactions: { type: [txnSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GiftCard', giftCardSchema);
