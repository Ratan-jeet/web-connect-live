import { useState, type FormEvent } from "react";

type LobbyProps = {
  onJoin: (name: string, roomCode: string) => Promise<void>;
  onJoinRandom: (name: string) => Promise<void>;
  onCancelWaiting: () => void;
  busy: boolean;
  error: string | null;
  waiting: boolean;
};

function randomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function Lobby({
  onJoin,
  onJoinRandom,
  onCancelWaiting,
  busy,
  error,
  waiting,
}: LobbyProps) {
  const [name, setName] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("name") ?? "").trim();
    const roomCode = String(form.get("roomCode") ?? "").trim().toUpperCase();
    await onJoin(displayName, roomCode);
  }

  async function handleRandom() {
    const displayName = name.trim();
    if (!displayName) return;
    await onJoinRandom(displayName);
  }

  return (
    <main className="lobby">
      <div className="lobby-glow" aria-hidden="true" />
      <div className="lobby-grid" aria-hidden="true" />

      <section className="lobby-panel">
        <p className="brand">Web Connect</p>
        <h1 className="lobby-headline">Talk with your group, instantly.</h1>
        <p className="lobby-sub">
          Create a room code, share it, and chat or hop on voice — up to 8 people.
        </p>

        {waiting ? (
          <div className="waiting-panel" role="status" aria-live="polite">
            <div className="waiting-spinner" aria-hidden="true" />
            <p className="waiting-title">Looking for a random room…</p>
            <p className="waiting-copy">
              No one else is waiting right now. Hang tight until another person also joins
              randomly.
            </p>
            <button className="btn ghost" type="button" onClick={onCancelWaiting}>
              Cancel
            </button>
          </div>
        ) : (
          <form className="lobby-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Display name</span>
              <input
                name="name"
                autoComplete="nickname"
                placeholder="Alex"
                maxLength={24}
                required
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Room code</span>
              <div className="room-row">
                <input
                  name="roomCode"
                  id="roomCode"
                  autoComplete="off"
                  placeholder="ABC123"
                  minLength={4}
                  maxLength={8}
                  required
                  disabled={busy}
                  defaultValue=""
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "");
                  }}
                />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => {
                    const input = document.getElementById("roomCode") as HTMLInputElement | null;
                    if (input) input.value = randomRoomCode();
                  }}
                >
                  New code
                </button>
              </div>
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="btn primary" type="submit" disabled={busy || !name.trim()}>
              {busy ? "Joining…" : "Join room"}
            </button>

            <div className="lobby-divider" role="separator">
              <span>or</span>
            </div>

            <button
              className="btn secondary"
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void handleRandom()}
            >
              Join random room
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
