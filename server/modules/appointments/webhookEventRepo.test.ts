import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  getStripeWebhookEventById,
  insertStripeWebhookEvent,
  listStripeWebhookEventsForAppointment,
} from "./webhookEventRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildExecutor(rows: unknown[] = []) {
  const limit = vi.fn(async () => rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ limit, orderBy }));
  const values = vi.fn(async () => undefined);

  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
      insert: vi.fn(() => ({ values })),
      update: vi.fn(),
    },
    limit,
    values,
  };
}

describe("appointment webhook event repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the complete idempotency record", async () => {
    const { executor, values } = buildExecutor();

    await insertStripeWebhookEvent({
      eventId: "evt_101",
      type: "checkout.session.completed",
      provider: "stripe",
      stripeSessionId: "cs_101",
      appointmentId: 101,
      resourceType: "appointment",
      resourceId: 101,
      payloadHash: "hash_101",
      dbExecutor: executor as never,
    });

    expect(values).toHaveBeenCalledWith({
      eventId: "evt_101",
      type: "checkout.session.completed",
      provider: "stripe",
      stripeSessionId: "cs_101",
      appointmentId: 101,
      resourceType: "appointment",
      resourceId: 101,
      payloadHash: "hash_101",
    });
  });

  it("returns a stored webhook event by its id", async () => {
    const event = { eventId: "evt_102", provider: "paypal" };
    const { executor, limit } = buildExecutor([event]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(getStripeWebhookEventById("evt_102")).resolves.toEqual(event);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("keeps the appointment event limit and trims the session id", async () => {
    const events = [{ eventId: "evt_103" }];
    const { executor, limit } = buildExecutor(events);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(
      listStripeWebhookEventsForAppointment({
        appointmentId: 103,
        stripeSessionId: " cs_103 ",
        limit: 25,
      })
    ).resolves.toEqual(events);
    expect(limit).toHaveBeenCalledWith(25);
  });
});
