import { list } from '@vercel/blob';

export default async function handler(request, response) {
  const { name } = request.query;

  if (!name) {
    return response.status(400).json({ error: 'Filename is required' });
  }

  try {
    // 1. List blobs to find the one matching our unique timestamp/name
    // This allows us to find the file even without knowing the random Vercel subdomain
    const { blobs } = await list();
    const targetBlob = blobs.find(b => b.pathname.includes(name));

    if (!targetBlob) {
      return response.status(404).json({ error: 'Configuration not found' });
    }

    // 2. Fetch the actual content
    const res = await fetch(targetBlob.url);
    const data = await res.json();

    // 3. Return it with proper JSON headers
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
