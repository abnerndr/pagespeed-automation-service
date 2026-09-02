import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openApiSpec } from './openapi';

describe('openApiSpec', () => {
  it('documenta health, analyze GET e analyze POST', () => {
    assert.equal(openApiSpec.info.title, 'PageSpeed Automation API');
    assert.ok(openApiSpec.paths['/health'].get);
    assert.ok(openApiSpec.paths['/analyze'].get);
    assert.ok(openApiSpec.paths['/analyze'].post);
  });
});
