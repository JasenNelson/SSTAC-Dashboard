import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }); } catch (error) {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    
    // For anonymous users (CEW pages), generate a session ID
    let userId = user?.id;
    if (!userId) {
      // Generate a unique session ID for anonymous users
      userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Poll Submit] Anonymous user, generated session ID: ${userId}`);
    }

    const { pagePath, pollIndex, question, options, optionIndex, otherText, authCode } = await request.json();
    console.log(`[Poll Submit] Received vote for poll ${pollIndex} on page ${pagePath}, option ${optionIndex}${otherText ? `, otherText: "${otherText}"` : ''}${authCode ? `, authCode: "${authCode}"` : ''}`);

    // Use authCode if provided, otherwise use the generated userId
    const finalUserId = authCode || userId;

    // Get or create poll
    const { data: pollData, error: pollError } = await supabase
      .rpc('get_or_create_poll', {
        p_page_path: pagePath,
        p_poll_index: pollIndex,
        p_question: question,
        p_options: options
      });

    if (pollError) {
      console.error(`[Poll Submit] Error creating/getting poll for pollIndex ${pollIndex}:`, pollError);
      return NextResponse.json({ error: 'Failed to create/get poll' }, { status: 500 });
    }

    console.log(`[Poll Submit] Poll created/found for pollIndex ${pollIndex}:`, pollData);

    // Try to insert the vote, handle duplicate key error by updating
    console.log(`[Poll Submit] Inserting vote for poll_id=${pollData}, user_id=${finalUserId}`);
    let { data: voteData, error: voteError } = await supabase
      .from('poll_votes')
      .insert({
        poll_id: pollData,
        user_id: finalUserId,
        option_index: optionIndex,
        other_text: otherText || null,
        voted_at: new Date().toISOString()
      })
      .select();
    
    console.log(`[Poll Submit] Insert result:`, { data: voteData, error: voteError });
    
    // If insert fails due to duplicate key, return error (no vote changes allowed on CEW pages)
    if (voteError && voteError.code === '23505') {
      console.log(`[Poll Submit] Duplicate key detected - vote already exists for this user/poll combination`);
      return NextResponse.json({ 
        success: false, 
        error: 'You have already voted on this poll. Each device can only vote once.' 
      }, { status: 400 });
    }

    if (voteError) {
      console.error(`[Poll Submit] Error submitting vote for pollIndex ${pollIndex}:`, voteError);
      return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }

    console.log(`[Poll Submit] Vote submitted successfully for pollIndex ${pollIndex}:`, voteData);
    return NextResponse.json({ success: true, pollId: pollData });
  } catch (error) {
    console.error('Error in poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
