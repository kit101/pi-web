import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextSendShortcut,
  parseSendShortcut,
  shouldSendOnEnter,
} from "./useSendShortcut.ts";

test("mod-enter-send 仅使用修饰键发送", () => {
  assert.equal(shouldSendOnEnter("mod-enter-send", true, false), true);
  assert.equal(shouldSendOnEnter("mod-enter-send", false, false), false);
  assert.equal(shouldSendOnEnter("mod-enter-send", true, true), false);
});

test("enter-send 仅使用无修饰 Enter 发送", () => {
  assert.equal(shouldSendOnEnter("enter-send", false, false), true);
  assert.equal(shouldSendOnEnter("enter-send", true, false), false);
  assert.equal(shouldSendOnEnter("enter-send", false, true), false);
});

test("快捷键按钮在两种模式间切换", () => {
  assert.equal(getNextSendShortcut("mod-enter-send"), "enter-send");
  assert.equal(getNextSendShortcut("enter-send"), "mod-enter-send");
});

test("损坏的持久化值回退到默认快捷键", () => {
  assert.equal(parseSendShortcut("enter-send"), "enter-send");
  assert.equal(parseSendShortcut("mod-enter-send"), "mod-enter-send");
  assert.equal(parseSendShortcut("legacy-value"), "mod-enter-send");
  assert.equal(parseSendShortcut(null), "mod-enter-send");
});
