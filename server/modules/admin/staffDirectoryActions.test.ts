import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  listAdminUsers: vi.fn(),
}));

import * as repo from "./repo";
import { listAssignableStaff } from "./staffDirectoryActions";

describe("admin staff directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized admin and operations staff only", async () => {
    vi.mocked(repo.listAdminUsers).mockResolvedValue([
      {
        id: 1,
        email: " ADMIN@EXAMPLE.COM ",
        name: "Admin",
        role: "admin",
      },
      { id: 2, email: null, name: null, role: "ops" },
      { id: 3, email: "free@example.com", name: "Free", role: "free" },
    ] as never);

    await expect(listAssignableStaff()).resolves.toEqual([
      {
        id: 1,
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
      },
      { id: 2, email: null, name: null, role: "ops" },
    ]);
    expect(repo.listAdminUsers).toHaveBeenCalledWith({ limit: 100 });
  });
});
