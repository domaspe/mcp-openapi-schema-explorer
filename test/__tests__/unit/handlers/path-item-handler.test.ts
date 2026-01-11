import { OpenAPIV3 } from 'openapi-types';
import { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { PathItemHandler } from '../../../../src/handlers/path-item-handler';
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
const samplePathItem: OpenAPIV3.PathItemObject = {
  get: { summary: 'Get Item', responses: { '200': { description: 'OK' } } },
  post: { summary: 'Create Item', responses: { '201': { description: 'Created' } } },
};
const sampleSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/items': samplePathItem,
    '/empty': {},
  },
  components: {},
};

const SPEC_ID = 'test-api';
const encodedPathItems = encodeURIComponent('items');
const encodedPathEmpty = encodeURIComponent('empty');
const encodedPathNonExistent = encodeURIComponent('nonexistent');

describe('PathItemHandler', () => {
  let handler: PathItemHandler;

  beforeEach(() => {
    handler = new PathItemHandler(mockSpecManager, mockFormatter);
    mockGetTransformedSpec.mockReset();
    mockGetTransformedSpec.mockResolvedValue(sampleSpec);
    (mockSpecManager.getLoader as jest.Mock).mockReturnValue(mockSpecLoader);
  });

  it('should return the correct template', () => {
    const template = handler.getTemplate();
    expect(template).toBeInstanceOf(ResourceTemplate);
    expect(template.uriTemplate.toString()).toBe('openapi://paths/{path}');
  });

  describe('handleRequest (List Methods)', () => {
    const mockExtra = {
      signal: new AbortController().signal,
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
      requestId: 'test-request-id' as RequestId,
    };

    it('should list methods for a valid path', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(mockSpecManager.getLoader).toHaveBeenCalledWith(SPEC_ID);
      expect(mockGetTransformedSpec).toHaveBeenCalledWith({
        resourceType: 'schema',
        format: 'openapi',
        specId: SPEC_ID,
      });
      expect(result.contents).toHaveLength(1);
      const content = result.contents[0] as FormattedResultItem;
      expect(content).toMatchObject({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}`,
        mimeType: 'text/plain',
        isError: false,
      });
      expect(content.text).toContain(`Hint: Use 'openapi://${SPEC_ID}/paths/items/{method}'`);
      expect(content.text).toContain('GET: Get Item');
      expect(content.text).toContain('POST: Create Item');
      expect(content.text).not.toContain('Methods for items:');
    });

    it('should handle path with no methods', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathEmpty };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathEmpty}`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathEmpty}`,
        mimeType: 'text/plain',
        text: 'No standard HTTP methods found for path: empty',
        isError: false,
      });
    });

    it('should return error for non-existent path', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathNonExistent };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathNonExistent}`);
      const expectedLogMessage = /Path "\/nonexistent" not found/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathNonExistent}`,
        mimeType: 'text/plain',
        text: 'Path "/nonexistent" not found in the specification.',
        isError: true,
      });
    });

    it('should handle spec loading errors', async () => {
      const error = new Error('Spec load failed');
      mockGetTransformedSpec.mockRejectedValue(error);
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}`);
      const expectedLogMessage = /Spec load failed/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}`,
        mimeType: 'text/plain',
        text: 'Spec load failed',
        isError: true,
      });
    });

    it('should handle non-OpenAPI v3 spec', async () => {
      const invalidSpec = { swagger: '2.0', info: {} };
      mockGetTransformedSpec.mockResolvedValue(invalidSpec as unknown as OpenAPIV3.Document);
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}`);
      const expectedLogMessage = /Only OpenAPI v3 specifications are supported/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}`,
        mimeType: 'text/plain',
        text: 'Only OpenAPI v3 specifications are supported',
        isError: true,
      });
    });
  });
});
