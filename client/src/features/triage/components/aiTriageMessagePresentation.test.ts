import { describe, expect, it } from "vitest";
import {
  getAssistantMessageSignature,
  getMessageContainerClass,
  getTriageResultContainerClass,
  resolveAnimatedAssistantSignature,
  type TriageDisplayMessage,
} from "@/features/triage/components/aiTriageMessagePresentation";

describe("aiTriageMessagePresentation", () => {
  it("renders user container as content-fit instead of full width", () => {
    const className = getMessageContainerClass("user");

    expect(className).toContain("w-fit");
    expect(className).not.toContain("w-full");
  });

  it("renders assistant container as content-fit instead of full width", () => {
    const className = getMessageContainerClass("assistant");

    expect(className).toContain("w-fit");
    expect(className).not.toContain("w-full");
  });

  it("does not animate assistant messages restored from cache", () => {
    const previousMessages: TriageDisplayMessage[] = [
      { role: "assistant", content: "您好，我是分诊护士。" },
    ];
    const restoredMessages: TriageDisplayMessage[] = [
      { role: "assistant", content: "您好，我是分诊护士。" },
      { role: "user", content: "我头疼" },
      { role: "assistant", content: "请描述多久了？" },
    ];

    const signature = resolveAnimatedAssistantSignature({
      previousMessages,
      nextMessages: restoredMessages,
      isHistoryReadOnly: false,
    });

    expect(signature).toBeNull();
  });

  it("animates only the newly appended assistant reply", () => {
    const previousMessages: TriageDisplayMessage[] = [
      { role: "assistant", content: "您好，我是分诊护士。" },
      { role: "user", content: "我头疼" },
    ];
    const nextMessages: TriageDisplayMessage[] = [
      ...previousMessages,
      { role: "assistant", content: "请描述多久了？" },
    ];

    const signature = resolveAnimatedAssistantSignature({
      previousMessages,
      nextMessages,
      isHistoryReadOnly: false,
    });

    expect(signature).toBe(getAssistantMessageSignature(nextMessages[2], 2));
  });

  it("centers triage result container", () => {
    expect(getTriageResultContainerClass()).toContain("justify-center");
    expect(getTriageResultContainerClass()).not.toContain("justify-start");
  });
});
