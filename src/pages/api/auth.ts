import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    // For now, return a simple session check
    // TODO: Integrate with Supabase auth
    const sessionId = req.cookies['session-id'] || null;
    
    res.status(200).json({
      authenticated: !!sessionId,
      user: sessionId ? { id: sessionId, plan: 'free' } : null
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}