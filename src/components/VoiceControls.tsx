type VoiceControlsProps = {
  inVoice: boolean;
  muted: boolean;
  busy: boolean;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onLeaveRoom: () => void;
};

export function VoiceControls({
  inVoice,
  muted,
  busy,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onLeaveRoom,
}: VoiceControlsProps) {
  const statusLabel = !inVoice ? "Not in voice" : muted ? "Muted" : "Live";
  const statusClass = !inVoice ? "idle" : muted ? "muted" : "live";

  return (
    <div className="voice-bar">
      <div className={`voice-state ${statusClass}`} aria-live="polite">
        <span className="voice-state-dot" aria-hidden="true" />
        <span>{statusLabel}</span>
      </div>

      <div className="voice-actions">
        {!inVoice ? (
          <button className="btn primary" type="button" disabled={busy} onClick={onJoinVoice}>
            {busy ? "Connecting…" : "Join voice"}
          </button>
        ) : (
          <>
            <button className="btn ghost" type="button" onClick={onToggleMute}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button className="btn danger" type="button" onClick={onLeaveVoice}>
              Leave voice
            </button>
          </>
        )}
        <button className="btn ghost" type="button" onClick={onLeaveRoom}>
          Leave room
        </button>
      </div>
    </div>
  );
}
