#!/usr/bin/env node
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';

import { TopLevelFieldHandler } from './handlers/top-level-field-handler.js';
import { PathItemHandler } from './handlers/path-item-handler.js';
import { OperationHandler } from './handlers/operation-handler.js';
import { ComponentMapHandler } from './handlers/component-map-handler.js';
import { ComponentDetailHandler } from './handlers/component-detail-handler.js';
import { SpecsListHandler } from './handlers/specs-list-handler.js';
import { OpenAPITransformer, ReferenceTransformService } from './services/reference-transform.js';
import { SpecManagerService } from './services/spec-manager.js';
import { createFormatter } from './services/formatters.js';
import { encodeUriPathComponent } from './utils/uri-builder.js';
import { isOpenAPIV3, getValidatedComponentMap } from './handlers/handler-utils.js';
import { VERSION } from './version.js';

async function main(): Promise<void> {
  try {
    // Parse CLI args: collect paths before --output-format
    const args = process.argv.slice(2);
    const outputFormatIndex = args.indexOf('--output-format');
    let specPaths: string[];
    let options: { outputFormat?: string } = {};

    if (outputFormatIndex === -1) {
      specPaths = args;
    } else {
      specPaths = args.slice(0, outputFormatIndex);
      options.outputFormat = args[outputFormatIndex + 1];
    }

    const config = loadConfig(specPaths, options);

    // Initialize services
    const referenceTransform = new ReferenceTransformService();
    referenceTransform.registerTransformer('openapi', new OpenAPITransformer());

    const specManager = new SpecManagerService(referenceTransform);
    await specManager.loadSpecs(config.specPaths);

    const loadedSpecs = specManager.getAllSpecs();
    const specSlugs = specManager.getSpecSlugs();

    // Server name based on loaded specs
    const serverName =
      loadedSpecs.length === 1
        ? `Schema Explorer for ${loadedSpecs[0].title}`
        : `Schema Explorer for ${loadedSpecs.length} APIs`;

    const helpContent = `OpenAPI Schema Explorer - Access multiple API specifications.

Start by reading openapi://specs to see all available APIs and their specIds.

For each API, use these URI patterns:
- openapi://{specId}/info - API metadata
- openapi://{specId}/paths - List all endpoints
- openapi://{specId}/paths/{encoded_path}/{method} - Operation details
- openapi://{specId}/components/schemas - List schemas
- openapi://{specId}/components/schemas/{name} - Schema details

The {specId} is derived from each API's title (e.g., "Catalog API" becomes "catalog-api").
Path segments must be URL-encoded (e.g., /users/{id} becomes users%2F%7Bid%7D).`;

    const server = new McpServer(
      { name: serverName, version: VERSION },
      { instructions: helpContent }
    );

    const formatter = createFormatter(config.outputFormat);

    // Initialize handlers with specManager
    const specsListHandler = new SpecsListHandler(specManager);
    const topLevelFieldHandler = new TopLevelFieldHandler(specManager, formatter);
    const pathItemHandler = new PathItemHandler(specManager, formatter);
    const operationHandler = new OperationHandler(specManager, formatter);
    const componentMapHandler = new ComponentMapHandler(specManager, formatter);
    const componentDetailHandler = new ComponentDetailHandler(specManager, formatter);

    // Helper to get paths for a specific spec
    const getSpecPaths = async (specId: string): Promise<string[]> => {
      try {
        const loader = specManager.getLoader(specId);
        const spec = await loader.getTransformedSpec({
          resourceType: 'schema',
          format: 'openapi',
          specId,
        });
        return Object.keys(spec.paths ?? {}).map(encodeUriPathComponent);
      } catch {
        return [];
      }
    };

    // Helper to get component types for a specific spec
    const getSpecComponentTypes = async (specId: string): Promise<string[]> => {
      try {
        const loader = specManager.getLoader(specId);
        const spec = await loader.getTransformedSpec({
          resourceType: 'schema',
          format: 'openapi',
          specId,
        });
        if (isOpenAPIV3(spec) && spec.components) {
          return Object.keys(spec.components);
        }
        return [];
      } catch {
        return [];
      }
    };

    // 0. openapi://specs - List all loaded specs
    server.resource(
      'openapi-specs-list',
      new ResourceTemplate('openapi://specs', { list: undefined }),
      {
        mimeType: 'text/plain',
        description: 'List all available API specifications',
        title: 'API Specs List',
      },
      specsListHandler.handleRequest
    );

    // 1. openapi://{specId}/{field}
    server.resource(
      'openapi-field',
      new ResourceTemplate('openapi://{specId}/{field}', {
        list: undefined,
        complete: {
          specId: () => specSlugs,
          field: () => ['info', 'servers', 'paths', 'components', 'tags', 'externalDocs'],
        },
      }),
      {
        description: 'Access top-level fields of a specific API spec (e.g., openapi://my-api/info)',
        title: 'OpenAPI Field',
      },
      topLevelFieldHandler.handleRequest
    );

    // 2. openapi://{specId}/paths/{path}
    server.resource(
      'openapi-path-methods',
      new ResourceTemplate('openapi://{specId}/paths/{path}', {
        list: undefined,
        complete: {
          specId: () => specSlugs,
          path: async () => {
            // Return paths from first spec for completion
            if (specSlugs.length > 0) {
              return getSpecPaths(specSlugs[0]);
            }
            return [];
          },
        },
      }),
      {
        mimeType: 'text/plain',
        description:
          'List methods for a specific path (e.g., openapi://my-api/paths/users%2F%7Bid%7D)',
        title: 'Path Methods List',
      },
      pathItemHandler.handleRequest
    );

    // 3. openapi://{specId}/paths/{path}/{method*}
    server.resource(
      'openapi-operation-detail',
      new ResourceTemplate('openapi://{specId}/paths/{path}/{method*}', {
        list: undefined,
        complete: {
          specId: () => specSlugs,
          path: async () => {
            if (specSlugs.length > 0) {
              return getSpecPaths(specSlugs[0]);
            }
            return [];
          },
          method: () => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'TRACE'],
        },
      }),
      {
        mimeType: formatter.getMimeType(),
        description:
          'Get details for operations (e.g., openapi://my-api/paths/users%2F%7Bid%7D/get,post)',
        title: 'Operation Detail',
      },
      operationHandler.handleRequest
    );

    // 4. openapi://{specId}/components/{type}
    server.resource(
      'openapi-component-list',
      new ResourceTemplate('openapi://{specId}/components/{type}', {
        list: undefined,
        complete: {
          specId: () => specSlugs,
          type: async () => {
            if (specSlugs.length > 0) {
              return getSpecComponentTypes(specSlugs[0]);
            }
            return [];
          },
        },
      }),
      {
        mimeType: 'text/plain',
        description:
          'List components of a specific type (e.g., openapi://my-api/components/schemas)',
        title: 'Component List',
      },
      componentMapHandler.handleRequest
    );

    // 5. openapi://{specId}/components/{type}/{name*}
    server.resource(
      'openapi-component-detail',
      new ResourceTemplate('openapi://{specId}/components/{type}/{name*}', {
        list: undefined,
        complete: {
          specId: () => specSlugs,
          type: async () => {
            if (specSlugs.length > 0) {
              return getSpecComponentTypes(specSlugs[0]);
            }
            return [];
          },
          name: async () => {
            // Only provide name completions if single spec with single component type
            if (specSlugs.length === 1) {
              try {
                const loader = specManager.getLoader(specSlugs[0]);
                const spec = await loader.getTransformedSpec({
                  resourceType: 'schema',
                  format: 'openapi',
                  specId: specSlugs[0],
                });
                if (isOpenAPIV3(spec) && spec.components) {
                  const types = Object.keys(spec.components);
                  if (types.length === 1) {
                    const componentMap = getValidatedComponentMap(spec, types[0]);
                    return Object.keys(componentMap);
                  }
                }
              } catch {
                return [];
              }
            }
            return [];
          },
        },
      }),
      {
        mimeType: formatter.getMimeType(),
        description: 'Get component details (e.g., openapi://my-api/components/schemas/User,Task)',
        title: 'Component Detail',
      },
      componentDetailHandler.handleRequest
    );

    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error(
      'Failed to start server:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
