import { useEffect, useRef, useState } from "react";
import { Chat } from "./Chat";
import { ConfirmDialog } from "./ConfirmDialog";
import { MemberList } from "./MemberList";
import { VoiceControls } from "./VoiceControls";
import { getSocket } from "../lib/socket";
import { VoiceMesh } from "../lib/webrtc";
import type { ChatMessage, Member, Session } from "../types";

type RoomProps = {
  session: Session;
  initialMembers: Member[];
  onLeave: () => void;
};

export function Room({ session, initialMembers, onLeave }: RoomProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inVoice, setInVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const meshRef = useRef<VoiceMesh | null>(null);
  const inVoiceRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const onMembers = (next: Member[]) => setMembers(next);
    const onChat = (message: ChatMessage) => setMessages((prev) => [...prev, message]);
    const onVoiceState = ({ id, inVoice: peerInVoice }: { id: string; inVoice: boolean }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, inVoice: peerInVoice } : m)),
      );
      if (inVoiceRef.current && meshRef.current) {
        if (peerInVoice && id !== session.selfId) {
          void meshRef.current.addPeer(id);
        } else if (!peerInVoice) {
          meshRef.current.removePeer(id);
        }
      }
    };
    const onLeft = ({ id }: { id: string }) => {
      meshRef.current?.removePeer(id);
    };

    socket.on("members", onMembers);
    socket.on("chat-message", onChat);
    socket.on("voice-state", onVoiceState);
    socket.on("member-left", onLeft);

    return () => {
      socket.off("members", onMembers);
      socket.off("chat-message", onChat);
      socket.off("voice-state", onVoiceState);
      socket.off("member-left", onLeft);
      meshRef.current?.dispose();
      meshRef.current = null;
      inVoiceRef.current = false;
    };
  }, [session.selfId]);

  function sendMessage(text: string) {
    getSocket().emit("chat-message", { text });
  }

  async function joinVoice() {
    setVoiceBusy(true);
    setVoiceError(null);
    try {
      const socket = getSocket();
      const mesh = new VoiceMesh(socket, session.selfId, setVoiceError);
      meshRef.current = mesh;
      const peerIds = members
        .filter((m) => m.id !== session.selfId && m.inVoice)
        .map((m) => m.id);
      await mesh.join(peerIds);
      inVoiceRef.current = true;
      setInVoice(true);
      setMuted(false);
    } catch {
      meshRef.current?.dispose();
      meshRef.current = null;
    } finally {
      setVoiceBusy(false);
    }
  }

  function leaveVoice() {
    meshRef.current?.leave();
    meshRef.current?.dispose();
    meshRef.current = null;
    inVoiceRef.current = false;
    setInVoice(false);
    setMuted(false);
  }

  function toggleMute() {
    if (!meshRef.current) return;
    const next = !muted;
    meshRef.current.setMuted(next);
    setMuted(next);
  }

  function leaveRoom() {
    leaveVoice();
    getSocket().emit("leave-room");
    onLeave();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const voiceInCount = members.filter((m) => m.inVoice).length;

  return (
    <main className="room room-enter">
      <header className="room-header">
        <div>
          <button
            className="brand compact brand-button"
            type="button"
            onClick={() => setConfirmLeave(true)}
          >
            Web Connect Live
          </button>
          <h1>
            Room <span>{session.roomCode}</span>
            {session.isRandom ? <em className="room-tag">Random</em> : null}
          </h1>
          <p className="room-meta">
            {members.length} {members.length === 1 ? "person" : "people"}
            {voiceInCount > 0 ? ` · ${voiceInCount} in voice` : ""}
          </p>
        </div>
        <button className="btn ghost" type="button" onClick={copyCode}>
          {copied ? "Copied" : "Copy code"}
        </button>
      </header>

      {session.isRandom && members.length < 2 ? (
        <p className="waiting-banner waiting-banner-strong" role="status">
          Waiting for another person to join randomly…
        </p>
      ) : null}

      <div className="room-body">
        <MemberList members={members} selfId={session.selfId} />
        <Chat messages={messages} selfId={session.selfId} onSend={sendMessage} />
      </div>

      {voiceError ? <p className="form-error room-error">{voiceError}</p> : null}

      <VoiceControls
        inVoice={inVoice}
        muted={muted}
        busy={voiceBusy}
        onJoinVoice={joinVoice}
        onLeaveVoice={leaveVoice}
        onToggleMute={toggleMute}
        onLeaveRoom={leaveRoom}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this room?"
        message="You’ll leave chat and voice for this room and return to the home page."
        confirmLabel="Leave room"
        cancelLabel="Stay"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          leaveRoom();
        }}
      />
    </main>
  );
}
