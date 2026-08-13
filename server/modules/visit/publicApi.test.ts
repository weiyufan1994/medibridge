import { describe, expect, it, vi } from "vitest";

vi.mock("./guestAssetRepo", () => ({
  reassignVisitAssetsFromGuest: vi.fn(),
}));

vi.mock("./repo", () => ({
  createMessage: vi.fn(),
  getPatientSession: vi.fn(),
  getRecentMessages: vi.fn(),
  upsertPatientSession: vi.fn(),
}));

import * as guestAssetRepo from "./guestAssetRepo";
import {
  visitAdminApi,
  visitAutomationApi,
  visitChatSessionApi,
  visitGuestAssetApi,
  visitMedicalSummaryApi,
} from "./publicApi";
import * as repo from "./repo";

describe("visit public API", () => {
  it("exposes only the guest asset workflow dependency", () => {
    expect(visitGuestAssetApi.reassignVisitAssetsFromGuest).toBe(
      guestAssetRepo.reassignVisitAssetsFromGuest
    );
    expect(Object.keys(visitGuestAssetApi)).toEqual([
      "reassignVisitAssetsFromGuest",
    ]);
  });

  it("exposes the owned repository functions for each consumer", () => {
    expect(visitMedicalSummaryApi.getRecentMessages).toBe(
      repo.getRecentMessages
    );
    expect(visitAutomationApi.createMessage).toBe(repo.createMessage);
    expect(visitChatSessionApi.getSession).toBe(repo.getPatientSession);
    expect(visitChatSessionApi.upsertSession).toBe(repo.upsertPatientSession);
    expect(visitAdminApi.getRecentMessages).toBe(repo.getRecentMessages);

    expect(Object.keys(visitMedicalSummaryApi)).toEqual(["getRecentMessages"]);
    expect(Object.keys(visitAutomationApi)).toEqual(["createMessage"]);
    expect(Object.keys(visitChatSessionApi).sort()).toEqual([
      "getSession",
      "upsertSession",
    ]);
    expect(Object.keys(visitAdminApi)).toEqual(["getRecentMessages"]);
  });
});
