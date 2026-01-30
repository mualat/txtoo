import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Encrypted Text Storage API', () => {
	let testId: string;

	describe('GET /', () => {
		it('returns API info', async () => {
			const response = await SELF.fetch('https://example.com/');
			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toMatchObject({
				type: 'info',
				status: 200,
				message: 'Encrypted Text Storage API',
				endpoints: {
					submit: 'POST /submit?ttl=X&cipherText=Y&iv=Z',
					fetch: 'GET /fetch/{id}'
				}
			});
		});
	});

	describe('POST /submit', () => {
		it('stores encrypted data and returns success response', async () => {
			const request = new IncomingRequest(
				'http://example.com/submit?ttl=3600&cipherText=testCipher123&iv=testIV456',
				{ method: 'POST' }
			);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = (await response.json()) as any;
			expect(data).toMatchObject({
				type: 'success',
				status: 200,
				data: {
					id: expect.any(String),
					url: expect.stringContaining('http://example.com/'),
					expiresAt: expect.any(Number)
				}
			});

			// Save ID for fetch test
			testId = data.data.id;
		});

		it('returns error when missing parameters', async () => {
			const request = new IncomingRequest(
				'http://example.com/submit?ttl=3600',
				{ method: 'POST' }
			);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data).toMatchObject({
				type: 'error',
				status: 400,
				message: 'Missing required parameters: ttl, cipherText, iv'
			});
		});
	});

	describe('GET /fetch/{id}', () => {
		it('retrieves encrypted data by ID', async () => {
			// First, store some data
			const submitRequest = new IncomingRequest(
				'http://example.com/submit?ttl=3600&cipherText=fetchTest123&iv=fetchIV456',
				{ method: 'POST' }
			);
			const submitCtx = createExecutionContext();
			const submitResponse = await worker.fetch(submitRequest, env, submitCtx);
			await waitOnExecutionContext(submitCtx);
			const submitData = (await submitResponse.json()) as any;
			const id = submitData.data.id;

			// Now fetch it
			const fetchRequest = new IncomingRequest(`http://example.com/fetch/${id}`);
			const fetchCtx = createExecutionContext();
			const fetchResponse = await worker.fetch(fetchRequest, env, fetchCtx);
			await waitOnExecutionContext(fetchCtx);

			expect(fetchResponse.status).toBe(200);
			const fetchData = await fetchResponse.json();
			expect(fetchData).toMatchObject({
				type: 'success',
				status: 200,
				data: {
					id: id,
					cipher_text: 'fetchTest123',
					iv: 'fetchIV456',
					expiresAt: expect.any(Number)
				}
			});
		});

		it('returns 404 for non-existent ID', async () => {
			const request = new IncomingRequest('http://example.com/fetch/nonexistent');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			const data = await response.json();
			expect(data).toMatchObject({
				type: 'error',
				status: 404,
				message: 'Text not found'
			});
		});

		it('returns 410 for expired data', async () => {
			// Store data with 1 second TTL
			const submitRequest = new IncomingRequest(
				'http://example.com/submit?ttl=1&cipherText=expireTest&iv=expireIV',
				{ method: 'POST' }
			);
			const submitCtx = createExecutionContext();
			const submitResponse = await worker.fetch(submitRequest, env, submitCtx);
			await waitOnExecutionContext(submitCtx);
			const submitData = (await submitResponse.json()) as any;
			const id = submitData.data.id;

			// Wait for expiration
			await new Promise(resolve => setTimeout(resolve, 1500));

			// Try to fetch expired data
			const fetchRequest = new IncomingRequest(`http://example.com/fetch/${id}`);
			const fetchCtx = createExecutionContext();
			const fetchResponse = await worker.fetch(fetchRequest, env, fetchCtx);
			await waitOnExecutionContext(fetchCtx);

			expect(fetchResponse.status).toBe(410);
			const fetchData = await fetchResponse.json();
			expect(fetchData).toMatchObject({
				type: 'error',
				status: 410,
				message: 'Text has expired'
			});
		});
	});

	describe('CORS', () => {
		it('handles OPTIONS preflight request', async () => {
			const request = new IncomingRequest('http://example.com/submit', {
				method: 'OPTIONS'
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
		});
	});
});
