const UPSTREAM_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBuYSomBzmtCGatM6YMOriDulTXf9WEBVSPZBKLMX5d7KrrPAlmeqs3KLQL1CKUSZ9bCHCb6P-by8X/pub?gid=0&single=true&output=csv';

function errorResponse(message, status = 502) {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/taiwan-feed') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { allow: 'GET, HEAD', 'cache-control': 'no-store' }
        });
      }

      try {
        const upstream = await fetch(UPSTREAM_URL, {
          cf: { cacheTtl: 300, cacheEverything: true }
        });

        if (!upstream.ok) {
          return errorResponse('Published Taiwan feed returned HTTP ' + upstream.status);
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          return errorResponse('Published Taiwan feed returned a web page instead of CSV');
        }

        const headers = new Headers({
          'content-type': 'text/csv; charset=utf-8',
          'cache-control': 'public, max-age=60, s-maxage=300',
          'x-content-type-options': 'nosniff'
        });
        return new Response(request.method === 'HEAD' ? null : upstream.body, {
          status: 200,
          headers
        });
      } catch {
        return errorResponse('Could not retrieve the published Taiwan feed');
      }
    }

    return env.ASSETS.fetch(request);
  }
};
