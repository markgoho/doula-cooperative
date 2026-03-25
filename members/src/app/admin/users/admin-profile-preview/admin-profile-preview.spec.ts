import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { AdminMemberDetailService } from '../admin-member-detail/admin-member-detail.service';
import { AdminProfilePreview } from './admin-profile-preview';

describe('AdminProfilePreview', () => {
  it('passes the computed profile image URL to the shared preview', async () => {
    await render(AdminProfilePreview, {
      providers: [
        {
          provide: AdminMemberDetailService,
          useValue: {
            init: () => {},
            loadProfile: () => {},
            memberResource: {
              value: signal({ uid: 'uid-1', slug: 'jane-doe' }),
              isLoading: signal(false),
            },
            profileResource: {
              value: signal({ title: 'Jane Doe', bio: 'Bio text.' }),
              isLoading: signal(false),
            },
            errorMessage: signal(undefined),
            profileErrorMessage: signal(undefined),
            profileImageUrl: signal(
              'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
            ),
          },
        },
      ],
      inputs: { uid: 'uid-1' },
    });

    const image = screen.getByAltText('Headshot of Jane Doe');
    expect(image).toHaveAttribute(
      'src',
      'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
    );
  });
});
