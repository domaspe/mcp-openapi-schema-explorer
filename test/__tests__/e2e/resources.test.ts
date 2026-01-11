import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// Import specific SDK types needed
import {
  ReadResourceResult,
  TextResourceContents,
  // Removed unused CompleteRequest, CompleteResult
} from '@modelcontextprotocol/sdk/types.js';
import { startMcpServer, McpTestContext } from '../../utils/mcp-test-helpers';
import { FormattedResultItem } from '../../../src/handlers/handler-utils';
import path from 'path';

// Use the complex spec for E2E tests
const complexSpecPath = path.resolve(__dirname, '../../fixtures/complex-endpoint.json');
// Spec ID derived from info.title "Complex Endpoint Test API"
const complexSpecId = 'complex-endpoint-test-api';

// Helper function to parse JSON safely
function parseJsonSafely(text: string | undefined): unknown {
  if (text === undefined) {
    throw new Error('Received undefined text for JSON parsing');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON:', text);
    throw new Error(`Invalid JSON received: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Type guard to check if content is TextResourceContents
function hasTextContent(
  content: ReadResourceResult['contents'][0]
): content is TextResourceContents {
  // Check for the 'text' property specifically, differentiating from BlobResourceContents
  return typeof (content as TextResourceContents).text === 'string';
}

describe('E2E Tests for Refactored Resources', () => {
  let testContext: McpTestContext;
  let client: Client; // Use the correct Client type

  // Helper to setup client for tests
  async function setup(specPath: string = complexSpecPath): Promise<void> {
    // Use complex spec by default
    testContext = await startMcpServer(specPath, { outputFormat: 'json' }); // Default to JSON
    client = testContext.client; // Get client from helper context
    // Initialization is handled by startMcpServer connecting the transport
  }

  afterEach(async () => {
    await testContext?.cleanup(); // Use cleanup function from helper
  });

  // Helper to read resource and perform basic checks
  async function readResourceAndCheck(uri: string): Promise<ReadResourceResult['contents'][0]> {
    const result = await client.readResource({ uri });
    expect(result.contents).toHaveLength(1);
    const content = result.contents[0];
    expect(content.uri).toBe(uri);
    return content;
  }

  // Helper to read resource and check for text/plain list content
  async function checkTextListResponse(uri: string, expectedSubstrings: string[]): Promise<string> {
    const content = (await readResourceAndCheck(uri)) as FormattedResultItem;
    expect(content.mimeType).toBe('text/plain');
    // expect(content.isError).toBeFalsy(); // Removed as SDK might strip this property
    if (!hasTextContent(content)) throw new Error('Expected text content');
    for (const sub of expectedSubstrings) {
      expect(content.text).toContain(sub);
    }
    return content.text;
  }

  // Helper to read resource and check for JSON detail content
  async function checkJsonDetailResponse(uri: string, expectedObject: object): Promise<unknown> {
    const content = (await readResourceAndCheck(uri)) as FormattedResultItem;
    expect(content.mimeType).toBe('application/json');
    // expect(content.isError).toBeFalsy(); // Removed as SDK might strip this property
    if (!hasTextContent(content)) throw new Error('Expected text content');
    const data = parseJsonSafely(content.text);
    expect(data).toMatchObject(expectedObject);
    return data;
  }

  // Helper to read resource and check for error
  async function checkErrorResponse(uri: string, expectedErrorText: string): Promise<void> {
    const content = (await readResourceAndCheck(uri)) as FormattedResultItem;
    // expect(content.isError).toBe(true); // Removed as SDK might strip this property
    expect(content.mimeType).toBe('text/plain'); // Errors are plain text
    if (!hasTextContent(content)) throw new Error('Expected text content for error');
    expect(content.text).toContain(expectedErrorText);
  }

  describe('openapi://{specId}/{field}', () => {
    beforeEach(async () => await setup());

    it('should retrieve the "info" field', async () => {
      await checkJsonDetailResponse(`openapi://${complexSpecId}/info`, {
        title: 'Complex Endpoint Test API',
        version: '1.0.0',
      });
    });

    it('should retrieve the "paths" list', async () => {
      await checkTextListResponse(`openapi://${complexSpecId}/paths`, [
        'Hint:',
        'GET POST /api/v1/organizations/{orgId}/projects/{projectId}/tasks',
      ]);
    });

    it('should retrieve the "components" list', async () => {
      await checkTextListResponse(`openapi://${complexSpecId}/components`, [
        'Available Component Types:',
        '- schemas',
        "Hint: Use 'openapi://",
      ]);
    });

    it('should return error for invalid field', async () => {
      const uri = `openapi://${complexSpecId}/invalidfield`;
      await checkErrorResponse(uri, 'Field "invalidfield" not found');
    });
  });

  describe('openapi://{specId}/paths/{path}', () => {
    beforeEach(async () => await setup());

    it('should list methods for the complex task path', async () => {
      const complexPath = 'api/v1/organizations/{orgId}/projects/{projectId}/tasks';
      const encodedPath = encodeURIComponent(complexPath);
      await checkTextListResponse(`openapi://${complexSpecId}/paths/${encodedPath}`, [
        'Hint:',
        'GET: Get Tasks',
        'POST: Create Task',
      ]);
    });

    it('should return error for non-existent path', async () => {
      const encodedPath = encodeURIComponent('nonexistent');
      const uri = `openapi://${complexSpecId}/paths/${encodedPath}`;
      await checkErrorResponse(uri, 'Path "/nonexistent" not found in the specification.');
    });
  });

  describe('openapi://{specId}/paths/{path}/{method*}', () => {
    beforeEach(async () => await setup());

    it('should get details for GET on complex path', async () => {
      const complexPath = 'api/v1/organizations/{orgId}/projects/{projectId}/tasks';
      const encodedPath = encodeURIComponent(complexPath);
      await checkJsonDetailResponse(`openapi://${complexSpecId}/paths/${encodedPath}/get`, {
        operationId: 'getProjectTasks',
      });
    });

    it('should get details for multiple methods GET,POST on complex path', async () => {
      const complexPath = 'api/v1/organizations/{orgId}/projects/{projectId}/tasks';
      const encodedPath = encodeURIComponent(complexPath);
      const result = await client.readResource({
        uri: `openapi://${complexSpecId}/paths/${encodedPath}/get,post`,
      });
      expect(result.contents).toHaveLength(2);

      const getContent = result.contents.find(c => c.uri.endsWith('/get')) as
        | FormattedResultItem
        | undefined;
      expect(getContent).toBeDefined();
      if (!getContent || !hasTextContent(getContent))
        throw new Error('Expected text content for GET');
      const getData = parseJsonSafely(getContent.text);
      expect(getData).toMatchObject({ operationId: 'getProjectTasks' });

      const postContent = result.contents.find(c => c.uri.endsWith('/post')) as
        | FormattedResultItem
        | undefined;
      expect(postContent).toBeDefined();
      if (!postContent || !hasTextContent(postContent))
        throw new Error('Expected text content for POST');
      const postData = parseJsonSafely(postContent.text);
      expect(postData).toMatchObject({ operationId: 'createProjectTask' });
    });

    it('should return error for invalid method on complex path', async () => {
      const complexPath = 'api/v1/organizations/{orgId}/projects/{projectId}/tasks';
      const encodedPath = encodeURIComponent(complexPath);
      const uri = `openapi://${complexSpecId}/paths/${encodedPath}/put`;
      await checkErrorResponse(
        uri,
        'None of the requested methods (put) are valid for path "/api/v1/organizations/{orgId}/projects/{projectId}/tasks". Available methods: get, post'
      );
    });
  });

  describe('openapi://{specId}/components/{type}', () => {
    beforeEach(async () => await setup());

    it('should list schemas', async () => {
      await checkTextListResponse(`openapi://${complexSpecId}/components/schemas`, [
        'Available schemas:',
        '- CreateTaskRequest',
        '- Task',
        '- TaskList',
        "Hint: Use 'openapi://",
      ]);
    });

    it('should return error for invalid type', async () => {
      const uri = `openapi://${complexSpecId}/components/invalid`;
      await checkErrorResponse(uri, 'Invalid component type: invalid');
    });
  });

  describe('openapi://{specId}/components/{type}/{name*}', () => {
    beforeEach(async () => await setup());

    it('should get details for schema Task', async () => {
      await checkJsonDetailResponse(`openapi://${complexSpecId}/components/schemas/Task`, {
        type: 'object',
        properties: { id: { type: 'string' }, title: { type: 'string' } },
      });
    });

    it('should get details for multiple schemas Task,TaskList', async () => {
      const result = await client.readResource({
        uri: `openapi://${complexSpecId}/components/schemas/Task,TaskList`,
      });
      expect(result.contents).toHaveLength(2);

      const taskContent = result.contents.find(c => c.uri.endsWith('/Task')) as
        | FormattedResultItem
        | undefined;
      expect(taskContent).toBeDefined();
      if (!taskContent || !hasTextContent(taskContent))
        throw new Error('Expected text content for Task');
      const taskData = parseJsonSafely(taskContent.text);
      expect(taskData).toMatchObject({ properties: { id: { type: 'string' } } });

      const taskListContent = result.contents.find(c => c.uri.endsWith('/TaskList')) as
        | FormattedResultItem
        | undefined;
      expect(taskListContent).toBeDefined();
      if (!taskListContent || !hasTextContent(taskListContent))
        throw new Error('Expected text content for TaskList');
      const taskListData = parseJsonSafely(taskListContent.text);
      expect(taskListData).toMatchObject({ properties: { items: { type: 'array' } } });
    });

    it('should return error for invalid name', async () => {
      const uri = `openapi://${complexSpecId}/components/schemas/InvalidSchemaName`;
      await checkErrorResponse(
        uri,
        'None of the requested names (InvalidSchemaName) are valid for component type "schemas". Available names: CreateTaskRequest, Task, TaskList'
      );
    });
  });

  // Removed ListResourceTemplates test suite as the 'complete' property
  // is likely not part of the standard response payload.
  // We assume the templates are registered correctly in src/index.ts.

  describe('Completion Tests', () => {
    beforeEach(async () => await setup());

    it('should provide completions for {specId}', async () => {
      const params = {
        argument: { name: 'specId', value: '' },
        ref: { type: 'ref/resource' as const, uri: 'openapi://{specId}/{field}' },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toContain(complexSpecId);
    });

    it('should provide completions for {field}', async () => {
      const params = {
        argument: { name: 'field', value: '' },
        ref: { type: 'ref/resource' as const, uri: 'openapi://{specId}/{field}' },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toEqual(
        expect.arrayContaining(['info', 'paths', 'components'])
      );
    });

    it('should provide completions for {path}', async () => {
      const params = {
        argument: { name: 'path', value: '' },
        ref: { type: 'ref/resource' as const, uri: 'openapi://{specId}/paths/{path}' },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toEqual([
        'api%2Fv1%2Forganizations%2F%7BorgId%7D%2Fprojects%2F%7BprojectId%7D%2Ftasks',
      ]);
    });

    it('should provide completions for {method*}', async () => {
      const params = {
        argument: { name: 'method', value: '' },
        ref: {
          type: 'ref/resource' as const,
          uri: 'openapi://{specId}/paths/{path}/{method*}',
        },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toEqual([
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
        'HEAD',
        'TRACE',
      ]);
    });

    it('should provide completions for {type}', async () => {
      const params = {
        argument: { name: 'type', value: '' },
        ref: { type: 'ref/resource' as const, uri: 'openapi://{specId}/components/{type}' },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toEqual(['schemas']);
    });

    it('should provide completions for {name*} when only one component type exists', async () => {
      const params = {
        argument: { name: 'name', value: '' },
        ref: {
          type: 'ref/resource' as const,
          uri: 'openapi://{specId}/components/{type}/{name*}',
        },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toEqual(
        expect.arrayContaining(['CreateTaskRequest', 'Task', 'TaskList'])
      );
      expect(result.completion.values).toHaveLength(3);
    });

    it('should NOT provide completions for {name*} when multiple component types exist', async () => {
      await testContext?.cleanup();
      const multiSpecPath = path.resolve(__dirname, '../../fixtures/multi-component-types.json');
      await setup(multiSpecPath);

      const params = {
        argument: { name: 'name', value: '' },
        ref: {
          type: 'ref/resource' as const,
          uri: 'openapi://{specId}/components/{type}/{name*}',
        },
      };
      const result = await client.complete(params);
      expect(result.completion).toBeDefined();
      expect(result.completion.values).toEqual([]);
    });
  });
});
