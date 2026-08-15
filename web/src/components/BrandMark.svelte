<script>
  // Size in CSS pixels of the square brand mark (the inner rocket art scales with it).
  let { size = 34 } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  role="img"
  aria-label="VPS CI/CD"
  class="brand-mark-svg"
>
  <defs>
    <linearGradient id="bm-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8B7CF7" />
      <stop offset="1" stop-color="#4F8CF5" />
    </linearGradient>
    <linearGradient id="bm-flame" x1="0" y1="44" x2="0" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFD166" />
      <stop offset="1" stop-color="#FF8FA3" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#bm-bg)" />
  <path
    d="M32 9.5c6.6 5 10 11.6 10 18.9 0 5-1.2 9.6-3.2 13.1H25.2c-2-3.5-3.2-8.1-3.2-13.1 0-7.3 3.4-13.9 10-18.9Z"
    fill="#ffffff"
  />
  <circle cx="32" cy="26" r="3.8" fill="#5B4CE0" />
  <circle cx="32" cy="26" r="3.8" fill="none" stroke="#ffffff" stroke-width="1.6" />
  <path d="M25.6 33.5 18.7 42c-.9 1.2-.2 2.9 1.3 2.9h5.6l-.4-8.6Z" fill="#ffffff" opacity=".92" />
  <path d="M38.4 33.5 45.3 42c.9 1.2.2 2.9-1.3 2.9h-5.6l.4-8.6Z" fill="#ffffff" opacity=".92" />
  <path d="M32 45.5c2.3 2.6 3 5.4 0 8.8-3-3.4-2.3-6.2 0-8.8Z" fill="url(#bm-flame)" />
  <circle cx="17.5" cy="20" r="1.7" fill="#ffffff" opacity=".85" />
  <circle cx="46.5" cy="17" r="1.3" fill="#ffffff" opacity=".6" />
  <circle cx="48" cy="28.5" r="1.7" fill="#ffffff" opacity=".85" />
</svg>

<style>
  .brand-mark-svg {
    display: block;
    flex: none;
  }
</style>
