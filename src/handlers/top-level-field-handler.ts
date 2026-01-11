import {
  ReadResourceTemplateCallback,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';

import { SpecManagerService } from '../services/spec-manager.js';
import { IFormatter } from '../services/formatters.js';
import { RenderableDocument } from '../rendering/document.js';
import { RenderablePaths } from '../rendering/paths.js';
import { RenderableComponents } from '../rendering/components.js';
import { RenderContext, RenderResultItem } from '../rendering/types.js';
import { createErrorResult } from '../rendering/utils.js';
import { formatResults, isOpenAPIV3, FormattedResultItem } from './handler-utils.js';

const BASE_URI = 'openapi://';

/**
 * Handles requests for top-level OpenAPI fields (info, servers, paths list, components list).
 * Corresponds to the `openapi://{specId}/{field}` template.
 */
export class TopLevelFieldHandler {
  constructor(
    private specManager: SpecManagerService,
    private formatter: IFormatter
  ) {}

  getTemplate(): ResourceTemplate {
    // TODO: Add completion logic if needed
    return new ResourceTemplate(`${BASE_URI}{field}`, {
      list: undefined,
      complete: undefined,
    });
  }

  handleRequest: ReadResourceTemplateCallback = async (
    uri: URL,
    variables: Variables
  ): Promise<{ contents: FormattedResultItem[] }> => {
    const specId = variables.specId as string;
    const field = variables.field as string;
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

      const renderableDoc = new RenderableDocument(spec);

      if (field === 'paths') {
        const pathsObj = renderableDoc.getPathsObject();
        resultItems = new RenderablePaths(pathsObj).renderList(context);
      } else if (field === 'components') {
        const componentsObj = renderableDoc.getComponentsObject();
        resultItems = new RenderableComponents(componentsObj).renderList(context);
      } else {
        const fieldObject = renderableDoc.getTopLevelField(field);
        resultItems = renderableDoc.renderTopLevelFieldDetail(context, fieldObject, field);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error handling request ${uri.href}: ${message}`);
      resultItems = createErrorResult(field, message);
    }

    const contents: FormattedResultItem[] = formatResults(context, resultItems);
    return { contents };
  };

  // Removed duplicated isOpenAPIV3 type guard - now imported from handler-utils
} // Ensure class closing brace is present
