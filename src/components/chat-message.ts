import type { ChatMessage } from "../types";

export function renderChatMessage(message: ChatMessage): string {
  const className = message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble chat-bubble--assistant";

  return `
    <div class="${className}">
      <span class="chat-bubble__role">${message.role === "user" ? "Ban" : "AI"}</span>
      <p>${message.content}</p>
    </div>
  `;
}