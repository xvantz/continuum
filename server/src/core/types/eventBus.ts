declare global {
  interface BusEvents {}
}

type DomainKeys = keyof BusEvents;
type FallbackEvents = Record<string, BusArgsTuple>;
type EventsFor<D extends BusDomain> = [DomainKeys] extends [never]
  ? FallbackEvents
  : D extends DomainKeys
    ? BusEvents[D]
    : FallbackEvents;

export type BusArgsTuple = readonly unknown[];

export type BusDomain = [DomainKeys] extends [never]
  ? string
  : DomainKeys & string;

export type BusEvent<D extends BusDomain> = [keyof EventsFor<D>] extends [never]
  ? string
  : keyof EventsFor<D> & string;

export type BusArgs<
  D extends BusDomain,
  E extends BusEvent<D>,
> = EventsFor<D>[E & keyof EventsFor<D>] extends BusArgsTuple
  ? EventsFor<D>[E & keyof EventsFor<D>]
  : BusArgsTuple;
