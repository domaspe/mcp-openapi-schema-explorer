// NOTE: This block replaces the previous import block to ensure types/interfaces are defined correctly.
import { OpenAPIV3 } from 'openapi-types';
import { RenderContext, RenderResultItem } from './types.js'; // Add .js
import {
  buildComponentDetailUriSuffix,
  buildComponentMapUriSuffix,
  buildOperationUriSuffix,
  // buildPathItemUriSuffix, // Not currently used by generateListHint
} from '../utils/uri-builder.js'; // Added .js extension

// Define possible types for list items to guide hint generation
type ListItemType = 'componentType' | 'componentName' | 'pathMethod';

// Define context needed for generating the correct detail URI suffix
interface HintContext {
  itemType: ListItemType;
  firstItemExample?: string; // Example value from the first item in the list
  // For componentName hints, the parent component type is needed
  parentComponentType?: string;
  // For pathMethod hints, the parent path is needed
  parentPath?: string;
}

/**
 * Safely retrieves the summary from an Operation object.
 * Handles cases where the operation might be undefined or lack a summary.
 *
 * @param operation - The Operation object or undefined.
 * @returns The operation summary or operationId string, truncated if necessary, or null if neither is available.
 */
export function getOperationSummary(
  operation: OpenAPIV3.OperationObject | undefined
): string | null {
  // Return summary or operationId without truncation
  return operation?.summary || operation?.operationId || null;
}

/**
 * Helper to generate a standard hint text for list views, using the centralized URI builders.
 * @param renderContext - The rendering context containing the base URI.
 * @param hintContext - Context about the type of items being listed and their parent context.
 * @returns The hint string.
 */
export function generateListHint(renderContext: RenderContext, hintContext: HintContext): string {
  let detailUriSuffixPattern: string;
  let itemTypeName: string;
  let exampleUriSuffix: string | undefined;
  const specIdPrefix = renderContext.specId ? `${renderContext.specId}/` : '';

  switch (hintContext.itemType) {
    case 'componentType':
      detailUriSuffixPattern = `${specIdPrefix}${buildComponentMapUriSuffix('{type}')}`;
      itemTypeName = 'component type';
      if (hintContext.firstItemExample) {
        exampleUriSuffix = `${specIdPrefix}${buildComponentMapUriSuffix(hintContext.firstItemExample)}`;
      }
      break;
    case 'componentName':
      if (!hintContext.parentComponentType) {
        console.warn('generateListHint called for componentName without parentComponentType');
        return '';
      }
      detailUriSuffixPattern = `${specIdPrefix}${buildComponentDetailUriSuffix(
        hintContext.parentComponentType,
        '{name}'
      )}`;
      itemTypeName = hintContext.parentComponentType.slice(0, -1);
      if (hintContext.firstItemExample) {
        exampleUriSuffix = `${specIdPrefix}${buildComponentDetailUriSuffix(
          hintContext.parentComponentType,
          hintContext.firstItemExample
        )}`;
      }
      break;
    case 'pathMethod':
      if (!hintContext.parentPath) {
        console.warn('generateListHint called for pathMethod without parentPath');
        return '';
      }
      detailUriSuffixPattern = `${specIdPrefix}${buildOperationUriSuffix(hintContext.parentPath, '{method}')}`;
      itemTypeName = 'operation';
      if (hintContext.firstItemExample) {
        exampleUriSuffix = `${specIdPrefix}${buildOperationUriSuffix(
          hintContext.parentPath,
          hintContext.firstItemExample
        )}`;
      }
      break;
    default:
      console.warn(`Unknown itemType in generateListHint: ${String(hintContext.itemType)}`);
      return '';
  }

  // Construct the full hint URI pattern using the base URI
  const fullHintPattern = `${renderContext.baseUri}${detailUriSuffixPattern}`;
  const fullExampleUri = exampleUriSuffix
    ? `${renderContext.baseUri}${exampleUriSuffix}`
    : undefined;

  let hintText = `\nHint: Use '${fullHintPattern}' to view details for a specific ${itemTypeName}.`;
  if (fullExampleUri) {
    hintText += ` (e.g., ${fullExampleUri})`;
  }

  return hintText;
}

/**
 * Helper to generate a standard error item for RenderResultItem arrays.
 * @param uriSuffix - The URI suffix for the error context.
 * @param message - The error message.
 * @returns A RenderResultItem array containing the error.
 */
export function createErrorResult(uriSuffix: string, message: string): RenderResultItem[] {
  return [
    {
      uriSuffix: uriSuffix,
      data: null,
      isError: true,
      errorText: message,
      renderAsList: true, // Errors are typically plain text
    },
  ];
}
