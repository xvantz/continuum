<script lang="ts">
  const title = 'threejsCosmos';
  const subtitle = 'Svelte 5 + WebGPU-ready Three.js playground';

  let count = $state(0);
  const rotation = $derived(count * 2);

  const links = [
    { label: 'Svelte 5 guide', href: 'https://svelte.dev/docs/introduction' },
    { label: 'Three.js docs', href: 'https://threejs.org/docs/' },
    { label: 'Tailwind CSS', href: 'https://tailwindcss.com/docs' }
  ];

  function increment() {
    count += 1;
  }
</script>

<main class="min-h-screen bg-space-dark text-slate-100">
  <section class="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
    <div>
      <p class="text-sm font-semibold uppercase tracking-wide text-emerald-300">Bootstrapped</p>
      <h1 class="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
      <p class="mt-4 text-lg text-slate-300">{subtitle}</p>
    </div>

    <div class="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-emerald-500/20 backdrop-blur">
      <p class="text-sm uppercase tracking-widest text-emerald-200">Svelte 5 runes demo</p>
      <div class="flex flex-wrap items-center gap-4">
        <button class="rounded-full bg-emerald-400 px-6 py-2 text-base font-semibold text-slate-950 transition hover:bg-emerald-300" onclick={increment}>
          Increment
        </button>
        <p class="text-lg text-emerald-100" aria-live="polite">
          Count: {count} · Rotation hint: {rotation}°
        </p>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      {#each links as link}
        <a
          class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:bg-emerald-400/10"
          href={link.href}
          target="_blank"
          rel="noreferrer"
        >
          {link.label}
        </a>
      {/each}
    </div>
  </section>
</main>
