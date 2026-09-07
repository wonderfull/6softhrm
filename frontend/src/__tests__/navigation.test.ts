import { describe, it, expect } from 'vitest';
import { safeInternalPath } from '../lib/navigation';

// The router's own open-redirect advisory only bites when a navigation target
// comes from outside. Nothing in this app passes one today; this keeps it that
// way if someone later adds a ?next= parameter.
describe('safeInternalPath', () => {
  it('allows an ordinary internal path', () => {
    expect(safeInternalPath('/leave')).toBe('/leave');
    expect(safeInternalPath('/employees?id=5')).toBe('/employees?id=5');
    expect(safeInternalPath('/documents#top')).toBe('/documents#top');
  });

  it('refuses anything that leaves the origin', () => {
    for (const target of [
      '//evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'https://evil.example',
      'http://evil.example',
      '//evil.example/path',
    ]) {
      expect(safeInternalPath(target), target).toBeNull();
    }
  });

  it('refuses a scheme that executes', () => {
    expect(safeInternalPath('javascript:alert(1)')).toBeNull();
    expect(safeInternalPath('data:text/html,<script>')).toBeNull();
  });

  it('refuses a relative path, which resolves against the current route', () => {
    expect(safeInternalPath('leave')).toBeNull();
    expect(safeInternalPath('../admin')).toBeNull();
  });

  it('refuses nothing at all', () => {
    expect(safeInternalPath('')).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });
});
