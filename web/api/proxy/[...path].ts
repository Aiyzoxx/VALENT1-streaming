export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const url = new URL(request.url);
  // Match path after /api/proxy/
  const targetPath = url.pathname.replace(/^\/api\/proxy\/?/, '');
  const targetUrl = `https://free.finepulfe.xyz/${targetPath}${url.search}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://free.finepulfe.xyz/',
        'Accept': '*/*',
      },
    });

    const headers = new Headers(upstreamRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.delete('content-security-policy');
    headers.delete('x-frame-options');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Proxy error' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
