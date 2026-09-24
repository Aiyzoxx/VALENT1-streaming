export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // CORS Preflight
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
  const targetPath = url.pathname.replace(/^\/?api\/proxy\/?/, '');

  let targetUrl: string;
  if (url.searchParams.has('url')) {
    targetUrl = url.searchParams.get('url')!;
  } else if (/^https?:\/\//i.test(targetPath)) {
    targetUrl = targetPath + url.search;
  } else {
    targetUrl = `https://free.finepulfe.xyz/${targetPath}${url.search}`;
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        request.headers.get('user-agent') ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://free.finepulfe.xyz/',
      'Accept': '*/*',
    };

    // Forward byte-range requests for iOS Safari, AVPlayer and seeking
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
    });

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    const isM3u8 =
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegurl');

    const responseHeaders = new Headers(upstreamRes.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('x-frame-options');

    // For HLS manifests, strip malformed subtitle tags that cause iOS/Safari/HLS parser crash
    if (isM3u8 && upstreamRes.ok) {
      let manifest = await upstreamRes.text();

      // Remove EXT-X-MEDIA SUBTITLES referencing raw .vtt files (violates RFC 8216)
      manifest = manifest.replace(
        /#EXT-X-MEDIA:TYPE=SUBTITLES[^\r\n]+URI="[^"\r\n]+\.vtt"[^\r\n]*(\r?\n)?/gi,
        ''
      );

      // If no valid subtitles remain in manifest, remove SUBTITLES attribute references from STREAM-INF
      if (!manifest.includes('TYPE=SUBTITLES')) {
        manifest = manifest
          .replace(/,SUBTITLES="[^"]+"/gi, '')
          .replace(/SUBTITLES="[^"]+",?/gi, '');
      }

      responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
      responseHeaders.delete('content-length');

      return new Response(manifest, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    // Direct streaming for TS/MP4/m4s segments
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
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
