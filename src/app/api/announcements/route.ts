import { NextRequest, NextResponse } from 'next/server';
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/app/(dashboard)/admin/announcements/actions';
import { createAuthenticatedClient } from '@/lib/supabase-auth';
import { getAuthAndRateLimit } from '../_helpers/rate-limit-wrapper';

export async function GET(_request: NextRequest) {
  try {
    // Task 2.1.2 Security Fix: Verify authentication before fetching announcements
    const supabase = await createAuthenticatedClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching announcements:', error);
      return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
    }

    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Error in announcements GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'admin');
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const result = await createAnnouncement(formData);
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: rateLimitHeaders });
    }
    
    return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error in announcements POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'admin');
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const result = await updateAnnouncement(formData);
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: rateLimitHeaders });
    }
    
    return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error in announcements PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'admin');
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const result = await deleteAnnouncement(formData);
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: rateLimitHeaders });
    }
    
    return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error in announcements DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
