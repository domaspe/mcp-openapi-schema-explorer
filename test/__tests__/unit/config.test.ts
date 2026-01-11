import { loadConfig } from '../../../src/config.js';

describe('Config', () => {
  describe('loadConfig', () => {
    it('returns valid configuration with default format when only path is provided', () => {
      const config = loadConfig(['/path/to/spec.json']);
      expect(config).toEqual({
        specPaths: ['/path/to/spec.json'],
        outputFormat: 'json',
      });
    });

    it('returns valid configuration with multiple paths', () => {
      const config = loadConfig(['/path/to/spec1.json', '/path/to/spec2.json']);
      expect(config).toEqual({
        specPaths: ['/path/to/spec1.json', '/path/to/spec2.json'],
        outputFormat: 'json',
      });
    });

    it('returns valid configuration when paths and format are provided', () => {
      const config = loadConfig(['/path/to/spec.json'], { outputFormat: 'yaml' });
      expect(config).toEqual({
        specPaths: ['/path/to/spec.json'],
        outputFormat: 'yaml',
      });
    });

    it('throws error when invalid format is provided', () => {
      expect(() => loadConfig(['/path/to/spec.json'], { outputFormat: 'invalid' })).toThrow(
        'Invalid output format. Supported formats: json, yaml'
      );
    });

    it('throws error when paths are not provided', () => {
      expect(() => loadConfig()).toThrow('At least one OpenAPI spec path is required');
    });

    it('throws error when paths array is empty', () => {
      expect(() => loadConfig([])).toThrow('At least one OpenAPI spec path is required');
    });
  });
});
