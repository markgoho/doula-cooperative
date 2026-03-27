import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal, viewChild } from '@angular/core';
import { Tag } from '../../../tag/tag';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { AdminMessageDetailService } from './admin-message-detail.service';

type ConfirmAction = 'mark-processed' | 'mark-pending';

interface DialogConfig {
  title: string;
  message: string;
  confirmText: string;
  variant: 'primary' | 'danger';
}

@Component({
  imports: [DatePipe, Tag, ConfirmDialog, AlertBanner],
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
  protected confirmDialog = viewChild(ConfirmDialog);
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);
  protected dialogConfig = signal<DialogConfig>({
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'primary',
  });

  constructor() {
    this.service.init(this.id);
  }

  protected showMarkProcessedConfirm(): void {
    this.pendingAction.set('mark-processed');
    this.dialogConfig.set({
      title: 'Mark as Processed',
      message:
        'Are you sure you want to mark this message as processed? This indicates that the message has been handled.',
      confirmText: 'Mark as Processed',
      variant: 'primary',
    });
    this.confirmDialog()?.showModal();
  }

  protected showMarkPendingConfirm(): void {
    this.pendingAction.set('mark-pending');
    this.dialogConfig.set({
      title: 'Mark as Pending',
      message:
        'Are you sure you want to mark this message as pending? This indicates that the message has not yet been handled.',
      confirmText: 'Mark as Pending',
      variant: 'primary',
    });
    this.confirmDialog()?.showModal();
  }

  protected async onConfirmDialog(): Promise<void> {
    const action = this.pendingAction();
    if (!action) return;

    const message = this.service.messageResource.value();
    if (!message) return;

    try {
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
    } finally {
      this.confirmDialog()?.close();
      this.pendingAction.set(undefined);
    }
  }

  protected onCancelDialog(): void {
    this.confirmDialog()?.close();
    this.pendingAction.set(undefined);
  }
}
