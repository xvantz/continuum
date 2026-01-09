declare module '*.svelte' {
  import type { SvelteComponentTyped } from 'svelte';

  export default class Component<T = Record<string, never>> extends SvelteComponentTyped<T> {}
}
