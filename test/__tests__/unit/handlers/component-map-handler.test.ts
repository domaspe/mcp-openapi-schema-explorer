import { OpenAPIV3 } from 'openapi-types';
import { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { ComponentMapHandler } from '../../../../src/handlers/component-map-handler';
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
  info: { title: 'Test API', version: '1.0.0' },
  paths: {},
  components: {
    schemas: {
      User: { type: 'object', properties: { name: { type: 'string' } } },
      Error: { type: 'object', properties: { message: { type: 'string' } } },
    },
    parameters: {
      limitParam: { name: 'limit', in: 'query', schema: { type: 'integer' } },
    },
    examples: {},
  },
};

const SPEC_ID = 'test-api';

describe('ComponentMapHandler', () => {
  let handler: ComponentMapHandler;

  beforeEach(() => {
    handler = new ComponentMapHandler(mockSpecManager, mockFormatter);
    mockGetTransformedSpec.mockReset();
    mockGetTransformedSpec.mockResolvedValue(sampleSpec);
    (mockSpecManager.getLoader as jest.Mock).mockReturnValue(mockSpecLoader);
  });

  it('should return the correct template', () => {
    const template = handler.getTemplate();
    expect(template).toBeInstanceOf(ResourceTemplate);
    expect(template.uriTemplate.toString()).toBe('openapi://components/{type}');
  });

  describe('handleRequest (List Component Names)', () => {
    const mockExtra = {
      signal: new AbortController().signal,
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
      requestId: 'test-request-id' as RequestId,
    };

    it('should list names for a valid component type (schemas)', async () => {
      const variables: Variables = { specId: SPEC_ID, type: 'schemas' };
      const uri = new URL(`openapi://${SPEC_ID}/components/schemas`);

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
        uri: `openapi://${SPEC_ID}/components/schemas`,
        mimeType: 'text/plain',
        isError: false,
      });
      expect(content.text).toContain('Available schemas:');
      expect(content.text).toMatch(/-\sError\n/);
      expect(content.text).toMatch(/-\sUser\n/);
      expect(content.text).toContain(`Hint: Use 'openapi://${SPEC_ID}/components/schemas/{name}'`);
    });

    it('should list names for another valid type (parameters)', async () => {
      const variables: Variables = { specId: SPEC_ID, type: 'parameters' };
      const uri = new URL(`openapi://${SPEC_ID}/components/parameters`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0] as FormattedResultItem;
      expect(content).toMatchObject({
        uri: `openapi://${SPEC_ID}/components/parameters`,
        mimeType: 'text/plain',
        isError: false,
      });
      expect(content.text).toContain('Available parameters:');
      expect(content.text).toMatch(/-\slimitParam\n/);
      expect(content.text).toContain(
        `Hint: Use 'openapi://${SPEC_ID}/components/parameters/{name}'`
      );
    });

    it('should handle component type with no components defined (examples)', async () => {
      const variables: Variables = { specId: SPEC_ID, type: 'examples' };
      const uri = new URL(`openapi://${SPEC_ID}/components/examples`);

      const result = await handler.handleRequest(uri, variables, mockExtra);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/components/examples`,
        mimeType: 'text/plain',
        text: 'No components of type "examples" found.',
        isError: true,
      });
    });

    it('should handle component type not present in spec (securitySchemes)', async () => {
      const variables: Variables = { specId: SPEC_ID, type: 'securitySchemes' };
      const uri = new URL(`openapi://${SPEC_ID}/components/securitySchemes`);
      const expectedLogMessage = /Component type "securitySchemes" not found/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/components/securitySchemes`,
        mimeType: 'text/plain',
        text: 'Component type "securitySchemes" not found in the specification. Available types: schemas, parameters, examples',
        isError: true,
      });
    });

    it('should return error for invalid component type', async () => {
      const variables: Variables = { specId: SPEC_ID, type: 'invalidType' };
      const uri = new URL(`openapi://${SPEC_ID}/components/invalidType`);
      const expectedLogMessage = /Invalid component type: invalidType/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/components/invalidType`,
        mimeType: 'text/plain',
        text: 'Invalid component type: invalidType',
        isError: true,
      });
      expect(mockGetTransformedSpec).not.toHaveBeenCalled();
    });

    it('should handle spec loading errors', async () => {
      const error = new Error('Spec load failed');
      mockGetTransformedSpec.mockRejectedValue(error);
      const variables: Variables = { specId: SPEC_ID, type: 'schemas' };
      const uri = new URL(`openapi://${SPEC_ID}/components/schemas`);
      const expectedLogMessage = /Spec load failed/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/components/schemas`,
        mimeType: 'text/plain',
        text: 'Spec load failed',
        isError: true,
      });
    });

    it('should handle non-OpenAPI v3 spec', async () => {
      const invalidSpec = { swagger: '2.0', info: {} };
      mockGetTransformedSpec.mockResolvedValue(invalidSpec as unknown as OpenAPIV3.Document);
      const variables: Variables = { specId: SPEC_ID, type: 'schemas' };
      const uri = new URL(`openapi://${SPEC_ID}/components/schemas`);
      const expectedLogMessage = /Only OpenAPI v3 specifications are supported/;

      const result = await suppressExpectedConsoleError(expectedLogMessage, () =>
        handler.handleRequest(uri, variables, mockExtra)
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        uri: `openapi://${SPEC_ID}/components/schemas`,
        mimeType: 'text/plain',
        text: 'Only OpenAPI v3 specifications are supported',
        isError: true,
      });
    });
  });
});
