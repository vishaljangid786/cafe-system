const CREATE_CAFE_BACKEND_URL = 'https://cafe-system-three.vercel.app/api/cafes';
const FRONTEND_ORIGIN = 'https://cafe-orgaization-system-by-vishal.vercel.app';

export async function POST(request) {
  try {
    const body = await request.text();
    const cookie = request.headers.get('cookie');
    const authorization = request.headers.get('authorization');

    const headers = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      Origin: request.headers.get('origin') || FRONTEND_ORIGIN,
    };

    if (cookie) headers.Cookie = cookie;
    if (authorization) headers.Authorization = authorization;

    const response = await fetch(CREATE_CAFE_BACKEND_URL, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('[create-cafe proxy] request failed:', error);
    return Response.json(
      { success: false, message: 'Could not reach the cafe backend' },
      { status: 502 }
    );
  }
}
