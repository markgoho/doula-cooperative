import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReferralsService } from '../../services/referrals.service';
import { buildOutreachTemplate } from '../build-outreach-template';
import type { OutreachSender, ReferralDetail, SentOutreach } from '../referral.types';

/** Longest message the API accepts. */
const MESSAGE_MAX_LENGTH = 5000;

/**
 * Inline Outreach composer: an editable, pre-filled message and a send button.
 * You can send one Outreach per Referral. If the send fails, nothing is shared
 * and your message stays here to retry.
 */
@Component({
  selector: 'app-referral-outreach-composer',
  templateUrl: './referral-outreach-composer.html',
  styleUrl: './referral-outreach-composer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralOutreachComposer {
  private referralsService = inject(ReferralsService);

  referral = input.required<ReferralDetail>();
  sender = input.required<OutreachSender>();

  /** Emits once the Outreach email was accepted. */
  sent = output<SentOutreach>();

  private textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly maxLength = MESSAGE_MAX_LENGTH;
  protected message = linkedSignal(() => buildOutreachTemplate(this.referral(), this.sender()));
  protected sending = signal(false);
  protected isMessageMissing = signal(false);
  protected sendError = signal('');

  protected recipientName = computed(() => this.referral().firstName || 'the requester');
  protected fromLabel = computed(() => {
    const name = this.sender().name;
    return name ? `${name} via Doula Cooperative` : 'Doula Cooperative';
  });

  protected updateMessage(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
    if (this.message().trim()) this.isMessageMissing.set(false);
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.sending()) return;

    if (!this.message().trim()) {
      this.isMessageMissing.set(true);
      this.textarea()?.nativeElement.focus();
      return;
    }

    this.sending.set(true);
    this.sendError.set('');
    try {
      const result = await this.referralsService.sendOutreach(this.referral().id, this.message());
      this.sent.emit(result);
    } catch (error: unknown) {
      this.sendError.set(
        error instanceof Error ? error.message : "Your message wasn't sent. Please try again.",
      );
    } finally {
      this.sending.set(false);
    }
  }
}
