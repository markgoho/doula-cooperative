import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { ProfilePreview } from '../../../shared/profile-preview/profile-preview';

describe('AdminProfilePreview integration', () => {
  it('renders the computed profile image URL through the shared preview component', async () => {
    await render(ProfilePreview, {
      inputs: {
        profile: { title: 'Jane Doe', bio: 'Bio text.' },
        imageUrl:
          'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
      },
    });

    const image = screen.getByRole('img', { name: 'Headshot of Jane Doe' });
    expect(image).toHaveAttribute(
      'src',
      'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
    );
  });
});
