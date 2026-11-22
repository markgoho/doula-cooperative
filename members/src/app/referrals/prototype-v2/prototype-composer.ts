// PROTOTYPE — throwaway. Outreach composer shared by all variants (placement differs per variant).
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  PROTO_MEMBER,
  PrototypeStore,
  defaultMessage,
  type PrototypeReferral,
} from './prototype-store';

@Component({
  selector: 'app-proto-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="composer" (submit)="send($event)">
      <label class="form__label" [for]="'msg-' + referral().id">
        Message to {{ referral().firstName }}
      </label>
      <textarea
        class="form__input form__input--textarea"
        [id]="'msg-' + referral().id"
        rows="10"
        [value]="message()"
        (input)="message.set($any($event.target).value)"
        [disabled]="sending()"
      ></textarea>
      <p class="hint">
        Sent from <strong>{{ member.name }} via Doula Cooperative</strong>. Replies go to
        {{ member.email }}; you get a BCC copy. You can reach out once per referral — after that,
        contact {{ referral().firstName }} directly.
      </p>
      @if (error()) {
        <p class="error" role="alert">
          Your message wasn't sent ({{ error() }}). Nothing was shared. Try again.
        </p>
      }
      <button class="button" type="submit" [disabled]="sending() || !message().trim()">
        {{ sending() ? 'Sending…' : 'Send Outreach' }}
      </button>
    </form>
  `,
  styles: `
    .composer {
      display: grid;
      gap: var(--space-xs);
    }
    textarea {
      font-size: var(--step--1);
      width: 100%;
    }
    .hint {
      color: var(--color-ink-soft);
      font-size: var(--step--2);
      margin: 0;
    }
    .error {
      background: var(--color-error-soft);
      border-radius: var(--border-radius-md);
      padding: var(--space-2xs) var(--space-xs);
      margin: 0;
    }
    button {
      justify-self: start;
    }
  `,
})
export class PrototypeComposer {
  private store = inject(PrototypeStore);
  referral = input.required<PrototypeReferral>();
  protected member = PROTO_MEMBER;
  protected message = linkedSignal(() => defaultMessage(this.referral()));
  protected sending = signal(false);
  protected error = signal('');

  protected async send(event: Event) {
    event.preventDefault();
    this.sending.set(true);
    this.error.set('');
    try {
      await this.store.sendOutreach(this.referral().id, this.message());
    } catch (error_) {
      this.error.set((error_ as Error).message);
    } finally {
      this.sending.set(false);
    }
  }
}
