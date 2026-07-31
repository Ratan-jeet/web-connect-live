import type { Member } from "../types";

type MemberListProps = {
  members: Member[];
  selfId: string;
};

export function MemberList({ members, selfId }: MemberListProps) {
  return (
    <aside className="members">
      <h2>In room</h2>
      <ul>
        {members.map((member) => (
          <li key={member.id} className={member.id === selfId ? "self" : undefined}>
            <span className="member-name">
              {member.name}
              {member.id === selfId ? " (you)" : ""}
            </span>
            <span className={`voice-dot ${member.inVoice ? "on" : ""}`} title={member.inVoice ? "In voice" : "Not in voice"} />
          </li>
        ))}
      </ul>
    </aside>
  );
}
