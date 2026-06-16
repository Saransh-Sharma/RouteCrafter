// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ProjectConflictError } from "@/lib/db/projects";
import { errorResponse } from "./errors";

describe("errorResponse", () => {
  it("sanitizes unexpected server errors", async () => {
    const response = errorResponse(new Error("duplicate key value violates constraint"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The request could not be completed.",
    });
  });

  it("keeps typed conflict errors actionable", async () => {
    const response = errorResponse(
      new ProjectConflictError("Project has newer cloud changes."),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Project has newer cloud changes.",
    });
  });
});
