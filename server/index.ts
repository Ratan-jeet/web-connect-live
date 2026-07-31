import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const MAX_ROOM_SIZE = 8;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Member = {
  id: string;
  name: string;
  inVoice: boolean;
};

type Room = {
  members: Map<string, Member>;
  isRandom: boolean;
};

type ChatMessage = {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  text: string;
  at: number;
};

type JoinAck = {
  ok: boolean;
  error?: string;
  roomCode?: string;
  members?: Member[];
  waiting?: boolean;
  isRandom?: boolean;
};

const rooms = new Map<string, Room>();

function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function uniqueRoomCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  return code;
}

function getRoomMembers(roomCode: string): Member[] {
  const room = rooms.get(roomCode);
  return room ? Array.from(room.members.values()) : [];
}

function broadcastMembers(io: Server, roomCode: string) {
  io.to(roomCode).emit("members", getRoomMembers(roomCode));
}

/** Prefer smaller open random rooms so waiting solo users get matched first. */
function findOpenRandomRoom(): string | null {
  let best: { code: string; size: number } | null = null;

  for (const [code, room] of rooms) {
    if (!room.isRandom) continue;
    const size = room.members.size;
    if (size === 0 || size >= MAX_ROOM_SIZE) continue;
    if (!best || size < best.size) {
      best = { code, size };
    }
  }

  return best?.code ?? null;
}

function placeInRoom(
  socket: Socket,
  roomCode: string,
  name: string,
  isRandom: boolean,
): Member[] {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, { members: new Map(), isRandom });
  }

  const room = rooms.get(roomCode)!;
  room.members.set(socket.id, { id: socket.id, name, inVoice: false });
  socket.join(roomCode);
  return getRoomMembers(roomCode);
}

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

function leaveCurrentRoom(sock: Socket, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const member = room.members.get(sock.id);
  room.members.delete(sock.id);
  sock.leave(roomCode);

  if (room.members.size === 0) {
    rooms.delete(roomCode);
  } else {
    sock.to(roomCode).emit("member-left", { id: sock.id, name: member?.name });
    broadcastMembers(io, roomCode);
  }
}

io.on("connection", (socket: Socket) => {
  let currentRoom: string | null = null;

  socket.on(
    "join-room",
    (payload: { name?: string; roomCode?: string }, ack?: (result: JoinAck) => void) => {
      const name = (payload.name ?? "").trim().slice(0, 24);
      const roomCode = normalizeRoomCode(payload.roomCode ?? "");

      if (!name) {
        ack?.({ ok: false, error: "Enter a display name." });
        return;
      }
      if (roomCode.length < 4) {
        ack?.({ ok: false, error: "Room code must be at least 4 characters." });
        return;
      }

      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, { members: new Map(), isRandom: false });
      }

      const room = rooms.get(roomCode)!;
      if (room.members.size >= MAX_ROOM_SIZE) {
        ack?.({ ok: false, error: "This room is full (max 8 people)." });
        return;
      }

      if (currentRoom) {
        leaveCurrentRoom(socket, currentRoom);
      }

      currentRoom = roomCode;
      const members = placeInRoom(socket, roomCode, name, room.isRandom);

      ack?.({ ok: true, roomCode, members, isRandom: room.isRandom });
      socket.to(roomCode).emit("member-joined", { id: socket.id, name, inVoice: false });
      broadcastMembers(io, roomCode);
    },
  );

  socket.on("join-random", (payload: { name?: string }, ack?: (result: JoinAck) => void) => {
    const name = (payload.name ?? "").trim().slice(0, 24);

    if (!name) {
      ack?.({ ok: false, error: "Enter a display name." });
      return;
    }

    if (currentRoom) {
      leaveCurrentRoom(socket, currentRoom);
      currentRoom = null;
    }

    const existing = findOpenRandomRoom();

    if (existing) {
      const room = rooms.get(existing)!;
      if (room.members.size >= MAX_ROOM_SIZE) {
        ack?.({ ok: false, error: "Could not join a random room. Try again." });
        return;
      }

      currentRoom = existing;
      const members = placeInRoom(socket, existing, name, true);

      ack?.({
        ok: true,
        roomCode: existing,
        members,
        waiting: members.length < 2,
        isRandom: true,
      });
      socket.to(existing).emit("member-joined", { id: socket.id, name, inVoice: false });
      broadcastMembers(io, existing);

      if (members.length >= 2) {
        io.to(existing).emit("random-matched", { roomCode: existing, members });
      }
      return;
    }

    const roomCode = uniqueRoomCode();
    currentRoom = roomCode;
    const members = placeInRoom(socket, roomCode, name, true);

    ack?.({
      ok: true,
      roomCode,
      members,
      waiting: true,
      isRandom: true,
    });
  });

  socket.on("chat-message", (payload: { text?: string }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    const member = room?.members.get(socket.id);
    if (!member) return;

    const text = (payload.text ?? "").trim().slice(0, 500);
    if (!text) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${socket.id}`,
      roomCode: currentRoom,
      senderId: socket.id,
      senderName: member.name,
      text,
      at: Date.now(),
    };

    io.to(currentRoom).emit("chat-message", message);
  });

  socket.on("voice-state", (payload: { inVoice?: boolean }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    const member = room?.members.get(socket.id);
    if (!member) return;

    member.inVoice = Boolean(payload.inVoice);
    broadcastMembers(io, currentRoom);
    socket.to(currentRoom).emit("voice-state", {
      id: socket.id,
      inVoice: member.inVoice,
    });
  });

  socket.on(
    "signal",
    (payload: {
      to?: string;
      type?: "offer" | "answer" | "ice-candidate";
      data?: unknown;
    }) => {
      if (!currentRoom || !payload.to || !payload.type) return;
      const room = rooms.get(currentRoom);
      if (!room?.members.has(payload.to)) return;

      io.to(payload.to).emit("signal", {
        from: socket.id,
        type: payload.type,
        data: payload.data,
      });
    },
  );

  socket.on("leave-room", () => {
    if (!currentRoom) return;
    leaveCurrentRoom(socket, currentRoom);
    currentRoom = null;
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;
    leaveCurrentRoom(socket, currentRoom);
    currentRoom = null;
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) res.status(404).send("Web Connect — run npm run build for production.");
  });
});

httpServer.listen(PORT, () => {
  console.log(`Web Connect server on http://localhost:${PORT}`);
});
