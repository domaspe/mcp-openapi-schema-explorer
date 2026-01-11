import {
  ReadResourceTemplateCallback,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { SpecManagerService } from '../services/spec-manager.js';
import { IFormatter } from '../services/formatters.js';
import { RenderablePathItem } from '../rendering/path-item.js';
import { RenderContext, RenderResultItem } from '../rendering/types.js';
import { createErrorResult } from '../rendering/utils.js';
import { buildPathItemUriSuffix } from '../utils/uri-builder.js';
import {
  formatResults,
  isOpenAPIV3,
  FormattedResultItem,
  getValidatedPathItem,
} from './handler-utils.js';

const BASE_URI = 'openapi://';

/**
 * Handles requests for listing methods for a specific path.
 * Corresponds to the `openapi://{specId}/paths/{path}` template.
 */
export class PathItemHandler {
  constructor(
    private specManager: SpecManagerService,
    private formatter: IFormatter
  ) {}

  getTemplate(): ResourceTemplate {
    // TODO: Add completion logic if needed
    return new ResourceTemplate(`${BASE_URI}paths/{path}`, {
      list: undefined,
      complete: undefined,
    });
  }

  handleRequest: ReadResourceTemplateCallback = async (
    uri: URL,
    variables: Variables
  ): Promise<{ contents: FormattedResultItem[] }> => {
    const specId = variables.specId as string;
    const encodedPath = variables.path as string;
    const decodedPath = decodeURIComponent(encodedPath || '');
    const pathUriSuffix = buildPathItemUriSuffix(decodedPath);
    const context: RenderContext = { formatter: this.formatter, baseUri: BASE_URI, specId };
    let resultItems: RenderResultItem[];

    try {
      const loader = this.specManager.getLoader(specId);
      const spec = await loader.getTransformedSpec({
        resourceType: 'schema',
        format: 'openapi',
        specId,
      });

      if (!isOpenAPIV3(spec)) {
        throw new Error('Only OpenAPI v3 specifications are supported');
      }

      const lookupPath = decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
      const pathItemObj = getValidatedPathItem(spec, lookupPath);

      const renderablePathItem = new RenderablePathItem(pathItemObj, lookupPath, pathUriSuffix);
      resultItems = renderablePathItem.renderList(context);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error handling request ${uri.href}: ${message}`);
      resultItems = createErrorResult(pathUriSuffix, message);
    }

    const contents = formatResults(context, resultItems);
    return { contents };
  };
}
