import { io, Socket } from "socket.io-client";
import type { ChatMessage, Member, SignalPayload } from "../types";

export type JoinResult = {
  ok: boolean;
  error?: string;
  roomCode?: string;
  members?: Member[];
  waiting?: boolean;
  isRandom?: boolean;
};

export type ServerToClientEvents = {
  members: (members: Member[]) => void;
  "member-joined": (member: Member) => void;
  "member-left": (payload: { id: string; name?: string }) => void;
  "chat-message": (message: ChatMessage) => void;
  "voice-state": (payload: { id: string; inVoice: boolean }) => void;
  "random-matched": (payload: { roomCode: string; members: Member[] }) => void;
  signal: (payload: SignalPayload) => void;
};

export type ClientToServerEvents = {
  "join-room": (
    payload: { name: string; roomCode: string },
    ack: (result: JoinResult) => void,
  ) => void;
  "join-random": (payload: { name: string }, ack: (result: JoinResult) => void) => void;
  "leave-room": () => void;
  "chat-message": (payload: { text: string }) => void;
  "voice-state": (payload: { inVoice: boolean }) => void;
  signal: (payload: {
    to: string;
    type: "offer" | "answer" | "ice-candidate";
    data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  }) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
