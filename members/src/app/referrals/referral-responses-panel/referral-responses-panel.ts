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
import { ReferralOutcomeControl } from '../referral-outcome-control/referral-outcome-control';
import { OUTCOME_LABELS } from '../referral.constants';
import type {
  OfflineResponseRow,
  ReferralCoordinatorView,
  ReferralDoula,
  ReferralDoulaKind,
} from '../referral.types';

/** Pill text per kind: Members need none; Legacy Memberships say they aren't migrated yet. */
const KIND_PILLS: Record<ReferralDoulaKind, string> = {
  member: '',
  legacy: 'Not yet migrated',
};

/** Members list before Legacy Memberships. */
const KIND_ORDER: Record<ReferralDoulaKind, number> = { member: 0, legacy: 1 };

/** Options shown at once; past this, keep typing to narrow. */
const MAX_RESULTS = 8;

/** A doula's key in the picker: kind and id, since a uid and a legacy id could collide. */
function doulaKey({ kind, id }: Pick<ReferralDoula, 'kind' | 'id'>): string {
  return `${kind}:${id}`;
}

interface DoulaOption {
  doula: ReferralDoula;
  key: string;
  kindLabel: string;
}

/**
 * Coordinator-only panel in the Referral pane: each member who sent Outreach,
 * when, and their Referral Outcome; then the Offline Responses, with a doula
 * autocomplete to add one and a delete button on the ones you may delete.
 * Shown only when the API includes the Coordinator view (Referral Coordinators
 * and Admins); the autocomplete, and the Outcome control on doulas not yet
 * migrated, only for Referral Coordinators. Members' Outcomes stay read-only.
 */
@Component({
  selector: 'app-referral-responses-panel',
  imports: [ReferralOutcomeControl],
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
      kind: KIND_PILLS[row.kind],
      // A doula not yet migrated has no portal account, so the Coordinator records their Outcome.
      legacyDoula:
        row.kind === 'legacy' && this.canRecord()
          ? { id: row.id, name: row.displayName || 'this doula' }
          : undefined,
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

  /** The text in the "Find a doula" box. */
  protected query = signal('');
  /** Key of the doula you chose; cleared when you edit the text. */
  private selectedKey = signal('');
  /** Whether the list of matches is open (it also needs matches to show). */
  private listOpen = signal(false);
  /** Index of the option the arrow keys are on, or -1. */
  protected activeIndex = signal(-1);
  protected chooseError = signal(false);
  protected saving = signal(false);
  protected status = signal('');
  protected actionError = signal('');

  /**
   * Doulas you can still name whose name contains the search text, Members
   * first then Legacy Memberships, alphabetical within each. Empty until you
   * type. Leaves out doulas who already have an Offline Response, and Members
   * who sent Outreach (the API refuses both).
   */
  private matches = computed<DoulaOption[]>(() => {
    const query = this.query().trim().toLocaleLowerCase();
    if (!query || !this.doulasResource.hasValue()) return [];
    const taken = new Set([
      ...this.coordinator().offlineResponses.map((row) => doulaKey(row)),
      ...this.coordinator().responses.map((row) => doulaKey({ kind: 'member', id: row.memberUid })),
    ]);
    return this.doulasResource
      .value()
      .filter(
        (doula) =>
          !taken.has(doulaKey(doula)) && doula.displayName.toLocaleLowerCase().includes(query),
      )
      .toSorted(
        (a, b) =>
          KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.displayName.localeCompare(b.displayName),
      )
      .map((doula) => ({ doula, key: doulaKey(doula), kindLabel: KIND_PILLS[doula.kind] }));
  });

  protected options = computed(() => this.matches().slice(0, MAX_RESULTS));

  /** The chosen doula, while it can still be named. */
  protected selected = computed(() => this.matches().find(({ key }) => key === this.selectedKey()));

  protected expanded = computed(() => this.listOpen() && this.options().length > 0);

  protected activeId = computed(() =>
    this.expanded() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : undefined,
  );

  /** What the note under the search box says, if anything. */
  protected resultsHint = computed(() => {
    if (this.selected()) return '';
    if (!this.query().trim()) return 'Type a name to find a doula.';
    const count = this.matches().length;
    if (count === 0) return 'No matching doulas';
    if (count > MAX_RESULTS) return `Keep typing to narrow ${count} matches`;
    return '';
  });

  private keyActions: Record<string, () => boolean> = {
    ArrowDown: () => this.moveActive(1),
    ArrowUp: () => this.moveActive(-1),
    Enter: () => {
      const option = this.expanded() ? this.options()[this.activeIndex()] : undefined;
      if (option) this.choose(option);
      return option !== undefined;
    },
    Escape: () => {
      const wasOpen = this.expanded();
      this.close();
      return wasOpen;
    },
  };

  protected optionId(index: number): string {
    return `offline-doula-option-${index}`;
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.selectedKey.set('');
    this.activeIndex.set(-1);
    this.listOpen.set(true);
  }

  /** Handles a key in the search box; a handled key doesn't also do its default. */
  protected onKeydown(event: KeyboardEvent): void {
    const action = this.keyActions[event.key];
    if (action?.()) event.preventDefault();
  }

  protected choose(option: DoulaOption): void {
    this.query.set(option.doula.displayName);
    this.selectedKey.set(option.key);
    this.chooseError.set(false);
    this.close();
  }

  protected close(): void {
    this.listOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected async add(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const choice = this.selected();
    if (!choice) {
      this.chooseError.set(true);
      return;
    }

    await this.run(
      () => this.referralsService.recordOfflineResponse(this.referralId(), choice.doula),
      `Recorded an Offline Response for ${choice.doula.displayName}.`,
    );
    if (!this.actionError()) {
      this.query.set('');
      this.selectedKey.set('');
    }
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

  /** Moves the active option by one, wrapping; opens the list first if it's closed. */
  private moveActive(step: number): boolean {
    this.listOpen.set(true);
    if (!this.expanded()) return false;
    const count = this.options().length;
    const current = this.activeIndex();
    const start = step > 0 ? -1 : count;
    const from = current < 0 ? start : current;
    this.activeIndex.set((from + step + count) % count);
    return true;
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
    return row.outcome ? OUTCOME_LABELS[row.outcome] : 'No outcome yet';
  }
}
