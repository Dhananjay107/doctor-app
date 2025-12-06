import { io, Socket } from "socket.io-client";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

let socket: Socket | null = null;

export function initializeSocket(token: string): Socket {
  if (socket?.connected) {
    console.log("✅ Socket already connected, reusing existing connection");
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  console.log("🔌 Initializing Socket.IO connection (Doctor)...");
  socket = io(API_BASE, {
    transports: ["websocket", "polling"],
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
  });

  socket.on("connect", () => {
    console.log("✅ Socket.IO connected (Doctor)");
    console.log("✅ Socket ID:", socket?.id);
    console.log("✅ Socket.IO ready to receive real-time events");
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket.IO disconnected (Doctor), reason:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket.IO connection error (Doctor):", error);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("🔄 Socket.IO reconnected (Doctor) after", attemptNumber, "attempts");
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("🔄 Socket.IO reconnection attempt", attemptNumber, "(Doctor)");
  });

  socket.on("reconnect_error", (error) => {
    console.error("❌ Socket.IO reconnection error (Doctor):", error);
  });

  socket.on("reconnect_failed", () => {
    console.error("❌ Socket.IO reconnection failed (Doctor)");
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// Event listeners helper
export function onSocketEvent(event: string, callback: (data: any) => void) {
  if (socket) {
    socket.on(event, callback);
  }
}

export function offSocketEvent(event: string, callback?: (data: any) => void) {
  if (socket) {
    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  }
}

