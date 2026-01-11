import { OpenAPIV3 } from 'openapi-types';
import { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { OperationHandler } from '../../../../src/handlers/operation-handler';
import { SpecManagerService } from '../../../../src/services/spec-manager';
import { SpecLoaderService } from '../../../../src/types';
import { IFormatter, JsonFormatter } from '../../../../src/services/formatters';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { suppressExpectedConsoleError } from '../../../utils/console-helpers';

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
const getOperation: OpenAPIV3.OperationObject = {
  summary: 'Get Item',
  responses: { '200': { description: 'OK' } },
};
const postOperation: OpenAPIV3.OperationObject = {
  summary: 'Create Item',
  responses: { '201': { description: 'Created' } },
};
const sampleSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/items': {
      get: getOperation,
      post: postOperation,
    },
    '/items/{id}': {
      get: { summary: 'Get Single Item', responses: { '200': { description: 'OK' } } },
    },
  },
  components: {},
};

const SPEC_ID = 'test-api';
const encodedPathItems = encodeURIComponent('items');
const encodedPathNonExistent = encodeURIComponent('nonexistent');

describe('OperationHandler', () => {
  let handler: OperationHandler;

  beforeEach(() => {
    handler = new OperationHandler(mockSpecManager, mockFormatter);
    mockGetTransformedSpec.mockReset();
    mockGetTransformedSpec.mockResolvedValue(sampleSpec);
    (mockSpecManager.getLoader as jest.Mock).mockReturnValue(mockSpecLoader);
  });

  it('should return the correct template', () => {
    const template = handler.getTemplate();
    expect(template).toBeInstanceOf(ResourceTemplate);
    expect(template.uriTemplate.toString()).toBe('openapi://paths/{path}/{method*}');
  });

  describe('handleRequest', () => {
    const mockExtra = {
      signal: new AbortController().signal,
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
      requestId: 'test-request-id' as RequestId,
    };

    it('should return detail for a single valid method', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems, method: 'get' };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}/get`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(mockSpecManager.getLoader).toHaveBeenCalledWith(SPEC_ID);
      expect(mockGetTransformedSpec).toHaveBeenCalledWith({
        resourceType: 'schema',
        format: 'openapi',
        specId: SPEC_ID,
      });
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/get`,
        mimeType: 'application/json',
        text: JSON.stringify(getOperation, null, 2),
        isError: false,
      });
    });

    it('should return details for multiple valid methods (array input)', async () => {
      const variables: Variables = {
        specId: SPEC_ID,
        path: encodedPathItems,
        method: ['get', 'post'],
      };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}/get,post`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(2);
      expect(result.contents).toContainEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/get`,
        mimeType: 'application/json',
        text: JSON.stringify(getOperation, null, 2),
        isError: false,
      });
      expect(result.contents).toContainEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/post`,
        mimeType: 'application/json',
        text: JSON.stringify(postOperation, null, 2),
        isError: false,
      });
    });

    it('should return error for non-existent path', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathNonExistent, method: 'get' };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathNonExistent}/get`);
      const expectedLogMessage = /Path "\/nonexistent" not found/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathNonExistent}/get`,
        mimeType: 'text/plain',
        text: 'Path "/nonexistent" not found in the specification.',
        isError: true,
      });
    });

    it('should return error for non-existent method', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems, method: 'put' };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}/put`);
      const expectedLogMessage = /None of the requested methods \(put\) are valid/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/put`,
        mimeType: 'text/plain',
        text: 'None of the requested methods (put) are valid for path "/items". Available methods: get, post',
        isError: true,
      });
    });

    it('should handle empty method array', async () => {
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems, method: [] };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}/`);
      const expectedLogMessage = /No valid HTTP method specified/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/`,
        mimeType: 'text/plain',
        text: 'No valid HTTP method specified.',
        isError: true,
      });
    });

    it('should handle spec loading errors', async () => {
      const error = new Error('Spec load failed');
      mockGetTransformedSpec.mockRejectedValue(error);
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems, method: 'get' };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}/get`);
      const expectedLogMessage = /Spec load failed/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/get`,
        mimeType: 'text/plain',
        text: 'Spec load failed',
        isError: true,
      });
    });

    it('should handle non-OpenAPI v3 spec', async () => {
      const invalidSpec = { swagger: '2.0', info: {} };
      mockGetTransformedSpec.mockResolvedValue(invalidSpec as unknown as OpenAPIV3.Document);
      const variables: Variables = { specId: SPEC_ID, path: encodedPathItems, method: 'get' };
      const uri = new URL(`openapi://${SPEC_ID}/paths/${encodedPathItems}/get`);
      const expectedLogMessage = /Only OpenAPI v3 specifications are supported/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/paths/${encodedPathItems}/get`,
        mimeType: 'text/plain',
        text: 'Only OpenAPI v3 specifications are supported',
        isError: true,
      });
    });
  });
});
