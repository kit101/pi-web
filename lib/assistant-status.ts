import type { AssistantMessage } from "./types";

export function getAssistantStatusText(
  stopReason?: string,
  errorMessage?: string,
  hasToolCalls = false,
): string | null {
  if (hasToolCalls) return null;

  if (stopReason === "error") {
    return `Error: ${errorMessage || "Unknown error"}`;
  }

  if (stopReason === "aborted") {
    return errorMessage && errorMessage !== "Request was aborted"
      ? errorMessage
      : "Operation aborted";
  }

  return null;
}

export function getAssistantMessageStatusText(
  message: AssistantMessage,
): string | null {
  return getAssistantStatusText(
    message.stopReason,
    message.errorMessage,
    message.content.some((block) => block.type === "toolCall"),
  );
}
