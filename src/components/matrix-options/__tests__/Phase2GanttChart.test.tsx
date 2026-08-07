import { describe, expect, it } from 'vitest';
import { parseCol, GANTT_DATA } from '../Phase2GanttChart';

describe('Phase2GanttChart logic', () => {
  describe('parseCol', () => {
    it('correctly maps week to month logic', () => {
      expect(parseCol('Week 1')).toEqual({ start: 1, end: 1 });
      expect(parseCol('Weeks 1-4')).toEqual({ start: 1, end: 1 });
      expect(parseCol('Weeks 1-5')).toEqual({ start: 1, end: 2 });
    });

    it('correctly parses month logic', () => {
      expect(parseCol('Month 1')).toEqual({ start: 1, end: 1 });
      expect(parseCol('Month 4')).toEqual({ start: 4, end: 4 });
      expect(parseCol('Months 6-9')).toEqual({ start: 6, end: 9 });
    });

    it('correctly parses ongoing logic', () => {
      expect(parseCol('Month 4 - ongoing')).toEqual({ start: 4, end: 14 });
      expect(parseCol('Ongoing')).toEqual({ start: 1, end: 14 });
    });
  });

  describe('GANTT_DATA segmentation', () => {
    it('accurately maps Task 3 with bounded ongoing gaps', () => {
      const t3 = GANTT_DATA.find(t => t.id === '3');
      expect(t3).toBeDefined();
      expect(t3?.segments).toEqual([{ start: 1, end: 14 }]);
    });

    it('accurately maps Task 6 gaps without filling them in', () => {
      const t6 = GANTT_DATA.find(t => t.id === '6');
      expect(t6).toBeDefined();
      expect(t6?.segments).toEqual([
        { start: 1, end: 3 },
        { start: 6, end: 9 }
      ]);
    });

    it('maps Task 10 as full continuous ongoing', () => {
      const t10 = GANTT_DATA.find(t => t.id === '10');
      expect(t10).toBeDefined();
      expect(t10?.segments).toEqual([{ start: 1, end: 14 }]);
    });
  });
});
