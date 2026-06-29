import { describe, it, expect } from 'vitest';
import utils from '../ui/utils.js';

describe('Time Parsing Utilities', () => {

    describe('parseTimeStr', () => {
        it('parses valid HH:MM:SS.MS format', () => {
            // 1 hour, 2 minutes, 3 seconds, 450 milliseconds
            expect(utils.parseTimeStr('01:02:03.45')).toBe(
                1 * 3600000 + 2 * 60000 + 3 * 1000 + 450
            );
            expect(utils.parseTimeStr('00:00:00.00')).toBe(0);
            expect(utils.parseTimeStr('10:59:59.99')).toBe(
                10 * 3600000 + 59 * 60000 + 59 * 1000 + 990
            );
        });

        it('parses valid MM:SS.MS format', () => {
            // 2 minutes, 3 seconds, 450 milliseconds
            expect(utils.parseTimeStr('02:03.45')).toBe(
                2 * 60000 + 3 * 1000 + 450
            );
            expect(utils.parseTimeStr('00:00.00')).toBe(0);
            expect(utils.parseTimeStr('59:59.99')).toBe(
                59 * 60000 + 59 * 1000 + 990
            );
        });

        it('returns null for missing or invalid parts length', () => {
            expect(utils.parseTimeStr('03.45')).toBeNull(); // Less than 3 parts
            expect(utils.parseTimeStr('01:02:03:04.45')).toBeNull(); // More than 4 parts
            expect(utils.parseTimeStr('')).toBeNull(); // Empty string
            expect(utils.parseTimeStr('abc')).toBeNull(); // Only 1 part
        });

        it('returns null for out of bounds values', () => {
            expect(utils.parseTimeStr('01:60:03.45')).toBeNull(); // minutes >= 60
            expect(utils.parseTimeStr('01:02:60.45')).toBeNull(); // seconds >= 60
            expect(utils.parseTimeStr('01:02:03.100')).toBeNull(); // parts[3] * 10 >= 1000 -> 100 * 10 = 1000
        });

        it('returns null for non-numeric values', () => {
            expect(utils.parseTimeStr('ab:cd:ef.gh')).toBeNull();
            expect(utils.parseTimeStr('01:cd:03.45')).toBeNull();
            expect(utils.parseTimeStr('01:02:03.gh')).toBeNull();
        });

        it('handles alternative separators', () => {
            expect(utils.parseTimeStr('01:02:03:45')).toBe(
                1 * 3600000 + 2 * 60000 + 3 * 1000 + 450
            );
        });
    });

    describe('parseTimeFromHHMMSSMS', () => {
        it('converts ms to seconds', () => {
            expect(utils.parseTimeFromHHMMSSMS('01:02:03.45')).toBe(
                (1 * 3600000 + 2 * 60000 + 3 * 1000 + 450) / 1000
            );
        });

        it('returns null for invalid input', () => {
            expect(utils.parseTimeFromHHMMSSMS('invalid')).toBeNull();
        });
    });

    describe('formatDuration', () => {
        it('formats milliseconds to HH:MM:SS.MS', () => {
            expect(utils.formatDuration(0)).toBe('00:00:00.00');
            expect(utils.formatDuration(1 * 3600000 + 2 * 60000 + 3 * 1000 + 450)).toBe('01:02:03.45');
            // Negative values
            expect(utils.formatDuration(-(1 * 3600000 + 2 * 60000 + 3 * 1000 + 450))).toBe('-01:02:03.45');
        });

        it('handles undefined/null/NaN', () => {
            expect(utils.formatDuration(undefined)).toBe('00:00:00.00');
            expect(utils.formatDuration(null)).toBe('00:00:00.00');
            expect(utils.formatDuration(NaN)).toBe('00:00:00.00');
        });
    });

    describe('formatDecimalMinutes', () => {
        it('formats ms to decimal minutes', () => {
            expect(utils.formatDecimalMinutes(60000)).toBe('1.00');
            expect(utils.formatDecimalMinutes(90000)).toBe('1.50');
            expect(utils.formatDecimalMinutes(0)).toBe('0.00');
        });

        it('handles undefined/null/NaN', () => {
            expect(utils.formatDecimalMinutes(undefined)).toBe('0.00');
            expect(utils.formatDecimalMinutes(null)).toBe('0.00');
            expect(utils.formatDecimalMinutes(NaN)).toBe('0.00');
        });
    });

    describe('formatTimeToHHMMSSMS', () => {
        it('converts seconds to HH:MM:SS.MS format', () => {
             expect(utils.formatTimeToHHMMSSMS(1.5)).toBe('00:00:01.50');
             expect(utils.formatTimeToHHMMSSMS(0)).toBe('00:00:00.00');
             expect(utils.formatTimeToHHMMSSMS(3723.45)).toBe('01:02:03.45');
        });

        it('handles undefined/null', () => {
             expect(utils.formatTimeToHHMMSSMS(undefined)).toBe('00:00:00.00');
             expect(utils.formatTimeToHHMMSSMS(null)).toBe('00:00:00.00');
        });
    });

    describe('parseTaktTime and formatTaktTime aliases', () => {
        it('aliases work correctly', () => {
             expect(utils.parseTaktTime('01:02:03.45')).toBe(utils.parseTimeStr('01:02:03.45'));
             expect(utils.formatTaktTime(1000)).toBe(utils.formatDuration(1000));
        });
    });
});
