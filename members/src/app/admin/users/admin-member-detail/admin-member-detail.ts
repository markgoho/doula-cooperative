import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { ApiMemberResponse } from '../../../api-types/api-member-response';
import type { UnlinkedProfile } from '../../admin.types';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { AdminMemberDetailService } from './admin-member-detail.service';

type ConfirmAction =
  | 'activate'
  | 'cancel'
  | 'refund'
  | 'cleanSlate'
  | 'toggleDraft'
  | 'deleteDraftProfile'
  | 'linkProfile';

interface DialogConfig {
  title: string;
  message: string;
  confirmText: string;
  variant: 'primary' | 'danger';
}

@Component({
  imports: [DatePipe, FormsModule, ConfirmDialog, AlertBanner],
  templateUrl: './admin-member-detail.html',
  styleUrl: './admin-member-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMemberDetailService], // Provide service at component level
})
export class AdminMemberDetail {
  protected service = inject(AdminMemberDetailService);
  private router = inject(Router);

  // Route parameter binding (enabled via withComponentInputBinding)
  uid = input.required<string>();

  // Component-specific UI state
  protected confirmDialog = viewChild(ConfirmDialog);
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);
  protected dialogConfig = signal<DialogConfig>({
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'primary',
  });

  protected isTargetUserAdmin = computed(() => {
    const resource = this.service.memberResource;
    if (!resource.hasValue()) return false;
    return (resource.value() as ApiMemberResponse).isAdmin;
  });

  protected isRefundEligible = computed(() => {
    const resource = this.service.memberResource;
    if (!resource.hasValue()) return false;
    const member = resource.value() as ApiMemberResponse;
    if (member.subscriptionStart === undefined) return false;
    const subscriptionStartMs = new Date(member.subscriptionStart).getTime();
    const REFUND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - subscriptionStartMs <= REFUND_WINDOW_MS;
  });

  protected isProfileDraft = computed(() => {
    const profile = this.service.profileResource.value();
    if (!profile) return;
    return profile.draft;
  });

  protected profileSearchTerm = linkedSignal(() => {
    const member = this.service.memberResource.hasValue()
      ? (this.service.memberResource.value() as ApiMemberResponse)
      : undefined;
    return member?.email?.toLowerCase() ?? '';
  });

  protected debouncedSearchTerm = signal('');

  protected filteredUnlinkedProfiles = computed(() => {
    const profiles = this.service.unlinkedProfilesResource.value();
    if (!profiles) return [];

    const searchTerm = this.debouncedSearchTerm().toLowerCase().trim();
    if (searchTerm.length === 0) return [];

    return profiles.filter(
      (profile) =>
        profile.email.toLowerCase().includes(searchTerm) ||
        profile.title.toLowerCase().includes(searchTerm) ||
        profile.slug.toLowerCase().includes(searchTerm),
    );
  });

  private pendingLinkSlug = signal<string | undefined>(undefined);

  constructor() {
    this.service.init(this.uid);

    const destroyReference = inject(DestroyRef);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    effect(() => {
      const searchTerm = this.profileSearchTerm();
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.debouncedSearchTerm.set(searchTerm);
      }, 300);
    });

    destroyReference.onDestroy(() => {
      clearTimeout(timeoutId);
    });
  }

  protected showActivateConfirm(): void {
    this.pendingAction.set('activate');
    this.dialogConfig.set({
      title: 'Confirm Activation',
      message: 'Are you sure you want to activate this membership?',
      confirmText: 'Activate',
      variant: 'primary',
    });
    this.confirmDialog()?.showModal();
  }

  protected showCancelConfirm(): void {
    this.pendingAction.set('cancel');
    this.dialogConfig.set({
      title: 'Confirm Cancellation',
      message:
        'This will cancel the Stripe subscription at the end of the current billing period. The member will remain active until their membership expires. For legacy members without Stripe, membership will be deactivated immediately.',
      confirmText: 'Cancel Membership',
      variant: 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected showRefundConfirm(): void {
    this.pendingAction.set('refund');
    this.dialogConfig.set({
      title: 'Confirm Refund',
      message:
        'Are you sure you want to refund this membership? This will issue a Stripe refund, cancel the subscription, deactivate the membership, and hide the profile.',
      confirmText: 'Refund',
      variant: 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected showCleanSlateConfirm(): void {
    this.pendingAction.set('cleanSlate');
    this.dialogConfig.set({
      title: 'Confirm Clean Slate Delete',
      message:
        'This will completely remove the user from ALL systems: Stripe customer, MailerLite subscriber, Hugo profile, ImageKit profile image, Firestore document, and Firebase Auth. This is intended for testing cleanup. This action cannot be undone.',
      confirmText: 'Clean Slate Delete',
      variant: 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected showToggleDraftConfirm(): void {
    const isDraft = this.isProfileDraft();
    this.pendingAction.set('toggleDraft');
    this.dialogConfig.set({
      title: isDraft ? 'Confirm Publish' : 'Confirm Unpublish',
      message: isDraft
        ? 'This will publish the profile, making it visible on the public website after the next site build.'
        : 'This will unpublish the profile, hiding it from the public website after the next site build.',
      confirmText: isDraft ? 'Publish' : 'Unpublish',
      variant: isDraft ? 'primary' : 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected showDeleteDraftConfirm(): void {
    this.pendingAction.set('deleteDraftProfile');
    this.dialogConfig.set({
      title: 'Confirm Delete Draft Profile',
      message:
        'This will permanently delete the draft profile and its image. The member will no longer have a profile, and you can then link an existing profile to this member. This action cannot be undone.',
      confirmText: 'Delete Draft Profile',
      variant: 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected confirmLinkProfile(profile: UnlinkedProfile): void {
    this.pendingAction.set('linkProfile');
    this.pendingLinkSlug.set(profile.slug);
    this.dialogConfig.set({
      title: 'Confirm Link Profile',
      message: `Link profile "${profile.title}" (${profile.slug}) to this member? This action cannot be undone.`,
      confirmText: 'Link Profile',
      variant: 'primary',
    });
    this.confirmDialog()?.showModal();
  }

  protected onCancelDialog(): void {
    this.confirmDialog()?.close();
    this.pendingAction.set(undefined);
    this.pendingLinkSlug.set(undefined);
  }

  protected async onConfirmDialog(): Promise<void> {
    const action = this.pendingAction();

    try {
      switch (action) {
        case 'activate': {
          await this.service.activateMembership(this.uid());
          break;
        }
        case 'cancel': {
          await this.service.cancelMembership(this.uid());
          break;
        }
        case 'refund': {
          await this.service.refundMembership(this.uid());
          break;
        }
        case 'cleanSlate': {
          await this.cleanSlateDelete();
          break;
        }
        case 'toggleDraft': {
          await this.service.toggleProfileDraft(this.uid());
          break;
        }
        case 'deleteDraftProfile': {
          await this.service.deleteDraftProfile(this.uid());
          break;
        }
        case 'linkProfile': {
          const slug = this.pendingLinkSlug();
          if (slug === undefined) {
            this.service.actionError.set('Failed to link profile.');
            break;
          }
          await this.service.linkProfile(this.uid(), slug);
          break;
        }
      }
    } finally {
      this.confirmDialog()?.close();
      this.pendingAction.set(undefined);
      this.pendingLinkSlug.set(undefined);
    }
  }

  protected loadProfile(): void {
    if (this.service.memberResource.hasValue()) {
      this.service.loadProfile(this.service.memberResource.value() as ApiMemberResponse);
    }
  }

  private async cleanSlateDelete(): Promise<void> {
    await this.service.cleanSlateDelete(this.uid());

    // Navigate back to members list after successful clean slate delete
    if (this.service.successMessage()) {
      await this.router.navigate(['/admin/members']);
    }
  }
}
