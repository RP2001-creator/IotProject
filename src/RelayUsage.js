// models/RelayUsage.js
import mongoose from "mongoose";

const relayUsageSchema = new mongoose.Schema({
  relayId: {
    type: String,
    default: "relay1", // useful if you have multiple relays
  },
  powerW: {
    type: Number,
    required: true, // bulb or device power in Watts
  },
  voltage: {
    type: Number,
    required: true, // voltage of the device, e.g., 230V
  },
  unitPrice: {
    type: Number,
    required: true, // electricity price in ₹/kWh
  },
  totalSeconds: {
    type: Number,
    default: 0, // cumulative ON duration in seconds
  },
  lastStartTime: {
    type: Date,
    default: null, // timestamp when relay was last turned ON
  },
});

export const RelayUsage = mongoose.model("RelayUsage", relayUsageSchema);
