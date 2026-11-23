import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ReferralsService } from '../../services/referrals.service';
import { formatSentAt } from '../format-sent-at';
import { OUTCOME_LABELS } from '../referral.constants';
import type {
  OfflineResponseRow,
  ReferralCoordinatorView,
  ReferralDoula,
  ReferralDoulaKind,
} from '../referral.types';

const KIND_LABELS: Record<ReferralDoulaKind, string> = {
  member: 'Member',
  legacy: 'Not yet migrated',
};

/** A doula's key in the picker: kind and id, since a uid and a legacy id could collide. */
function doulaKey({ kind, id }: Pick<ReferralDoula, 'kind' | 'id'>): string {
  return `${kind}:${id}`;
}

/**
 * Coordinator-only panel in the Referral pane: each member who sent Outreach,
 * when, and their Referral Outcome; then the Offline Responses, with a picker
 * to add one and a delete button on the ones you may delete. Shown only when
 * the API includes the Coordinator view (Referral Coordinators and Admins);
 * the picker only for Referral Coordinators.
 */
@Component({
  selector: 'app-referral-responses-panel',
  templateUrl: './referral-responses-panel.html',
  styleUrl: './referral-responses-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralResponsesPanel {
  private referralsService = inject(ReferralsService);

  referralId = input.required<string>();
  coordinator = input.required<ReferralCoordinatorView>();

  /** Emits after an Offline Response is added or deleted, so the pane can refresh. */
  changed = output();

  private doulaSelect = viewChild<ElementRef<HTMLSelectElement>>('doulaSelect');
  private offlineHeading = viewChild<ElementRef<HTMLElement>>('offlineHeading');

  protected rows = computed(() =>
    this.coordinator().responses.map((response) => ({
      memberUid: response.memberUid,
      name: response.memberName || 'Name not set',
      sentAt: response.outreachSentAt,
      sentAtLabel: formatSentAt(response.outreachSentAt),
      outcome: response.outcome ? OUTCOME_LABELS[response.outcome] : 'No outcome yet',
      hasOutcome: response.outcome !== undefined,
    })),
  );

  protected offlineRows = computed(() =>
    this.coordinator().offlineResponses.map((row) => ({
      row,
      key: doulaKey(row),
      name: row.displayName || 'Name not set',
      // Members need no label; Legacy Memberships say they aren't migrated yet.
      kind: row.kind === 'legacy' ? KIND_LABELS.legacy : '',
      recordedAt: row.recordedAt,
      recordedAtLabel: formatSentAt(row.recordedAt),
      recordedBy: row.recordedByName || 'a Referral Coordinator',
      outcome: this.offlineOutcome(row),
    })),
  );

  /** Read on its own so a refreshed Coordinator view doesn't reload the doulas. */
  private canRecord = computed(() => this.coordinator().canRecordOfflineResponses);

  protected doulasResource = resource({
    params: () => (this.canRecord() ? true : undefined),
    loader: () => this.referralsService.listReferralDoulas(),
  });

  protected query = signal('');
  protected saving = signal(false);
  protected status = signal('');
  protected actionError = signal('');

  /**
   * Doulas you can still name, filtered by the search text and grouped by
   * kind. Leaves out doulas who already have an Offline Response, and Members
   * who sent Outreach (the API refuses both).
   */
  protected options = computed(() => {
    if (!this.doulasResource.hasValue()) return [];
    const taken = new Set([
      ...this.coordinator().offlineResponses.map((row) => doulaKey(row)),
      ...this.coordinator().responses.map((row) => doulaKey({ kind: 'member', id: row.memberUid })),
    ]);
    const query = this.query().trim().toLocaleLowerCase();
    const available = this.doulasResource
      .value()
      .filter(
        (doula) =>
          !taken.has(doulaKey(doula)) && doula.displayName.toLocaleLowerCase().includes(query),
      )
      .map((doula) => ({ doula, key: doulaKey(doula) }));
    return (Object.keys(KIND_LABELS) as ReferralDoulaKind[])
      .map((kind) => ({
        label: kind === 'member' ? 'Members' : 'Not yet migrated',
        options: available.filter(({ doula }) => doula.kind === kind),
      }))
      .filter((group) => group.options.length > 0);
  });

  protected optionCount = computed(() =>
    this.options().reduce((count, group) => count + group.options.length, 0),
  );

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async add(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    // Read what the select shows: filtering can change its selection without a change event.
    const select = this.doulaSelect()?.nativeElement;
    const choice = this.options()
      .flatMap((group) => group.options)
      .find(({ key }) => key === select?.value);
    if (!select || !choice) return;

    await this.run(
      () => this.referralsService.recordOfflineResponse(this.referralId(), choice.doula),
      `Recorded an Offline Response for ${choice.doula.displayName}.`,
    );
    if (!this.actionError()) select.value = '';
  }

  protected async remove(row: OfflineResponseRow): Promise<void> {
    if (this.saving()) return;
    // The button goes away with the row; keep focus in the panel.
    this.offlineHeading()?.nativeElement.focus();
    await this.run(
      () => this.referralsService.deleteOfflineResponse(this.referralId(), row),
      `Deleted the Offline Response for ${row.displayName || 'this doula'}.`,
    );
  }

  private async run(request: () => Promise<unknown>, done: string): Promise<void> {
    this.saving.set(true);
    this.actionError.set('');
    this.status.set('Saving…');
    try {
      await request();
      this.status.set(done);
      this.changed.emit();
    } catch (error: unknown) {
      this.status.set('');
      this.actionError.set(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private offlineOutcome(row: OfflineResponseRow): string {
    if (row.kind === 'legacy') return '';
    return row.outcome ? OUTCOME_LABELS[row.outcome] : 'No outcome yet';
  }
}
