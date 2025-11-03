import { NextRequest, NextResponse } from 'next/server';
import { createTag, updateTag, deleteTag } from '@/app/(dashboard)/admin/tags/actions';
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);
    const identifier = getRateLimitIdentifier(request, user?.id || null);
    const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.message || 'Rate limit exceeded', resetTime: rateLimitResult.resetTime },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const formData = await request.formData();
    const result = await createTag(formData);
    
    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        {
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      );
    }
    
    return NextResponse.json(
      { success: result?.success || 'Tag created successfully' },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Error in tags POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting check
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);
    const identifier = getRateLimitIdentifier(request, user?.id || null);
    const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.message || 'Rate limit exceeded', resetTime: rateLimitResult.resetTime },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const formData = await request.formData();
    const result = await updateTag(formData);
    
    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        {
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      );
    }
    
    return NextResponse.json(
      { success: result?.success || 'Tag updated successfully' },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Error in tags PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting check
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);
    const identifier = getRateLimitIdentifier(request, user?.id || null);
    const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.message || 'Rate limit exceeded', resetTime: rateLimitResult.resetTime },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const formData = await request.formData();
    const result = await deleteTag(formData);
    
    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        {
          status: 400,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      );
    }
    
    return NextResponse.json(
      { success: result?.success || 'Tag deleted successfully' },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_CONFIGS.admin.max.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Error in tags DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
