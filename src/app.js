import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";  
const app = express();
app.use(cors());  
// ===== Minimal middleware =====
app.use(express.json());

// ===== Relay state =====
let relayState = false;

// ===== HTTP API Routes =====
app.get("/", (req, res) => {
  res.send("WebSocket server running");
});

app.post("/on", (req, res) => {
  relayState = true;
  broadcastState();
  res.json({ status: "Relay ON" });
});

app.post("/off", (req, res) => {
  relayState = false;
  broadcastState();
  res.json({ status: "Relay OFF" });
});
// ===== New route: Get current relay state =====
app.get("/status", (req, res) => {
  res.json({ relay: relayState ? "ON" : "OFF" });
});


// ===== Start HTTP server =====
const server = app.listen(3000, () => {
  console.log("HTTP server running on port 3000");
});

// ===== WebSocket setup =====
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("New client connected");

  // Send current state immediately
  ws.send(JSON.stringify({ relay: relayState }));

  ws.on("message", (message) => {
    console.log("Received from client:", message.toString());

    // Optional: parse JSON from clients
    try {
      const data = JSON.parse(message.toString());
      if (data.command === "on") relayState = true;
      if (data.command === "off") relayState = false;

      // Broadcast updated state
      broadcastState();
    } catch (err) {
      console.log("Invalid message format");
    }
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// ===== Helper: Broadcast relay state to all WebSocket clients =====
function broadcastState() {
  const payload = JSON.stringify({ relay: relayState });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

// ✅ Export app
export { app };
