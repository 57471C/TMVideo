// Mock DOM objects before requiring ui/utils.js
global.HTMLMediaElement = { prototype: {} };
Object.defineProperty(global.HTMLMediaElement.prototype, 'src', {
  get: () => {},
  set: () => {},
  configurable: true,
});
global.Element = { prototype: { setAttribute: jest.fn() } };
global.window = {
  activeOptimizations: new Set(),
  __TAURI__: {}
};
global.document = {
  getElementById: jest.fn()
};

const { sanitizeFilename } = require('../../ui/utils.js');

describe('sanitizeFilename', () => {
  it('should return the original string if it contains no invalid characters', () => {
    expect(sanitizeFilename('valid_filename_123')).toBe('valid_filename_123');
  });

  it('should replace invalid characters (<>:"/\\|?*) with underscores', () => {
    expect(sanitizeFilename('my<invalid>file:name"with/slashes\\and|pipes?and*stars')).toBe('my_invalid_file_name_with_slashes_and_pipes_and_stars');
  });

  it('should replace control characters (\\x00-\\x1F) with underscores', () => {
    expect(sanitizeFilename('file\x00name\x1Ftest')).toBe('file_name_test');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(sanitizeFilename('  padded_filename  ')).toBe('padded_filename');
  });

  it('should return an empty string for non-string inputs', () => {
    expect(sanitizeFilename(null)).toBe('');
    expect(sanitizeFilename(undefined)).toBe('');
    expect(sanitizeFilename(123)).toBe('');
    expect(sanitizeFilename({})).toBe('');
    expect(sanitizeFilename([])).toBe('');
  });

  it('should return an empty string if the input is an empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});
