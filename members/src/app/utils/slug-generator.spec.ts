import { describe, expect, it } from 'vitest';
import { ensureUniqueSlug, generateSlug } from './slug-generator';

describe('slug-generator', () => {
  describe('generateSlug', () => {
    it('should convert name to lowercase', () => {
      expect(generateSlug('Jane Smith')).toBe('jane-smith');
      expect(generateSlug('JOHN DOE')).toBe('john-doe');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('Jane Smith')).toBe('jane-smith');
      expect(generateSlug('Mary Ann Johnson')).toBe('mary-ann-johnson');
    });

    it('should remove special characters', () => {
      expect(generateSlug('Jane Smith!')).toBe('jane-smith');
      expect(generateSlug('Mary@Ann#Johnson')).toBe('maryannjohnson');
    });

    it('should normalize accented characters to base form', () => {
      expect(generateSlug('José García')).toBe('jose-garcia');
      expect(generateSlug('María López')).toBe('maria-lopez');
      expect(generateSlug('François Müller')).toBe('francois-muller');
      expect(generateSlug('Søren Ñoño')).toBe('soren-nono');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(generateSlug('Jane    Smith')).toBe('jane-smith');
      expect(generateSlug('Mary  Ann   Johnson')).toBe('mary-ann-johnson');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(generateSlug('-Jane Smith')).toBe('jane-smith');
      expect(generateSlug('Jane Smith-')).toBe('jane-smith');
      expect(generateSlug('-Jane Smith-')).toBe('jane-smith');
    });

    it('should handle unicode characters by removing them', () => {
      expect(generateSlug('Jane 👋 Smith')).toBe('jane-smith');
      expect(generateSlug('Mary ♥ Johnson')).toBe('mary-johnson');
    });

    it('should handle names that result in empty slugs', () => {
      expect(generateSlug('!!!')).toBe('');
      expect(generateSlug('   ')).toBe('');
      expect(generateSlug('---')).toBe('');
    });

    it('should handle single words', () => {
      expect(generateSlug('Jane')).toBe('jane');
      expect(generateSlug('MARY')).toBe('mary');
    });
  });

  describe('ensureUniqueSlug', () => {
    it('should return original slug if not taken', async () => {
      const checkSlugExists = async () => false;
      const result = await ensureUniqueSlug('jane-smith', checkSlugExists);
      expect(result).toBe('jane-smith');
    });

    it('should append -2 if slug exists once', async () => {
      let callCount = 0;
      const checkSlugExists = async (slug: string) => {
        callCount++;
        return slug === 'jane-smith';
      };

      const result = await ensureUniqueSlug('jane-smith', checkSlugExists);
      expect(result).toBe('jane-smith-2');
      expect(callCount).toBe(2); // Check jane-smith, then jane-smith-2
    });

    it('should increment suffix until unique slug found', async () => {
      const takenSlugs = new Set(['jane-smith', 'jane-smith-2', 'jane-smith-3']);
      const checkSlugExists = async (slug: string) => takenSlugs.has(slug);

      const result = await ensureUniqueSlug('jane-smith', checkSlugExists);
      expect(result).toBe('jane-smith-4');
    });

    it('should handle checking many conflicts', async () => {
      const checkSlugExists = async (slug: string) => {
        // First 10 slugs are taken
        const match = slug.match(/jane-smith-(\d+)/);
        if (!match?.[1]) return slug === 'jane-smith'; // Base slug is taken
        return Number.parseInt(match[1]) <= 10;
      };

      const result = await ensureUniqueSlug('jane-smith', checkSlugExists);
      expect(result).toBe('jane-smith-11');
    });
  });
});
