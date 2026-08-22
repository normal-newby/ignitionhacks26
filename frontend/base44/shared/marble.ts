import { secrets } from 'base44:runtime';

export const MARBLE_API_BASE = 'https://api.worldlabs.ai/marble/v1';

export function getMarbleApiKey() {
  const key = secrets.get('MARBLE_API_KEY');
  if (!key) throw new Error('MARBLE_API_KEY secret is not set. Add it in dashboard settings → environment variables.');
  return key;
}

export function marbleJsonHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'WLT-Api-Key': apiKey,
  };
}