import { ReadResourceTemplateCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { SpecManagerService } from '../services/spec-manager.js';
import { FormattedResultItem } from './handler-utils.js';

const BASE_URI = 'openapi://';

/**
 * Handles requests for listing all loaded OpenAPI specs.
 * Corresponds to the `openapi://specs` resource.
 */
export class SpecsListHandler {
  constructor(private specManager: SpecManagerService) {}

  handleRequest: ReadResourceTemplateCallback = async (
    _uri: URL,
    _variables: Variables
  ): Promise<{ contents: FormattedResultItem[] }> => {
    const specs = this.specManager.getAllSpecs();

    const lines = specs.map(spec => {
      const parts = [`## ${spec.slug}`];
      parts.push(`Title: ${spec.title}`);
      if (spec.description) {
        // Truncate long descriptions
        const desc =
          spec.description.length > 200 ? spec.description.slice(0, 200) + '...' : spec.description;
        parts.push(`Description: ${desc}`);
      }
      if (spec.version) {
        parts.push(`Version: ${spec.version}`);
      }
      parts.push(`Paths: ${spec.pathCount} endpoints`);
      return parts.join('\n');
    });

    return {
      contents: [
        {
          uri: `${BASE_URI}specs`,
          mimeType: 'text/plain',
          text: lines.join('\n\n'),
        },
      ],
    };
  };
}
