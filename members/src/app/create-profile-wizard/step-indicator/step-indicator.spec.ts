import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { StepIndicator } from './step-indicator';

describe('StepIndicator', () => {
  it('should render all step labels', async () => {
    await setup();

    expect(screen.getByText('Personal Info')).toBeVisible();
    expect(screen.getByText('Services')).toBeVisible();
    expect(screen.getByText('Bio')).toBeVisible();
    expect(screen.getByText('Contact')).toBeVisible();
    expect(screen.getByText('Photo')).toBeVisible();
    expect(screen.getByText('Preview')).toBeVisible();
  });

  it('should mark current step with aria-current', async () => {
    await setup({ currentStep: 'tags' });

    const steps = screen.getAllByRole('listitem');
    const tagsStep = steps[1];
    expect(tagsStep).toHaveAttribute('aria-current', 'step');
  });

  it('should show checkmark for completed steps', async () => {
    await setup({
      currentStep: 'bio',
      completedSteps: new Set(['personal', 'tags']),
    });

    // Completed steps should show checkmark
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
  });

  it('should disable navigation to incomplete future steps', async () => {
    await setup({ currentStep: 'personal' });

    const disabledSteps = screen.getAllByText((_, element) => {
      return element?.getAttribute('aria-disabled') === 'true';
    });
    expect(disabledSteps.length).toBeGreaterThan(0);
  });
});

interface SetupOptions {
  currentStep?: 'personal' | 'tags' | 'bio' | 'contact' | 'image' | 'preview';
  completedSteps?: Set<'personal' | 'tags' | 'bio' | 'contact' | 'image' | 'preview'>;
}

async function setup({ currentStep = 'personal', completedSteps = new Set() }: SetupOptions = {}) {
  return render(StepIndicator, {
    inputs: {
      currentStep,
      completedSteps,
    },
  });
}
