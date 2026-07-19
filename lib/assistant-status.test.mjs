import assert from "node:assert/strict";
import test from "node:test";
import { getAssistantStatusText } from "./assistant-status.ts";

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
