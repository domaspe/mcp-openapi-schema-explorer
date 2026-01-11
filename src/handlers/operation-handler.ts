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
  getValidatedOperations,
} from './handler-utils.js';

const BASE_URI = 'openapi://';

/**
 * Handles requests for specific operation details within a path.
 * Corresponds to the `openapi://{specId}/paths/{path}/{method*}` template.
 */
export class OperationHandler {
  constructor(
    private specManager: SpecManagerService,
    private formatter: IFormatter
  ) {}

  getTemplate(): ResourceTemplate {
    // TODO: Add completion logic if needed
    return new ResourceTemplate(`${BASE_URI}paths/{path}/{method*}`, {
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
    const methodVar = variables['method'];
    const decodedPath = decodeURIComponent(encodedPath || '');
    const pathUriSuffix = buildPathItemUriSuffix(decodedPath);
    const context: RenderContext = { formatter: this.formatter, baseUri: BASE_URI, specId };
    let resultItems: RenderResultItem[];

    try {
      let methods: string[] = [];
      if (Array.isArray(methodVar)) {
        methods = methodVar.map(m => String(m).trim().toLowerCase());
      } else if (typeof methodVar === 'string') {
        methods = [methodVar.trim().toLowerCase()];
      }
      methods = methods.filter(m => m.length > 0);

      if (methods.length === 0) {
        throw new Error('No valid HTTP method specified.');
      }

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
      const validMethods = getValidatedOperations(pathItemObj, methods, lookupPath);

      const renderablePathItem = new RenderablePathItem(pathItemObj, lookupPath, pathUriSuffix);

      resultItems = renderablePathItem.renderOperationDetail(context, validMethods);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error handling request ${uri.href}: ${message}`);
      // Use pathUriSuffix with method appended for error context (without specId - formatResults adds it)
      const errorSuffix = methodVar
        ? `${pathUriSuffix}/${Array.isArray(methodVar) ? methodVar.join(',') : methodVar}`
        : pathUriSuffix;
      resultItems = createErrorResult(errorSuffix, message);
    }

    const contents = formatResults(context, resultItems);
    return { contents };
  };
}
