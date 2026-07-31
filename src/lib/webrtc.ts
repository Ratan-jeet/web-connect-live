import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./socket";
import type { SignalPayload } from "../types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type MeshSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class VoiceMesh {
  private socket: MeshSocket;
  private selfId: string;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private remoteAudio = new Map<string, HTMLAudioElement>();
  private muted = false;
  private onError: (message: string) => void;

  constructor(socket: MeshSocket, selfId: string, onError: (message: string) => void) {
    this.socket = socket;
    this.selfId = selfId;
    this.onError = onError;
    this.socket.on("signal", this.handleSignal);
  }

  get isActive() {
    return this.localStream !== null;
  }

  get isMuted() {
    return this.muted;
  }

  async join(peerIds: string[]) {
    if (this.localStream) return;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch {
      this.onError("Microphone access is required for voice.");
      throw new Error("mic-denied");
    }

    this.socket.emit("voice-state", { inVoice: true });

    // Deterministic offerer: lower socket id creates the offer to avoid glare.
    for (const peerId of peerIds) {
      if (peerId === this.selfId) continue;
      if (this.selfId < peerId) {
        await this.createPeer(peerId, true);
      } else {
        await this.createPeer(peerId, false);
      }
    }
  }

  async addPeer(peerId: string) {
    if (!this.localStream || peerId === this.selfId || this.peers.has(peerId)) return;
    if (this.selfId < peerId) {
      await this.createPeer(peerId, true);
    } else {
      await this.createPeer(peerId, false);
    }
  }

  removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    const audio = this.remoteAudio.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudio.delete(peerId);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  leave() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.muted = false;
    this.socket.emit("voice-state", { inVoice: false });
  }

  dispose() {
    this.leave();
    this.socket.off("signal", this.handleSignal);
  }

  private handleSignal = async (payload: SignalPayload) => {
    if (!this.localStream) return;

    try {
      let pc = this.peers.get(payload.from);
      if (!pc) {
        pc = await this.createPeer(payload.from, false);
      }

      if (payload.type === "offer") {
        await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit("signal", {
          to: payload.from,
          type: "answer",
          data: answer,
        });
      } else if (payload.type === "answer") {
        await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
      } else if (payload.type === "ice-candidate") {
        if (payload.data) {
          await pc.addIceCandidate(payload.data as RTCIceCandidateInit);
        }
      }
    } catch (err) {
      console.error("signal error", err);
      this.onError("Voice connection failed with a peer.");
    }
  };

  private async createPeer(peerId: string, makeOffer: boolean) {
    if (this.peers.has(peerId)) return this.peers.get(peerId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(peerId, pc);

    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.socket.emit("signal", {
        to: peerId,
        type: "ice-candidate",
        data: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      let audio = this.remoteAudio.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        audio.dataset.peerId = peerId
        document.body.appendChild(audio);
        this.remoteAudio.set(peerId, audio);
      }
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    if (makeOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("signal", {
        to: peerId,
        type: "offer",
        data: offer,
      });
    }

    return pc;
  }
}
