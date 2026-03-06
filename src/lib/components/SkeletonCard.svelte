<script lang="ts">
  export let index: number = 0;
</script>

<div class="skeleton-card" style="animation-delay: {index * 100}ms">
  <div class="p-5">
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="skeleton h-5 w-3/4 rounded"></div>
      <div class="skeleton h-5 w-16 rounded-full"></div>
    </div>
    <div class="skeleton h-4 w-full rounded mb-2"></div>
    <div class="skeleton h-4 w-2/3 rounded mb-4"></div>
    <div class="flex gap-1.5 mb-4">
      <div class="skeleton h-5 w-14 rounded-md"></div>
      <div class="skeleton h-5 w-16 rounded-md"></div>
      <div class="skeleton h-5 w-12 rounded-md"></div>
    </div>
    <div class="border-t border-border/60 pt-3 flex gap-4">
      <div class="skeleton h-4 w-20 rounded"></div>
      <div class="skeleton h-4 w-24 rounded"></div>
    </div>
  </div>
</div>

<style lang="postcss">
  .skeleton-card {
    @apply rounded-xl border overflow-hidden;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
    animation: fadeSlideIn 0.5s ease forwards;
    opacity: 0;
  }
</style>
