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

    return response.status(200).json(blob);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
