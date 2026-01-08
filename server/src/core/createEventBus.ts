import { err, ok, Result, ResultAsync } from "neverthrow";
import type { BusArgs, BusDomain, BusEvent } from "./types/eventBus";

export type Unsub = () => void;

type AnyHandler = (...args: any[]) => void | Promise<void>;
type AnyReplyHandler = (...args: any[]) => any | Promise<any>;

export type BusError =
  | { type: "ReplierAlreadyRegistered"; key: string }
  | { type: "NoReplier"; key: string }
  | { type: "HandlerFailed"; key: string; cause: unknown };

export type EventBus = {
  publish<D extends BusDomain, E extends BusEvent<D>>(
    domain: D,
    event: E,
    ...args: BusArgs<D, E>
  ): void;

  sub<D extends BusDomain, E extends BusEvent<D>>(
    domain: D,
    event: E,
    handler: (...args: BusArgs<D, E>) => void | Promise<void>,
  ): Unsub;

  reply<D extends BusDomain, E extends BusEvent<D>, Res>(
    domain: D,
    event: E,
    handler: (...args: BusArgs<D, E>) => Res | Promise<Res>,
  ): Result<Unsub, BusError>;

  request<D extends BusDomain, E extends BusEvent<D>, Res>(
    domain: D,
    event: E,
    ...args: BusArgs<D, E>
  ): ResultAsync<Res, BusError>;
};

const keyOf = (domain: string, event: string) => `${domain}:${event}`;

export function createEventBus(opts?: {
  onHandlerError?: (info: { key: string; cause: unknown }) => void;
}): EventBus {
  const subs = new Map<string, Set<AnyHandler>>();
  const repliers = new Map<string, AnyReplyHandler>(); // 1 replier per key

  const sub: EventBus["sub"] = (domain, event, handler) => {
    const key = keyOf(domain, event);
    const set = subs.get(key) ?? new Set();
    set.add(handler as AnyHandler);
    subs.set(key, set);

    return () => {
      set.delete(handler as AnyHandler);
      if (set.size === 0) subs.delete(key);
    };
  };

  const publish: EventBus["publish"] = (domain, event, ...args) => {
    const key = keyOf(domain, event);
    const set = subs.get(key);
    if (!set || set.size === 0) return;

    for (const h of set) {
      void Promise.resolve()
        .then(() => h(...(args as readonly unknown[])))
        .catch((cause) => {
          opts?.onHandlerError?.({ key, cause });
        });
    }
  };

  const reply: EventBus["reply"] = (domain, event, handler) => {
    const key = keyOf(domain, event);

    if (repliers.has(key)) {
      return err<Unsub, BusError>({ type: "ReplierAlreadyRegistered", key });
    }

    repliers.set(key, handler as AnyReplyHandler);

    const unsub = () => {
      const cur = repliers.get(key);
      if (cur === (handler as AnyReplyHandler)) repliers.delete(key);
    };

    return ok(unsub);
  };

  const request: EventBus["request"] = (domain, event, ...args) => {
    const key = keyOf(domain, event);
    const handler = repliers.get(key);

    if (!handler) {
      return ResultAsync.fromSafePromise(Promise.resolve()).andThen(() =>
        err<never, BusError>({ type: "NoReplier", key }),
      );
    }

    return ResultAsync.fromPromise(
      Promise.resolve(handler(...(args as readonly unknown[]))),
      (cause): BusError => ({ type: "HandlerFailed", key, cause }),
    );
  };

  return { publish, sub, reply, request };
}
