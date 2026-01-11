/**
 * Configuration management for the OpenAPI Explorer MCP server
 */

import { OutputFormat } from './services/formatters.js';

/** Server configuration */
export interface ServerConfig {
  /** Paths to OpenAPI specification files */
  specPaths: string[];
  /** Output format for responses */
  outputFormat: OutputFormat;
}

/** Load server configuration from command line arguments */
export function loadConfig(
  specPaths?: string[],
  options?: { outputFormat?: string }
): ServerConfig {
  if (!specPaths || specPaths.length === 0) {
    throw new Error(
      'At least one OpenAPI spec path is required. Usage: npx mcp-openapi-schema-explorer <spec1> [spec2...] [--output-format json|yaml]'
    );
  }

  const format = options?.outputFormat || 'json';
  if (format !== 'json' && format !== 'yaml' && format !== 'json-minified') {
    throw new Error('Invalid output format. Supported formats: json, yaml, json-minified');
  }

  return {
    specPaths,
    outputFormat: format as OutputFormat,
  };
}
