import { err, ok, type Result } from "neverthrow";
import { type z } from "zod";

/**
 * Turns a Zod schema into a neverthrow parser helper. Consumers use this to
 * validate incoming payloads without ever throwing.
 */
export const makeParser = <Schema extends z.ZodTypeAny>(schema: Schema) => {
  return (
    data: unknown,
  ): Result<z.infer<Schema>, z.ZodError<z.infer<Schema>>> => {
    const parsed = schema.safeParse(data);
    return parsed.success ? ok(parsed.data) : err(parsed.error);
  };
};
