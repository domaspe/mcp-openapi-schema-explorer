import {
  ReadResourceTemplateCallback,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { SpecManagerService } from '../services/spec-manager.js';
import { IFormatter } from '../services/formatters.js';
import {
  RenderableComponentMap,
  ComponentType,
  VALID_COMPONENT_TYPES,
} from '../rendering/components.js';
import { RenderContext, RenderResultItem } from '../rendering/types.js';
import { createErrorResult } from '../rendering/utils.js';
import {
  formatResults,
  isOpenAPIV3,
  FormattedResultItem,
  getValidatedComponentMap,
  getValidatedComponentDetails,
} from './handler-utils.js';

const BASE_URI = 'openapi://';

/**
 * Handles requests for specific component details.
 * Corresponds to the `openapi://{specId}/components/{type}/{name*}` template.
 */
export class ComponentDetailHandler {
  constructor(
    private specManager: SpecManagerService,
    private formatter: IFormatter
  ) {}

  getTemplate(): ResourceTemplate {
    // TODO: Add completion logic if needed
    return new ResourceTemplate(`${BASE_URI}components/{type}/{name*}`, {
      list: undefined,
      complete: undefined,
    });
  }

  handleRequest: ReadResourceTemplateCallback = async (
    uri: URL,
    variables: Variables
  ): Promise<{ contents: FormattedResultItem[] }> => {
    const specId = variables.specId as string;
    const type = variables.type as string;
    const nameVar = variables['name'];
    const mapUriSuffix = `components/${type}`;
    const context: RenderContext = { formatter: this.formatter, baseUri: BASE_URI, specId };
    let resultItems: RenderResultItem[];

    try {
      if (!VALID_COMPONENT_TYPES.includes(type as ComponentType)) {
        throw new Error(`Invalid component type: ${type}`);
      }
      const componentType = type as ComponentType;

      let names: string[] = [];
      if (Array.isArray(nameVar)) {
        names = nameVar.map(n => String(n).trim());
      } else if (typeof nameVar === 'string') {
        names = [nameVar.trim()];
      }
      names = names.filter(n => n.length > 0);

      if (names.length === 0) {
        throw new Error('No valid component name specified.');
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

      const componentMapObj = getValidatedComponentMap(spec, componentType);
      const detailsMap = new Map(Object.entries(componentMapObj));
      const validDetails = getValidatedComponentDetails(detailsMap, names, componentType);
      const validNames = validDetails.map(detail => detail.name);

      const renderableMap = new RenderableComponentMap(
        componentMapObj,
        componentType,
        mapUriSuffix
      );
      resultItems = renderableMap.renderComponentDetail(context, validNames);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error handling request ${uri.href}: ${message}`);
      // Use mapUriSuffix with names appended for error context (without specId - formatResults adds it)
      const errorSuffix = nameVar
        ? `${mapUriSuffix}/${Array.isArray(nameVar) ? nameVar.join(',') : nameVar}`
        : mapUriSuffix;
      resultItems = createErrorResult(errorSuffix, message);
    }

    const contents = formatResults(context, resultItems);
    return { contents };
  };
}
