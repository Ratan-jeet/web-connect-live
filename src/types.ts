export type Member = {
  id: string;
  name: string;
  inVoice: boolean;
};

export type ChatMessage = {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  text: string;
  at: number;
};

export type SignalPayload = {
  from: string;
  type: "offer" | "answer" | "ice-candidate";
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

export type Session = {
  name: string;
  roomCode: string;
  selfId: string;
  isRandom?: boolean;
};
