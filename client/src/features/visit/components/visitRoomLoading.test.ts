import { describe, expect, it } from "vitest";
import { shouldShowVisitRoomLoadingState } from "@/features/visit/components/visitRoomLoading";

describe("shouldShowVisitRoomLoadingState", () => {
  it("shows loading only for first load without appointment data", () => {
    expect(
      shouldShowVisitRoomLoadingState({
        isLoading: true,
        hasAppointmentData: false,
      })
    ).toBe(true);
  });

  it("does not block screen when refetching language variant with existing data", () => {
    expect(
      shouldShowVisitRoomLoadingState({
        isLoading: true,
        hasAppointmentData: true,
      })
    ).toBe(false);
  });
});
