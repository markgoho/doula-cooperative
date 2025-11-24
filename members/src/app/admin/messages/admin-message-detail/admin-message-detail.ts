import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Tag } from '../../../tag/tag';
import { AdminMessageDetailService } from './admin-message-detail.service';

type ConfirmAction = 'mark-processed' | 'mark-pending';

@Component({
  imports: [DatePipe, Tag],
  templateUrl: './admin-message-detail.html',
  styleUrl: './admin-message-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMessageDetailService], // Provide service at component level
})
export class AdminMessageDetail {
  protected service = inject(AdminMessageDetailService);

  // Route parameter binding (enabled via withComponentInputBinding)
  id = input.required<string>();

  // Component-specific UI state
  protected confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);

  constructor() {
    // Sync route id parameter to service signal
    effect(() => {
      this.service.idSignal.set(this.id());
    });
  }

  protected showMarkProcessedConfirm(): void {
    this.pendingAction.set('mark-processed');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected showMarkPendingConfirm(): void {
    this.pendingAction.set('mark-pending');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected async confirmAction(): Promise<void> {
    const action = this.pendingAction();
    if (!action) return;

    const message = this.service.messageResource.value();
    if (!message) return;

    switch (action) {
      case 'mark-processed': {
        await this.service.updateStatus(message.id, true);
        break;
      }
      case 'mark-pending': {
        await this.service.updateStatus(message.id, false);
        break;
      }
    }

    this.confirmDialog()?.nativeElement.close();
    this.pendingAction.set(undefined);
  }

  protected cancelAction(): void {
    this.confirmDialog()?.nativeElement.close();
    this.pendingAction.set(undefined);
  }

  protected getActionTitle(): string {
    const action = this.pendingAction();
    if (!action) return '';

    return action === 'mark-processed' ? 'Mark as Processed' : 'Mark as Pending';
  }

  protected getActionMessage(): string {
    const action = this.pendingAction();
    if (!action) return '';

    return action === 'mark-processed'
      ? 'Are you sure you want to mark this message as processed? This indicates that the message has been handled.'
      : 'Are you sure you want to mark this message as pending? This indicates that the message has not yet been handled.';
  }
}
