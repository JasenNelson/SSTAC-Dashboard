import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pagePath, pollIndex, question, options, optionIndex, otherText, authCode } = await request.json();
    console.log(`[Poll Submit] Received vote for poll ${pollIndex} on page ${pagePath}, option ${optionIndex}${otherText ? `, otherText: "${otherText}"` : ''}${authCode ? `, authCode: "${authCode}"` : ''}`);

    // Determine if this is a CEW page
    const isCEWPage = pagePath.startsWith('/cew-polls/');
    console.log(`[Poll Submit] isCEWPage: ${isCEWPage}, authCode: "${authCode}"`);
    let supabase, finalUserId;

    if (isCEWPage) {
      // CEW pages: Use anonymous connection with authCode as userId
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get() { return null; },
            set() {},
            remove() {},
          },
        }
      );
      
      // Test if the anonymous client is truly anonymous
      const { data: { user } } = await supabase.auth.getUser();
      console.log(`[Poll Submit] Anonymous client user check:`, user);
      
      finalUserId = authCode || 'CEW2025';
      console.log(`[Poll Submit] CEW page, using authCode: ${finalUserId}`);
      console.log(`[Poll Submit] Supabase client created for CEW page`);
    } else {
      // Authenticated pages: Use authenticated connection
      const cookieStore = await cookies();
      supabase = createServerClient(
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
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      finalUserId = user.id;
      console.log(`[Poll Submit] Authenticated user: ${finalUserId}`);
    }

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

    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, use upsert to allow vote changes
    console.log(`[Poll Submit] Submitting vote for poll_id=${pollData}, user_id=${finalUserId}`);
    
    let voteData, voteError;
    
    if (authCode) {
      // CEW pages: Always insert new vote (allow multiple votes per CEW code)
      const { data, error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollData,
          user_id: finalUserId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString()
        })
        .select();
      
      voteData = data;
      voteError = error;
    } else {
      // Authenticated users: Use upsert to allow vote changes
      const { data, error } = await supabase
        .from('poll_votes')
        .upsert({
          poll_id: pollData,
          user_id: finalUserId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString()
        })
        .select();
      
      voteData = data;
      voteError = error;
    }
    
    console.log(`[Poll Submit] Submit result:`, { data: voteData, error: voteError });

    if (voteError) {
      console.error(`[Poll Submit] Error submitting vote for pollIndex ${pollIndex}:`, voteError);
      console.error(`[Poll Submit] Vote error details:`, JSON.stringify(voteError, null, 2));
      return NextResponse.json({ error: 'Failed to submit vote', details: voteError.message }, { status: 500 });
    }

    console.log(`[Poll Submit] Vote submitted successfully for pollIndex ${pollIndex}:`, voteData);
    return NextResponse.json({ success: true, pollId: pollData });
  } catch (error) {
    console.error('Error in poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
