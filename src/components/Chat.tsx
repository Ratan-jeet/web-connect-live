import { useEffect, useRef, type FormEvent } from "react";
import type { ChatMessage } from "../types";

type ChatProps = {
  messages: ChatMessage[];
  selfId: string;
  onSend: (text: string) => void;
};

export function Chat({ messages, selfId, onSend }: ChatProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    if (!text) return;
    onSend(text);
    form.reset();
  }

  return (
    <section className="chat">
      <div className="chat-log">
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say hello.</p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`chat-bubble ${message.senderId === selfId ? "mine" : ""}`}
            >
              <header>
                <strong>{message.senderName}</strong>
                <time>
                  {new Date(message.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </header>
              <p>{message.text}</p>
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-compose" onSubmit={handleSubmit}>
        <input name="text" placeholder="Message the room…" maxLength={500} autoComplete="off" />
        <button className="btn primary" type="submit">
          Send
        </button>
      </form>
    </section>
  );
}
