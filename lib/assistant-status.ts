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
