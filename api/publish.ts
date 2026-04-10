import { put } from '@vercel/blob';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = request.body;
    const filename = `nuvio-catalog-${Date.now()}.json`;

    // Upload to Vercel Blob
    const blob = await put(filename, JSON.stringify(payload, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });

    const host = request.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    
    // Return a "Pretty" URL that uses our own domain's proxy
    return response.status(200).json({ 
      url: `${protocol}://${host}/api/config?name=${filename}`
    });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
