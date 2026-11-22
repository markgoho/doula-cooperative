// PROTOTYPE — throwaway. Floating variant switcher (← / → keys, updates ?variant=).
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-prototype-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="bar" aria-label="Prototype variant switcher">
      <button type="button" (click)="step(-1)" aria-label="Previous variant">←</button>
      <span>PROTOTYPE · {{ current() }} ({{ variants()[current()] }})</span>
      <button type="button" (click)="step(1)" aria-label="Next variant">→</button>
    </div>
  `,
  styles: `
    .bar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px;
      border-radius: 999px;
      background: #111;
      color: #fff;
      font:
        600 13px/1 system-ui,
        sans-serif;
      box-shadow: 0 6px 20px rgb(0 0 0 / 0.35);
    }
    button {
      background: #333;
      color: #fff;
      border: 0;
      border-radius: 999px;
      width: 28px;
      height: 28px;
      cursor: pointer;
    }
  `,
})
export class PrototypeSwitcher {
  private router = inject(Router);
  /** Variant key → human name. */
  variants = input.required<Record<string, string>>();
  current = input.required<string>();
  private keys = computed(() => Object.keys(this.variants()));

  protected step(delta: number) {
    const keys = this.keys();
    const next = keys[(keys.indexOf(this.current()) + delta + keys.length) % keys.length];
    void this.router.navigate([], { queryParams: { variant: next }, queryParamsHandling: 'merge' });
  }

  protected onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') this.step(-1);
    else if (event.key === 'ArrowRight') this.step(1);
  }
}
