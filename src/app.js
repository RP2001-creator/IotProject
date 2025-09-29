// server.js
import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";  
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { RelayUsage } from "./RelayUsage.js";

dotenv.config({ path: "./env" });

const app = express();
app.use(cors());
app.use(express.json());

// ===== Relay state =====
let relayState = false;
let wss; // WebSocketServer reference

// ===== Helper function to broadcast relay state =====
function broadcastState() {
  if (!wss) return;
  const payload = JSON.stringify({ relay: relayState });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(payload);
  });
}

// ===== Helper functions for relay =====
async function turnRelayOn() {
  relayState = true;
  broadcastState();
  const usage = await RelayUsage.findOne({ relayId: "relay1" });
  if (!usage.lastStartTime) {
    usage.lastStartTime = new Date();
    await usage.save();
  }
}

async function turnRelayOff() {
  relayState = false;
  broadcastState();
  const usage = await RelayUsage.findOne({ relayId: "relay1" });
  if (usage.lastStartTime) {
    const durationSec = (new Date() - usage.lastStartTime) / 1000;
    usage.totalSeconds += durationSec;
    usage.lastStartTime = null;
    await usage.save();
  }
}

// ===== Connect to MongoDB and start server =====
connectDB()
  .then(async () => {
    // Ensure a usage document exists
    let usage = await RelayUsage.findOne({ relayId: "relay1" });
    if (!usage) {
      usage = new RelayUsage({
      relayId: "relay1",
      powerW: 3,       // 3W bulb
      voltage: 230,    
      unitPrice: 4.15, // Average Surat electricity price in ₹/kWh for 101–250 units
    });

      await usage.save();
    }

    const server = app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port: ${process.env.PORT || 3000}`);
    });

    // ===== WebSocket setup =====
    wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
      console.log("New client connected");

      // Send current state immediately
      ws.send(JSON.stringify({ relay: relayState }));

      ws.on("message", async (message) => {
        console.log("Received from client:", message.toString());

        try {
          const data = JSON.parse(message.toString());
          if (data.command === "on") await turnRelayOn();
          if (data.command === "off") await turnRelayOff();
        } catch (err) {
          console.log("Invalid message format");
        }
      });

      ws.on("close", () => console.log("Client disconnected"));
    });

  })
  .catch((err) => console.log("MongoDB connection failed!", err));

// ===== HTTP API Routes =====
app.get("/", (req, res) => res.send("WebSocket server running"));

app.post("/on", async (req, res) => {
  await turnRelayOn();
  res.json({ status: "Relay ON" });
});

app.post("/off", async (req, res) => {
  await turnRelayOff();
  res.json({ status: "Relay OFF" });
});

app.get("/status", (req, res) => {
  res.json({ relay: relayState ? "ON" : "OFF" });
});

// ===== New route: Usage =====
app.get("/usage", async (req, res) => {
  const usage = await RelayUsage.findOne({ relayId: "relay1" });
  if (!usage) return res.json({ energyKWh: 0, cost: 0 });

  let totalSec = usage.totalSeconds;
  if (usage.lastStartTime) {
    totalSec += (new Date() - usage.lastStartTime) / 1000;
  }

  const energyKWh = (usage.powerW * totalSec) / (1000 * 3600);
  const cost = energyKWh * usage.unitPrice;

  res.json({
    energyKWh: energyKWh.toFixed(3),
    cost: cost.toFixed(2),
    totalSeconds: Math.floor(totalSec),
  });
});

export { app };
