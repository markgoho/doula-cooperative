import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Tag } from '../../../tag/tag';
import { SERVICE_LABELS_LONG } from '../match-request.constants';
import { isValidDueDate, parseDueDate, type DueDate } from '../match-request.utilities';
import { AdminMatchRequestDetailService } from './admin-match-request-detail.service';

type ConfirmAction = 'mark-processed' | 'mark-pending';

@Component({
  imports: [DatePipe, Tag],
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
  protected confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);

  // Check if requesting birth support
  protected isBirthSupport = computed(() => {
    const matchRequest = this.service.matchRequestResource.value();
    return matchRequest?.services.includes('birth-doula') ?? false;
  });

  constructor() {
    // Initialize service with id signal
    this.service.init(this.id);
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
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected showMarkPendingConfirm(): void {
    this.pendingAction.set('mark-pending');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected async confirmAction(): Promise<void> {
    const action = this.pendingAction();
    if (!action) return;

    const matchRequest = this.service.matchRequestResource.value();
    if (!matchRequest) return;

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
      ? 'Are you sure you want to mark this match request as processed? This indicates that the request has been sent to doulas.'
      : 'Are you sure you want to mark this match request as pending? This indicates that the request has not yet been sent to doulas.';
  }
}
