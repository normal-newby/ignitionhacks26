import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getMarbleApiKey, MARBLE_API_BASE } from '../../shared/marble.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { tour_id } = body;

    if (!tour_id) {
      return Response.json({ error: 'Tour ID is required' }, { status: 400 });
    }

    const tour = await base44.asServiceRole.entities.Tour.get(tour_id);
    if (!tour) {
      return Response.json({ error: 'Tour not found' }, { status: 404 });
    }

    // Return immediately if already in a terminal state
    if (tour.status === 'published') {
      return Response.json({
        status: 'published',
        world_id: tour.world_id,
        address: tour.address,
        description: 'World generation completed successfully',
      });
    }
    if (tour.status === 'failed') {
      return Response.json({
        status: 'failed',
        address: tour.address,
        description: 'World generation failed',
      });
    }

    // Poll Marble operations endpoint
    const apiKey = getMarbleApiKey();
    const opResponse = await fetch(`${MARBLE_API_BASE}/operations/${tour.session_id}`, {
      headers: { 'WLT-Api-Key': apiKey },
    });

    if (!opResponse.ok) {
      const errText = await opResponse.text();
      return Response.json(
        { error: 'Failed to check Marble status: ' + errText },
        { status: 502 }
      );
    }

    const opData = await opResponse.json();
    const description =
      opData.metadata?.progress?.description || 'World generation in progress';

    if (opData.done) {
      if (opData.error) {
        await base44.asServiceRole.entities.Tour.update(tour_id, { status: 'failed' });
        return Response.json({
          status: 'failed',
          address: tour.address,
          description:
            typeof opData.error === 'string'
              ? opData.error
              : opData.error.message || 'World generation failed',
        });
      }

      const world_id = opData.metadata?.world_id || opData.response?.id;
      await base44.asServiceRole.entities.Tour.update(tour_id, {
        status: 'published',
        world_id,
        published_date: new Date().toISOString(),
      });

      return Response.json({
        status: 'published',
        world_id,
        address: tour.address,
        description,
      });
    }

    return Response.json({
      status: 'processing',
      address: tour.address,
      description,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}