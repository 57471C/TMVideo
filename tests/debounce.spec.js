import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import utils from '../ui/utils.js';

const { debounce } = utils;

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('should delay function execution', () => {
        const func = vi.fn();
        const debouncedFunc = debounce(func, 100);

        debouncedFunc();
        expect(func).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(func).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(func).toHaveBeenCalledTimes(1);
    });

    it('should only execute once for multiple calls within the wait time', () => {
        const func = vi.fn();
        const debouncedFunc = debounce(func, 100);

        debouncedFunc();
        debouncedFunc();
        debouncedFunc();

        expect(func).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);

        expect(func).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
        const func = vi.fn();
        const debouncedFunc = debounce(func, 100);

        debouncedFunc();
        vi.advanceTimersByTime(50);

        debouncedFunc();
        vi.advanceTimersByTime(50);

        expect(func).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);

        expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the delayed function', () => {
        const func = vi.fn();
        const debouncedFunc = debounce(func, 100);

        debouncedFunc('arg1', 'arg2');

        vi.advanceTimersByTime(100);

        expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should pass the latest arguments if called multiple times', () => {
        const func = vi.fn();
        const debouncedFunc = debounce(func, 100);

        debouncedFunc('arg1', 'arg2');
        debouncedFunc('arg3', 'arg4');

        vi.advanceTimersByTime(100);

        expect(func).toHaveBeenCalledWith('arg3', 'arg4');
        expect(func).not.toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should execute if wait time is 0', () => {
        const func = vi.fn();
        const debouncedFunc = debounce(func, 0);

        debouncedFunc();

        // Need to wait for the next tick as setTimeout with 0 still delays execution
        vi.advanceTimersByTime(0);

        expect(func).toHaveBeenCalledTimes(1);
    });
});
