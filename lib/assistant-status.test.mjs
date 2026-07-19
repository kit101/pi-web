import assert from "node:assert/strict";
import test from "node:test";
import {
  getAssistantMessageStatusText,
  getAssistantStatusText,
} from "./assistant-status.ts";

test("显示模型返回的具体错误", () => {
  assert.equal(
    getAssistantStatusText("error", "400 Invalid request", false),
    "Error: 400 Invalid request",
  );
});

test("错误信息缺失时使用 TUI fallback", () => {
  assert.equal(
    getAssistantStatusText("error", undefined, false),
    "Error: Unknown error",
  );
});

test("中止请求使用默认或具体信息", () => {
  assert.equal(
    getAssistantStatusText("aborted", "Request was aborted", false),
    "Operation aborted",
  );
  assert.equal(
    getAssistantStatusText("aborted", "Connection closed", false),
    "Connection closed",
  );
});

test("含工具调用时不重复显示结束状态", () => {
  assert.equal(
    getAssistantStatusText("error", "Tool failed", true),
    null,
  );
});

test("正常完成时不显示结束状态", () => {
  assert.equal(getAssistantStatusText("stop", undefined, false), null);
});

test("从 assistant 消息推导状态并避免重复工具错误", () => {
  assert.equal(
    getAssistantMessageStatusText({
      role: "assistant",
      content: [{ type: "text", text: "" }],
      model: "test-model",
      provider: "test-provider",
      stopReason: "error",
      errorMessage: "429 Too Many Requests",
    }),
    "Error: 429 Too Many Requests",
  );

  assert.equal(
    getAssistantMessageStatusText({
      role: "assistant",
      content: [{ type: "toolCall", toolCallId: "call-1", toolName: "read", input: {} }],
      model: "test-model",
      provider: "test-provider",
      stopReason: "error",
      errorMessage: "Tool failed",
    }),
    null,
  );
});
