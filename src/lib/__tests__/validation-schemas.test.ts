import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  parseFormData,
  updateTagSchema,
  updateAnnouncementSchema,
  updateMilestoneSchema,
  createTagSchema,
  createAnnouncementSchema
} from '../validation-schemas';

describe('validation-schemas', () => {
  describe('numeric id coercion in schemas (preprocess blocks)', () => {
    describe('updateTagSchema', () => {
      it('coerces string "5" to 5', () => {
        const result = updateTagSchema.safeParse({
          name: 'tag1',
          color: '#FF5733',
          id: '5'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(5);
        }
      });

      it('rejects empty string ""', () => {
        const result = updateTagSchema.safeParse({
          name: 'tag1',
          color: '#FF5733',
          id: ''
        });
        expect(result.success).toBe(false);
      });

      it('rejects non-numeric string "abc"', () => {
        const result = updateTagSchema.safeParse({
          name: 'tag1',
          color: '#FF5733',
          id: 'abc'
        });
        expect(result.success).toBe(false);
      });
    });

    describe('updateAnnouncementSchema', () => {
      it('coerces string "5" to 5', () => {
        const result = updateAnnouncementSchema.safeParse({
          title: 'Title',
          content: 'Content',
          priority: 'low',
          is_active: true,
          id: '5'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(5);
        }
      });

      it('rejects empty string ""', () => {
        const result = updateAnnouncementSchema.safeParse({
          title: 'Title',
          content: 'Content',
          priority: 'low',
          is_active: true,
          id: ''
        });
        expect(result.success).toBe(false);
      });

      it('rejects non-numeric string "abc"', () => {
        const result = updateAnnouncementSchema.safeParse({
          title: 'Title',
          content: 'Content',
          priority: 'low',
          is_active: true,
          id: 'abc'
        });
        expect(result.success).toBe(false);
      });
    });

    describe('updateMilestoneSchema', () => {
      it('coerces string "5" to 5', () => {
        const result = updateMilestoneSchema.safeParse({
          title: 'Title',
          description: 'Desc',
          target_date: '2026-05-13T12:00:00Z',
          status: 'pending',
          priority: 'low',
          id: '5'
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(5);
        }
      });

      it('rejects empty string ""', () => {
        expect(() => {
          updateMilestoneSchema.parse({
            title: 'Title',
            description: 'Desc',
            target_date: '2026-05-13T12:00:00Z',
            status: 'pending',
            priority: 'low',
            id: ''
          });
        }).toThrow();
      });

      it('rejects non-numeric string "abc"', () => {
        expect(() => {
          updateMilestoneSchema.parse({
            title: 'Title',
            description: 'Desc',
            target_date: '2026-05-13T12:00:00Z',
            status: 'pending',
            priority: 'low',
            id: 'abc'
          });
        }).toThrow();
      });
    });
  });

  describe('boolean-as-string coercion (is_active)', () => {
    it('coerces "true" to true', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Title',
        content: 'Content',
        priority: 'low',
        is_active: 'true'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(true);
      }
    });

    it('coerces "false" to false', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Title',
        content: 'Content',
        priority: 'low',
        is_active: 'false'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(false);
      }
    });
  });

  describe('hex color regex boundary', () => {
    it('accepts "#FF5733"', () => {
      const result = createTagSchema.safeParse({
        name: 'tag',
        color: '#FF5733'
      });
      expect(result.success).toBe(true);
    });

    it('rejects "#FF573" (too short)', () => {
      const result = createTagSchema.safeParse({
        name: 'tag',
        color: '#FF573'
      });
      expect(result.success).toBe(false);
    });

    it('rejects "#GG5733" (invalid hex)', () => {
      const result = createTagSchema.safeParse({
        name: 'tag',
        color: '#GG5733'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('parseFormData', () => {
    it('returns {data} on success', () => {
      const formData = new FormData();
      formData.append('name', 'My Tag');
      formData.append('color', '#FF5733');
      
      const result = parseFormData(formData, createTagSchema);
      expect(result.error).toBeUndefined();
      expect(result.data?.name).toBe('My Tag');
    });

    it('returns {error: first-issue message} on ZodError', () => {
      const formData = new FormData();
      formData.append('name', 'My Tag');
      formData.append('color', 'blue'); // Invalid hex
      
      const result = parseFormData(formData, createTagSchema);
      expect(result.error).toBe('Color must be a valid hex color (e.g., #FF5733)');
      expect(result.data).toBeUndefined();
    });

    it('re-throws non-Zod errors', () => {
      // Throw a primitive string to bypass the `instanceof Error` catch block
      const throwingSchema = z.string().transform(() => {
        throw 'Non-Zod explicit throw';
      });
      
      const formData = new FormData();
      formData.append('val', '123');
      
      expect(() => {
        parseFormData(formData, z.object({ val: throwingSchema }));
      }).toThrow('Non-Zod explicit throw');
    });
  });
});
