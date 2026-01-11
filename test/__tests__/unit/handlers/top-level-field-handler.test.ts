import { OpenAPIV3 } from 'openapi-types';
import { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { TopLevelFieldHandler } from '../../../../src/handlers/top-level-field-handler';
import { SpecManagerService } from '../../../../src/services/spec-manager';
import { SpecLoaderService } from '../../../../src/types';
import { IFormatter, JsonFormatter } from '../../../../src/services/formatters';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { suppressExpectedConsoleError } from '../../../utils/console-helpers';
import { FormattedResultItem } from '../../../../src/handlers/handler-utils';

// Mocks
const mockGetTransformedSpec = jest.fn();
const mockSpecLoader: SpecLoaderService = {
  getSpec: jest.fn(),
  getTransformedSpec: mockGetTransformedSpec,
};

const mockSpecManager = {
  getLoader: jest.fn().mockReturnValue(mockSpecLoader),
  getAllSpecs: jest.fn(),
  getSpecSlugs: jest.fn(),
  getSpec: jest.fn(),
} as unknown as SpecManagerService;

const mockFormatter: IFormatter = new JsonFormatter();

// Sample Data
const sampleSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.1.0' },
  paths: { '/test': { get: { responses: { '200': { description: 'OK' } } } } },
  components: { schemas: { Test: { type: 'string' } } },
  servers: [{ url: 'http://example.com' }],
};

const SPEC_ID = 'test-api';

describe('TopLevelFieldHandler', () => {
  let handler: TopLevelFieldHandler;

  beforeEach(() => {
    handler = new TopLevelFieldHandler(mockSpecManager, mockFormatter);
    mockGetTransformedSpec.mockReset();
    (mockSpecManager.getLoader as jest.Mock).mockReturnValue(mockSpecLoader);
  });

  it('should return the correct template', () => {
    const template = handler.getTemplate();
    expect(template).toBeInstanceOf(ResourceTemplate);
    expect(template.uriTemplate.toString()).toBe('openapi://{field}');
  });

  describe('handleRequest', () => {
    const mockExtra = {
      signal: new AbortController().signal,
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
      requestId: 'test-request-id' as RequestId,
    };

    it('should handle request for "info" field', async () => {
      mockGetTransformedSpec.mockResolvedValue(sampleSpec);
      const variables: Variables = { specId: SPEC_ID, field: 'info' };
      const uri = new URL(`openapi://${SPEC_ID}/info`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(mockSpecManager.getLoader).toHaveBeenCalledWith(SPEC_ID);
      expect(mockGetTransformedSpec).toHaveBeenCalledWith({
        resourceType: 'schema',
        format: 'openapi',
        specId: SPEC_ID,
      });
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/info`,
        mimeType: 'application/json',
        text: JSON.stringify(sampleSpec.info, null, 2),
        isError: false,
      });
    });

    it('should handle request for "servers" field', async () => {
      mockGetTransformedSpec.mockResolvedValue(sampleSpec);
      const variables: Variables = { specId: SPEC_ID, field: 'servers' };
      const uri = new URL(`openapi://${SPEC_ID}/servers`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/servers`,
        mimeType: 'application/json',
        text: JSON.stringify(sampleSpec.servers, null, 2),
        isError: false,
      });
    });

    it('should handle request for "paths" field (list view)', async () => {
      mockGetTransformedSpec.mockResolvedValue(sampleSpec);
      const variables: Variables = { specId: SPEC_ID, field: 'paths' };
      const uri = new URL(`openapi://${SPEC_ID}/paths`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0] as FormattedResultItem;
      expect(content.uri).toBe(`openapi://${SPEC_ID}/paths`);
      expect(content.mimeType).toBe('text/plain');
      expect(content.isError).toBe(false);
      expect(content.text).toContain('GET /test');
      expect(content.text).toContain('Hint:');
      expect(content.text).toContain(`openapi://${SPEC_ID}/paths/{encoded_path}`);
      expect(content.text).toContain(`openapi://${SPEC_ID}/paths/{encoded_path}/{method}`);
    });

    it('should handle request for "components" field (list view)', async () => {
      mockGetTransformedSpec.mockResolvedValue(sampleSpec);
      const variables: Variables = { specId: SPEC_ID, field: 'components' };
      const uri = new URL(`openapi://${SPEC_ID}/components`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0] as FormattedResultItem;
      expect(content.uri).toBe(`openapi://${SPEC_ID}/components`);
      expect(content.mimeType).toBe('text/plain');
      expect(content.isError).toBe(false);
      expect(content.text).toContain('- schemas');
      expect(content.text).toContain(`Hint: Use 'openapi://${SPEC_ID}/components/{type}'`);
    });

    it('should return error for non-existent field', async () => {
      mockGetTransformedSpec.mockResolvedValue(sampleSpec);
      const variables: Variables = { specId: SPEC_ID, field: 'nonexistent' };
      const uri = new URL(`openapi://${SPEC_ID}/nonexistent`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/nonexistent`,
        mimeType: 'text/plain',
        text: 'Error: Field "nonexistent" not found in the OpenAPI document.',
        isError: true,
      });
    });

    it('should handle spec loading errors', async () => {
      const error = new Error('Failed to load spec');
      mockGetTransformedSpec.mockRejectedValue(error);
      const variables: Variables = { specId: SPEC_ID, field: 'info' };
      const uri = new URL(`openapi://${SPEC_ID}/info`);
      const expectedLogMessage = /Failed to load spec/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/info`,
        mimeType: 'text/plain',
        text: 'Failed to load spec',
        isError: true,
      });
    });

    it('should handle non-OpenAPI v3 spec', async () => {
      const invalidSpec = { swagger: '2.0', info: {} };
      mockGetTransformedSpec.mockResolvedValue(invalidSpec as unknown as OpenAPIV3.Document);
      const variables: Variables = { specId: SPEC_ID, field: 'info' };
      const uri = new URL(`openapi://${SPEC_ID}/info`);
      const expectedLogMessage = /Only OpenAPI v3 specifications are supported/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/info`,
        mimeType: 'text/plain',
        text: 'Only OpenAPI v3 specifications are supported',
        isError: true,
      });
    });
  });
});
