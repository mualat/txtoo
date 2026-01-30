/**
 * Encrypted Text Storage Worker
 * Zero-knowledge architecture: stores encrypted data, decryption happens client-side
 */

interface Env {
	DB: D1Database;
}

// CORS Configuration
// Set to ['*'] to allow all domains
// Or specify allowed domains: ['localhost', 'example.url.com', 'yourdomain.com']
const ALLOW_ORIGINS = ['*'];
// const ALLOW_ORIGINS = ['localhost', 'example.url.com']; // Example: specific domains

// Helper function to check if origin is allowed
function isOriginAllowed(origin: string | null): boolean {
	if (!origin) return false;
	if (ALLOW_ORIGINS.includes('*')) return true;

	// Check if origin matches any allowed domain
	return ALLOW_ORIGINS.some(allowed => {
		// Extract hostname from origin (e.g., http://localhost:3000 -> localhost)
		try {
			const originHost = new URL(origin).hostname;
			return originHost === allowed || originHost.endsWith(`.${allowed}`);
		} catch {
			return origin === allowed;
		}
	});
}

// Generate CORS headers based on request origin
function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin');
	const allowedOrigin = ALLOW_ORIGINS.includes('*')
		? '*'
		: (origin && isOriginAllowed(origin) ? origin : ALLOW_ORIGINS[0] || '*');

	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Authorization, X-Requested-With',
	};
}

/**
 * Generate a cryptographically secure, URL-safe ID
 * Uses Web Crypto API to generate random bytes and encodes them as base64url
 * Default length of 12 characters provides ~72 bits of entropy (281 trillion combinations)
 */
function generateId(length: number = 12): string {
	const bytes = new Uint8Array(Math.ceil(length * 3 / 4));
	crypto.getRandomValues(bytes);

	// Convert to base64url (URL-safe base64)
	const base64 = btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');

	return base64.substring(0, length);
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS headers for client-side access
		const corsHeaders = getCorsHeaders(request);

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Route: POST /submit - Store encrypted data
		if (path === '/api/submit' && request.method === 'POST') {
			try {
				// Parse JSON body
				const body = await request.json() as { ttl?: number; cipherText?: string; iv?: string };
				const { ttl, cipherText, iv } = body;

				// Validate required parameters
				if (!ttl || !cipherText || !iv) {
					return new Response(
						JSON.stringify({
							type: 'error',
							status: 400,
							message: 'Missing required parameters: ttl, cipherText, iv'
						}),
						{
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' }
						}
					);
				}

				// Generate unique ID
				const id = generateId();
				const now = Math.floor(Date.now() / 1000);
				const expiresAt = now + ttl;

				// Store encrypted data in D1
				await env.DB.prepare(
					'INSERT INTO texts (id, cipher_text, iv, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
				)
					.bind(id, cipherText, iv, now, expiresAt)
					.run();

				// Return standardized success response
				return new Response(
					JSON.stringify({
						type: 'success',
						status: 200,
						data: {
							id,
							url: `${url.origin}/${id}`,
							expiresAt
						}
					}),
					{
						status: 200,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					}
				);
			} catch (error) {
				console.error('Storage error:', error);
				return new Response(
					JSON.stringify({
						type: 'error',
						status: 500,
						message: 'Failed to store data'
					}),
					{
						status: 500,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					}
				);
			}
		}

		// Route: GET /fetch/{id} - Retrieve encrypted data as JSON
		if (path.startsWith('/api/fetch/')) {
			const id = path.substring(11); // '/api/fetch/' is 11 characters

			try {
				const now = Math.floor(Date.now() / 1000);

				// Fetch from D1
				const result = await env.DB.prepare(
					'SELECT id, cipher_text, iv, expires_at FROM texts WHERE id = ?'
				)
					.bind(id)
					.first();

				// Check if exists
				if (!result) {
					return new Response(
						JSON.stringify({
							type: 'error',
							status: 404,
							message: 'Text not found'
						}),
						{ status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
					);
				}

				// Check if expired
				if ((result.expires_at as number) < now) {
					// Delete expired entry
					await env.DB.prepare('DELETE FROM texts WHERE id = ?').bind(id).run();
					return new Response(
						JSON.stringify({
							type: 'error',
							status: 410,
							message: 'Text has expired'
						}),
						{ status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
					);
				}

				// Return encrypted data as JSON
				return new Response(
					JSON.stringify({
						type: 'success',
						status: 200,
						data: {
							id: result.id,
							cipher_text: result.cipher_text,
							iv: result.iv,
							expiresAt: result.expires_at
						}
					}),
					{
						status: 200,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					}
				);
			} catch (error) {
				console.error('Retrieval error:', error);
				return new Response(
					JSON.stringify({
						type: 'error',
						status: 500,
						message: 'Failed to retrieve data'
					}),
					{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
				);
			}
		}

		// Default response
		return new Response(
			JSON.stringify({
				type: 'info',
				status: 200,
				message: 'Encrypted Text Storage API',
				endpoints: {
					submit: 'POST /submit?ttl=X&cipherText=Y&iv=Z',
					fetch: 'GET /fetch/{id}'
				}
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	},
} satisfies ExportedHandler<Env>;
