import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';
import type { ResourceRef } from '@angular/core';
import { SignupsBarChart } from './signups-bar-chart';
import type { MemberSignupsResponse } from '../../../api-types/analytics-api.types';

type SignupsResource = ResourceRef<MemberSignupsResponse | undefined>;

const noError: () => unknown = () => void 0 as unknown;
const noValue: () => MemberSignupsResponse | undefined = () =>
  void 0 as MemberSignupsResponse | undefined;

function makeResource(overrides: {
  isLoading?: () => boolean;
  error?: () => unknown;
  value?: () => MemberSignupsResponse | undefined;
}): SignupsResource {
  return {
    isLoading: overrides.isLoading ?? (() => false),
    error: overrides.error ?? noError,
    value: overrides.value ?? noValue,
    // ResourceRef also has these but we don't need them in tests
    status: signal('idle' as never),
    reload: () => false,
    update: () => { /* noop */ },
    set: () => { /* noop */ },
    destroy: () => { /* noop */ },
    hasValue: () => false,
  } as unknown as SignupsResource;
}

describe('SignupsBarChart', () => {
  it('shows loading state', async () => {
    const resource = makeResource({ isLoading: () => true });
    await render(SignupsBarChart, { inputs: { resource } });
    TestBed.flushEffects();
    expect(screen.getByText('Loading signups…')).toBeTruthy();
  });

  it('shows error message when resource is in error state', async () => {
    const resource = makeResource({
      isLoading: () => false,
      error: () => new Error('Http failure'),
      // value() throws ResourceValueError when errored — do NOT call it
      value: () => { throw new Error('ResourceValueError'); },
    });
    await render(SignupsBarChart, { inputs: { resource } });
    TestBed.flushEffects();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Failed to load member signups.')).toBeTruthy();
  });

  it('shows empty state when no signups', async () => {
    const resource = makeResource({
      value: () => ({ days: [] }),
    });
    await render(SignupsBarChart, { inputs: { resource } });
    TestBed.flushEffects();
    expect(screen.getByText('No signups this month.')).toBeTruthy();
  });

  it('renders bar chart when data is present', async () => {
    const resource = makeResource({
      value: () => ({
        days: [
          { date: '2026-06-01', count: 3 },
          { date: '2026-06-02', count: 1 },
        ],
      }),
    });
    await render(SignupsBarChart, { inputs: { resource } });
    TestBed.flushEffects();
    expect(screen.getByRole('img', { name: /daily member signups/i })).toBeTruthy();
  });
});
