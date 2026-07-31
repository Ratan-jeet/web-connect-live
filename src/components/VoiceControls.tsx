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
  return (
    <div className="voice-bar">
      {!inVoice ? (
        <button className="btn primary" type="button" disabled={busy} onClick={onJoinVoice}>
          Join voice
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
  );
}
