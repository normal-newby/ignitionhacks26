import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getMarbleApiKey, MARBLE_API_BASE, marbleJsonHeaders } from '../../shared/marble.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { address, video_url, search_tags, estimated_value } = body;

    if (!address || !video_url) {
      return Response.json({ error: 'Address and video URL are required' }, { status: 400 });
    }

    const apiKey = getMarbleApiKey();

    // Start world generation from the uploaded video URL
    const genResponse = await fetch(`${MARBLE_API_BASE}/worlds:generate`, {
      method: 'POST',
      headers: marbleJsonHeaders(apiKey),
      body: JSON.stringify({
        display_name: address,
        model: 'marble-1.1',
        world_prompt: {
          type: 'video',
          video_prompt: {
            source: 'uri',
            uri: video_url,
          },
        },
      }),
    });

    if (!genResponse.ok) {
      const errText = await genResponse.text();
      return Response.json(
        { error: 'Marble generation request failed: ' + errText },
        { status: 502 }
      );
    }

    const genData = await genResponse.json();
    const operation_id = genData.operation_id;

    if (!operation_id) {
      return Response.json(
        { error: 'Marble did not return an operation ID' },
        { status: 502 }
      );
    }

    // Save tour record with session_id (operation_id) and status=processing
    const tour = await base44.asServiceRole.entities.Tour.create({
      address,
      status: 'processing',
      video_url,
      session_id: operation_id,
      search_tags: search_tags || [],
      estimated_value: estimated_value ?? null,
    });

    return Response.json({
      tour_id: tour.id,
      status: 'processing',
      session_id: operation_id,
      address,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}