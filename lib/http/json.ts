import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Parses and validates a JSON body; returns [data, null] or [null, errorResponse]. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<[T, null] | [null, NextResponse]> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return [null, jsonError(400, "INVALID_JSON")];
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return [null, jsonError(400, "INVALID_INPUT")];
  return [parsed.data, null];
}
