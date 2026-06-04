import { z } from "zod";

const ReplaySessionKind = z.enum(["HTTP", "WS"]);

export type ReplaySessionKind = z.infer<typeof ReplaySessionKind>;

const ConnectionInfo = z.object({
  host: z.string(),
  port: z.number(),
  isTLS: z.boolean(),
  SNI: z.string().nullish(),
});

export type ConnectionInfo = z.infer<typeof ConnectionInfo>;

export const ReplaySchema = z.object({
  session: z.object({
    id: z.string(),
    name: z.string(),
    kind: ReplaySessionKind.nullish(),
  }),
  entry: z.object({
    raw: z.string(),
    connection: ConnectionInfo,
  }),
});

export type Replay = z.infer<typeof ReplaySchema>;
