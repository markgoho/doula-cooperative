import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

type ConfirmButtonVariant = 'primary' | 'danger';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ConfirmDialog {
  title = input.required<string>();
  message = input.required<string>();
  confirmButtonText = input<string>('Confirm');
  confirmButtonVariant = input<ConfirmButtonVariant>('primary');
  cancelButtonText = input<string>('Cancel');
  disabled = input<boolean>(false);

  confirmed = output<void>();
  cancelled = output<void>();

  private dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  showModal(): void {
    this.dialog()?.nativeElement.showModal();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected onConfirm(): void {
    this.confirmed.emit();
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
