import type { AssistantContentBlock, AssistantMessage, ThinkingContent, ToolCallContent } from "./types";
import { getAssistantMessageStatusText } from "./assistant-status";

interface DisplayOptions {
  isStreaming?: boolean;
}

export function isEmptyThinkingBlock(block: AssistantContentBlock, options: DisplayOptions = {}): block is ThinkingContent {
  return block.type === "thinking" && !block.deferred && !options.isStreaming && block.thinking.trim() === "";
}

export function getDisplayableAssistantBlocks(
  message: AssistantMessage,
  options: DisplayOptions = {},
): AssistantContentBlock[] {
  return (message.content ?? []).filter((block) => !isEmptyThinkingBlock(block, options));
}

function isFinalAnswerBlock(block: AssistantContentBlock): boolean {
  return block.type === "text" || block.type === "image";
}

export function splitFinalAssistantBlocks(
  message: AssistantMessage,
  options: DisplayOptions = {},
): { answerBlocks: AssistantContentBlock[]; processBlocks: AssistantContentBlock[] } {
  const blocks = getDisplayableAssistantBlocks(message, options);
  const lastProcessIndex = blocks.findLastIndex((block) => !isFinalAnswerBlock(block));
  if (lastProcessIndex === -1) {
    return { answerBlocks: blocks, processBlocks: [] };
  }
  return {
    answerBlocks: blocks.slice(lastProcessIndex + 1),
    processBlocks: blocks.slice(0, lastProcessIndex + 1),
  };
}

export function splitFinalAssistantMessage(
  message: AssistantMessage,
  options: DisplayOptions = {},
): { answerMessage: AssistantMessage | null; processMessage: AssistantMessage | null } {
  const { answerBlocks, processBlocks } = splitFinalAssistantBlocks(message, options);
  return {
    answerMessage: answerBlocks.length > 0 || getAssistantMessageStatusText(message)
      ? { ...message, content: answerBlocks }
      : null,
    processMessage: processBlocks.length > 0
      ? {
          ...message,
          content: processBlocks,
          usage: undefined,
          stopReason: undefined,
          errorMessage: undefined,
        }
      : null,
  };
}

export function countToolCallBlocks(blocks: AssistantContentBlock[]): number {
  return blocks.filter((block): block is ToolCallContent => block.type === "toolCall").length;
}
