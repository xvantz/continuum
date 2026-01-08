export type GreetingSource = "http" | "events" | "internal";

export type GreetingStats = {
  totals: Record<GreetingSource, number>;
  total: number;
};

export type GreetingPayload = {
  name: string;
  message: string;
  source: GreetingSource;
  total: number;
};

export type GreetingTimelineEntry = GreetingPayload & { at: string };
