import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Tag } from '../../../tag/tag';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { SERVICE_LABELS_LONG } from '../match-request.constants';
import { isValidDueDate, parseDueDate, type DueDate } from '../match-request.utilities';
import { AdminMatchRequestDetailService } from './admin-match-request-detail.service';

type ConfirmAction = 'mark-processed' | 'mark-pending';

interface DialogConfig {
  title: string;
  message: string;
  confirmText: string;
  variant: 'primary' | 'danger';
}

@Component({
  imports: [DatePipe, Tag, ConfirmDialog],
  templateUrl: './admin-match-request-detail.html',
  styleUrl: './admin-match-request-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMatchRequestDetailService], // Provide service at component level
})
export class AdminMatchRequestDetail {
  protected service = inject(AdminMatchRequestDetailService);

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

  // Check if requesting birth support
  protected isBirthSupport = computed(() => {
    const matchRequest = this.service.matchRequestResource.value();
    return matchRequest?.services.includes('birth-doula') ?? false;
  });

  constructor() {
    // Sync route id parameter to service signal
    effect(() => {
      this.service.idSignal.set(this.id());
    });
  }

  protected parseDueDate(dueDate: DueDate): Date | undefined {
    if (!isValidDueDate(dueDate)) {
      return undefined;
    }
    return parseDueDate(dueDate);
  }

  protected getServiceLabel(service: string): string {
    return SERVICE_LABELS_LONG[service] ?? service;
  }

  protected showMarkProcessedConfirm(): void {
    this.pendingAction.set('mark-processed');
    this.dialogConfig.set({
      title: 'Mark as Processed',
      message:
        'Are you sure you want to mark this match request as processed? This indicates that the request has been sent to doulas.',
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
        'Are you sure you want to mark this match request as pending? This indicates that the request has not yet been sent to doulas.',
      confirmText: 'Mark as Pending',
      variant: 'primary',
    });
    this.confirmDialog()?.showModal();
  }

  protected async onConfirmDialog(): Promise<void> {
    const action = this.pendingAction();
    if (!action) return;

    const matchRequest = this.service.matchRequestResource.value();
    if (!matchRequest) return;

    this.confirmDialog()?.close();
    this.pendingAction.set(undefined);

    switch (action) {
      case 'mark-processed': {
        await this.service.updateStatus(matchRequest.id, true);
        break;
      }
      case 'mark-pending': {
        await this.service.updateStatus(matchRequest.id, false);
        break;
      }
    }
  }

  protected onCancelDialog(): void {
    this.confirmDialog()?.close();
    this.pendingAction.set(undefined);
  }
}
