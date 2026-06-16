import "server-only";

import { NextResponse } from "next/server";
import { BlobConfigurationError } from "@/lib/blob";
import { DatabaseConfigurationError } from "@/lib/db";
import {
  ProjectConflictError,
  ProjectNotFoundError,
  ProjectRevisionRequiredError,
} from "@/lib/db/projects";

export function errorResponse(error: unknown): NextResponse {
  if (
    error instanceof ProjectConflictError ||
    error instanceof ProjectRevisionRequiredError
  ) {
    return NextResponse.json(
      { error: error.message || "Project has newer cloud changes." },
      { status: 409 },
    );
  }
  if (error instanceof ProjectNotFoundError) {
    return NextResponse.json(
      { error: error.message || "Project not found." },
      { status: 404 },
    );
  }
  if (
    error instanceof DatabaseConfigurationError ||
    error instanceof BlobConfigurationError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      error: "The request could not be completed.",
    },
    { status: 500 },
  );
}
