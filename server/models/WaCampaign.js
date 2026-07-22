const mongoose = require('mongoose');

// One bulk WhatsApp broadcast. Recipients are snapshotted at send time with their
// per-message id (wamid) so delivery/read receipts coming back on the webhook can
// be matched and the live counters updated.
const recipientSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name: String,
    phone: String,
    wamid: { type: String, index: true }, // Meta message id, set on accept
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'queued',
    },
    error: String,
  },
  { _id: false }
);

const waCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Broadcast' },
    template: { type: String, required: true },
    language: { type: String, default: 'en' },
    // The template variable values (may contain the {name} token), kept so a
    // batched/resumed send personalises exactly like the first batch.
    variables: { type: [String], default: [] },
    // What was targeted, kept for the history view.
    segment: { type: String, default: 'all' },
    cafe: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', default: null },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // How the automation engine or a person launched it.
    source: { type: String, enum: ['broadcast', 'automation'], default: 'broadcast' },
    trigger: { type: String, default: null }, // set when source==='automation'
    status: {
      type: String,
      enum: ['sending', 'completed', 'failed'],
      default: 'sending',
    },
    counts: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
    },
    recipients: [recipientSchema],
  },
  { timestamps: true }
);

waCampaignSchema.index({ createdAt: -1 });
waCampaignSchema.index({ cafe: 1, createdAt: -1 });

module.exports = mongoose.model('WaCampaign', waCampaignSchema);
