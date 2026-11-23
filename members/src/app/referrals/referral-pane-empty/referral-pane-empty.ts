import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Right pane of the Referral inbox when no Referral is selected.
 * Hidden when the panes stack, so the list leads on narrow screens.
 */
@Component({
  selector: 'app-referral-pane-empty',
  template: `<p>Select a referral to see its details.</p>`,
  styles: `
    :host {
      display: block;
      background: var(--color-surface);
      border: 1px dashed var(--color-line-strong);
      border-radius: var(--border-radius-md);
      padding: var(--space-l);
      text-align: center;
    }

    p {
      color: var(--color-ink-soft);
      margin: 0;
    }

    @container referral-inbox (inline-size < 48rem) {
      :host {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralPaneEmpty {}
