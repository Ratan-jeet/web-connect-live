import { useEffect, useState } from "react";
import { Lobby } from "./components/Lobby";
import { Room } from "./components/Room";
import { getSocket } from "./lib/socket";
import type { Member, Session } from "./types";

type WaitingRandom = {
  name: string;
  roomCode: string;
  members: Member[];
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingRandom, setWaitingRandom] = useState<WaitingRandom | null>(null);

  async function ensureConnected() {
    const socket = getSocket();
    if (socket.connected) return true;

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 5000);

      const onConnect = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      };

      socket.on("connect", onConnect);
      socket.on("connect_error", onError);
      socket.connect();
    });
  }

  function enterRoom(
    name: string,
    roomCode: string,
    nextMembers: Member[],
    isRandom: boolean,
  ) {
    const socket = getSocket();
    setMembers(nextMembers);
    setSession({
      name,
      roomCode,
      selfId: socket.id!,
      isRandom,
    });
    setWaitingRandom(null);
    setError(null);
    setBusy(false);
  }

  useEffect(() => {
    if (!waitingRandom) return;

    const socket = getSocket();

    const tryEnter = (nextMembers: Member[], roomCode: string) => {
      if (nextMembers.length < 2) return;
      enterRoom(waitingRandom.name, roomCode, nextMembers, true);
    };

    const onMembers = (next: Member[]) => {
      tryEnter(next, waitingRandom.roomCode);
    };

    const onMatched = (payload: { roomCode: string; members: Member[] }) => {
      tryEnter(payload.members, payload.roomCode);
    };

    socket.on("members", onMembers);
    socket.on("random-matched", onMatched);

    return () => {
      socket.off("members", onMembers);
      socket.off("random-matched", onMatched);
    };
  }, [waitingRandom]);

  async function handleJoin(name: string, roomCode: string) {
    setBusy(true);
    setError(null);

    const connected = await ensureConnected();
    if (!connected) {
      setError("Could not reach the server. Is it running?");
      setBusy(false);
      return;
    }

    const socket = getSocket();
    socket.emit("join-room", { name, roomCode }, (result) => {
      if (!result.ok || !result.roomCode) {
        setError(result.error ?? "Could not join room.");
        setBusy(false);
        return;
      }

      enterRoom(name, result.roomCode, result.members ?? [], Boolean(result.isRandom));
    });
  }

  async function handleJoinRandom(name: string) {
    setBusy(true);
    setError(null);

    const connected = await ensureConnected();
    if (!connected) {
      setError("Could not reach the server. Is it running?");
      setBusy(false);
      return;
    }

    const socket = getSocket();
    socket.emit("join-random", { name }, (result) => {
      if (!result.ok || !result.roomCode) {
        setError(result.error ?? "Could not join a random room.");
        setBusy(false);
        return;
      }

      const nextMembers = result.members ?? [];

      if (result.waiting || nextMembers.length < 2) {
        setWaitingRandom({
          name,
          roomCode: result.roomCode,
          members: nextMembers,
        });
        setBusy(false);
        return;
      }

      enterRoom(name, result.roomCode, nextMembers, true);
    });
  }

  function handleCancelWaiting() {
    getSocket().emit("leave-room");
    setWaitingRandom(null);
    setError(null);
    setBusy(false);
  }

  function handleLeave() {
    setSession(null);
    setMembers([]);
    setError(null);
    setWaitingRandom(null);
  }

  if (!session) {
    return (
      <Lobby
        onJoin={handleJoin}
        onJoinRandom={handleJoinRandom}
        onCancelWaiting={handleCancelWaiting}
        busy={busy}
        error={error}
        waiting={waitingRandom !== null}
      />
    );
  }

  return <Room session={session} initialMembers={members} onLeave={handleLeave} />;
}
