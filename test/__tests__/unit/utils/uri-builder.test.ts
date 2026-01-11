import {
  buildComponentDetailUri,
  buildComponentMapUri,
  buildOperationUri,
  buildPathItemUri,
  buildTopLevelFieldUri,
  buildComponentDetailUriSuffix,
  buildComponentMapUriSuffix,
  buildOperationUriSuffix,
  buildPathItemUriSuffix,
  buildTopLevelFieldUriSuffix,
} from '../../../../src/utils/uri-builder';

describe('URI Builder Utilities', () => {
  // --- Full URI Builders (with specId) ---

  test('buildComponentDetailUri builds correct URI with specId', () => {
    expect(buildComponentDetailUri('test-api', 'schemas', 'MySchema')).toBe(
      'openapi://test-api/components/schemas/MySchema'
    );
    expect(buildComponentDetailUri('test-api', 'responses', 'NotFound')).toBe(
      'openapi://test-api/components/responses/NotFound'
    );
    // Test with characters that might need encoding if rules change (but currently don't)
    expect(buildComponentDetailUri('test-api', 'parameters', 'user-id')).toBe(
      'openapi://test-api/components/parameters/user-id'
    );
  });

  test('buildComponentMapUri builds correct URI with specId', () => {
    expect(buildComponentMapUri('test-api', 'schemas')).toBe(
      'openapi://test-api/components/schemas'
    );
    expect(buildComponentMapUri('test-api', 'parameters')).toBe(
      'openapi://test-api/components/parameters'
    );
  });

  test('buildOperationUri builds correct URI with specId and encodes path (no leading slash)', () => {
    expect(buildOperationUri('test-api', '/users', 'get')).toBe(
      'openapi://test-api/paths/users/get'
    ); // No leading slash encoded
    expect(buildOperationUri('test-api', '/users/{userId}', 'post')).toBe(
      'openapi://test-api/paths/users%2F%7BuserId%7D/post' // Path encoded, no leading %2F
    );
    expect(buildOperationUri('test-api', '/pets/{petId}/uploadImage', 'post')).toBe(
      'openapi://test-api/paths/pets%2F%7BpetId%7D%2FuploadImage/post' // Path encoded, no leading %2F
    );
    expect(buildOperationUri('test-api', 'users', 'get')).toBe(
      'openapi://test-api/paths/users/get'
    ); // Handles no leading slash input
    expect(buildOperationUri('test-api', 'users/{userId}', 'post')).toBe(
      'openapi://test-api/paths/users%2F%7BuserId%7D/post' // Handles no leading slash input
    );
    expect(buildOperationUri('test-api', '/users', 'GET')).toBe(
      'openapi://test-api/paths/users/get'
    ); // Method lowercased
  });

  test('buildPathItemUri builds correct URI with specId and encodes path (no leading slash)', () => {
    expect(buildPathItemUri('test-api', '/users')).toBe('openapi://test-api/paths/users'); // No leading slash encoded
    expect(buildPathItemUri('test-api', '/users/{userId}')).toBe(
      'openapi://test-api/paths/users%2F%7BuserId%7D'
    ); // Path encoded, no leading %2F
    expect(buildPathItemUri('test-api', '/pets/{petId}/uploadImage')).toBe(
      'openapi://test-api/paths/pets%2F%7BpetId%7D%2FuploadImage' // Path encoded, no leading %2F
    );
    expect(buildPathItemUri('test-api', 'users')).toBe('openapi://test-api/paths/users'); // Handles no leading slash input
    expect(buildPathItemUri('test-api', 'users/{userId}')).toBe(
      'openapi://test-api/paths/users%2F%7BuserId%7D'
    ); // Handles no leading slash input
  });

  test('buildTopLevelFieldUri builds correct URI with specId', () => {
    expect(buildTopLevelFieldUri('test-api', 'info')).toBe('openapi://test-api/info');
    expect(buildTopLevelFieldUri('test-api', 'paths')).toBe('openapi://test-api/paths');
    expect(buildTopLevelFieldUri('test-api', 'components')).toBe('openapi://test-api/components');
  });

  // --- URI Suffix Builders (without specId - unchanged) ---

  test('buildComponentDetailUriSuffix builds correct suffix', () => {
    expect(buildComponentDetailUriSuffix('schemas', 'MySchema')).toBe(
      'components/schemas/MySchema'
    );
    expect(buildComponentDetailUriSuffix('responses', 'NotFound')).toBe(
      'components/responses/NotFound'
    );
  });

  test('buildComponentMapUriSuffix builds correct suffix', () => {
    expect(buildComponentMapUriSuffix('schemas')).toBe('components/schemas');
    expect(buildComponentMapUriSuffix('parameters')).toBe('components/parameters');
  });

  test('buildOperationUriSuffix builds correct suffix and encodes path (no leading slash)', () => {
    expect(buildOperationUriSuffix('/users', 'get')).toBe('paths/users/get'); // No leading slash encoded
    expect(buildOperationUriSuffix('/users/{userId}', 'post')).toBe(
      'paths/users%2F%7BuserId%7D/post' // Path encoded, no leading %2F
    );
    expect(buildOperationUriSuffix('users/{userId}', 'post')).toBe(
      'paths/users%2F%7BuserId%7D/post' // Handles no leading slash input
    );
    expect(buildOperationUriSuffix('/users', 'GET')).toBe('paths/users/get'); // Method lowercased
  });

  test('buildPathItemUriSuffix builds correct suffix and encodes path (no leading slash)', () => {
    expect(buildPathItemUriSuffix('/users')).toBe('paths/users'); // No leading slash encoded
    expect(buildPathItemUriSuffix('/users/{userId}')).toBe('paths/users%2F%7BuserId%7D'); // Path encoded, no leading %2F
    expect(buildPathItemUriSuffix('users/{userId}')).toBe('paths/users%2F%7BuserId%7D'); // Handles no leading slash input
  });

  test('buildTopLevelFieldUriSuffix builds correct suffix', () => {
    expect(buildTopLevelFieldUriSuffix('info')).toBe('info');
    expect(buildTopLevelFieldUriSuffix('paths')).toBe('paths');
  });
});
