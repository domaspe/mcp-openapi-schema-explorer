/**
 * Utility functions for building standardized MCP URIs for this server.
 */

const BASE_URI_SCHEME = 'openapi://';

/**
 * Encodes a string component for safe inclusion in a URI path segment.
 * Uses standard encodeURIComponent.
 * Encodes a path string for safe inclusion in a URI.
 * This specifically targets path strings which might contain characters
 * like '{', '}', etc., that need encoding when forming the URI path part.
 * Uses standard encodeURIComponent.
 * Encodes a path string for safe inclusion in a URI path segment.
 * This is necessary because the path segment comes from the user potentially
 * containing characters that need encoding (like '{', '}').
 * Uses standard encodeURIComponent.
 * @param path The path string to encode.
 * @returns The encoded path string, with leading slashes removed before encoding.
 */
export function encodeUriPathComponent(path: string): string {
  // Added export
  // Remove leading slashes before encoding
  const pathWithoutLeadingSlash = path.replace(/^\/+/, '');
  return encodeURIComponent(pathWithoutLeadingSlash);
}

// --- Full URI Builders ---

/**
 * Builds the URI for accessing a specific component's details.
 * Example: openapi://my-api/components/schemas/MySchema
 * @param specId The spec identifier slug.
 * @param type The component type (e.g., 'schemas', 'responses').
 * @param name The component name.
 * @returns The full component detail URI.
 */
export function buildComponentDetailUri(specId: string, type: string, name: string): string {
  return `${BASE_URI_SCHEME}${specId}/components/${type}/${name}`;
}

/**
 * Builds the URI for listing components of a specific type.
 * Example: openapi://my-api/components/schemas
 * @param specId The spec identifier slug.
 * @param type The component type (e.g., 'schemas', 'responses').
 * @returns The full component map URI.
 */
export function buildComponentMapUri(specId: string, type: string): string {
  return `${BASE_URI_SCHEME}${specId}/components/${type}`;
}

/**
 * Builds the URI for accessing a specific operation's details.
 * Example: openapi://my-api/paths/users/{userId}/get
 * @param specId The spec identifier slug.
 * @param path The API path (e.g., '/users/{userId}').
 * @param method The HTTP method (e.g., 'GET', 'POST').
 * @returns The full operation detail URI.
 */
export function buildOperationUri(specId: string, path: string, method: string): string {
  return `${BASE_URI_SCHEME}${specId}/paths/${encodeUriPathComponent(path)}/${method.toLowerCase()}`;
}

/**
 * Builds the URI for listing methods available at a specific path.
 * Example: openapi://my-api/paths/users/{userId}
 * @param specId The spec identifier slug.
 * @param path The API path (e.g., '/users/{userId}').
 * @returns The full path item URI.
 */
export function buildPathItemUri(specId: string, path: string): string {
  return `${BASE_URI_SCHEME}${specId}/paths/${encodeUriPathComponent(path)}`;
}

/**
 * Builds the URI for accessing a top-level field (like 'info' or 'servers')
 * or triggering a list view ('paths', 'components').
 * Example: openapi://my-api/info, openapi://my-api/paths
 * @param specId The spec identifier slug.
 * @param field The top-level field name.
 * @returns The full top-level field URI.
 */
export function buildTopLevelFieldUri(specId: string, field: string): string {
  return `${BASE_URI_SCHEME}${specId}/${field}`;
}

// --- URI Suffix Builders (for RenderResultItem) ---
// Note: These do NOT include specId - formatResults adds the specId prefix

/**
 * Builds the URI suffix for a specific component's details.
 * Example: components/schemas/MySchema
 */
export function buildComponentDetailUriSuffix(type: string, name: string): string {
  return `components/${type}/${name}`;
}

/**
 * Builds the URI suffix for listing components of a specific type.
 * Example: components/schemas
 */
export function buildComponentMapUriSuffix(type: string): string {
  return `components/${type}`;
}

/**
 * Builds the URI suffix for a specific operation's details.
 * Example: paths/users/{userId}/get
 */
export function buildOperationUriSuffix(path: string, method: string): string {
  return `paths/${encodeUriPathComponent(path)}/${method.toLowerCase()}`;
}

/**
 * Builds the URI suffix for listing methods available at a specific path.
 * Example: paths/users/{userId}
 */
export function buildPathItemUriSuffix(path: string): string {
  return `paths/${encodeUriPathComponent(path)}`;
}

/**
 * Builds the URI suffix for a top-level field.
 * Example: info, paths
 */
export function buildTopLevelFieldUriSuffix(field: string): string {
  return field;
}
