import { describe, it, expect } from 'vitest';
import utils from '../ui/utils.js';

const { escapeHTML } = utils;

describe('escapeHTML', () => {
    it('should be defined', () => {
        expect(escapeHTML).toBeDefined();
        expect(typeof escapeHTML).toBe('function');
    });

    it('should return the original string if it contains no special characters', () => {
        expect(escapeHTML('hello world')).toBe('hello world');
        expect(escapeHTML('12345')).toBe('12345');
        expect(escapeHTML('abc ABC 123 !@#$^*()')).toBe('abc ABC 123 !@#$^*()');
    });

    it('should escape ampersand (&)', () => {
        expect(escapeHTML('hello & world')).toBe('hello &amp; world');
        expect(escapeHTML('&')).toBe('&amp;');
    });

    it('should escape less than (<)', () => {
        expect(escapeHTML('hello < world')).toBe('hello &lt; world');
        expect(escapeHTML('<')).toBe('&lt;');
    });

    it('should escape greater than (>)', () => {
        expect(escapeHTML('hello > world')).toBe('hello &gt; world');
        expect(escapeHTML('>')).toBe('&gt;');
    });

    it('should escape double quotes (")', () => {
        expect(escapeHTML('hello "world"')).toBe('hello &quot;world&quot;');
        expect(escapeHTML('"')).toBe('&quot;');
    });

    it('should escape single quotes (\')', () => {
        expect(escapeHTML("hello 'world'")).toBe('hello &#039;world&#039;');
        expect(escapeHTML("'")).toBe('&#039;');
    });

    it('should escape multiple different special characters', () => {
        expect(escapeHTML('hello & < > " \'')).toBe('hello &amp; &lt; &gt; &quot; &#039;');
        expect(escapeHTML('<div>"text" & \'text\'</div>')).toBe('&lt;div&gt;&quot;text&quot; &amp; &#039;text&#039;&lt;/div&gt;');
    });

    it('should escape all occurrences of a special character', () => {
        expect(escapeHTML('&&<<>>""\'\'')).toBe('&amp;&amp;&lt;&lt;&gt;&gt;&quot;&quot;&#039;&#039;');
        expect(escapeHTML('a&b&c')).toBe('a&amp;b&amp;c');
        expect(escapeHTML('<p><br></p>')).toBe('&lt;p&gt;&lt;br&gt;&lt;/p&gt;');
    });

    it('should handle non-string inputs by returning them unchanged', () => {
        expect(escapeHTML(null)).toBe(null);
        expect(escapeHTML(undefined)).toBe(undefined);
        expect(escapeHTML(123)).toBe(123);
        expect(escapeHTML(0)).toBe(0);
        expect(escapeHTML(true)).toBe(true);
        expect(escapeHTML(false)).toBe(false);
        const obj = {};
        expect(escapeHTML(obj)).toBe(obj);
        const arr = [];
        expect(escapeHTML(arr)).toBe(arr);
        const fn = () => {};
        expect(escapeHTML(fn)).toBe(fn);
    });

    it('should handle an empty string', () => {
        expect(escapeHTML('')).toBe('');
    });
});
