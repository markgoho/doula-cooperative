import { describe, expect, it } from 'vitest';
import { buildImageKitDisplayUrl } from './profile-image-url';

describe('buildImageKitDisplayUrl', () => {
  it('builds the ImageKit URL with fallback image and face crop', () => {
    expect(buildImageKitDisplayUrl('jane-doe', 300, 300)).toBe(
      'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
    );
  });

  it('handles non-square dimensions', () => {
    expect(buildImageKitDisplayUrl('jane-doe', 200, 400)).toBe(
      'https://ik.imagekit.io/doulacoop/tr:w-200,h-400,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile',
    );
  });

  it('handles multi-hyphen slugs', () => {
    expect(buildImageKitDisplayUrl('mary-jane-watson-smith', 300, 300)).toBe(
      'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/mary-jane-watson-smith/mary-jane-watson-smith-profile',
    );
  });
});
