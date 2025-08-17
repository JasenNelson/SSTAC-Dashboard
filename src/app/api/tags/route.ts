import { NextRequest, NextResponse } from 'next/server';
import { createTag, updateTag, deleteTag } from '@/app/(dashboard)/admin/tags/actions';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const result = await createTag(formData, {});
    
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: result?.success || 'Tag created successfully' });
  } catch (error) {
    console.error('Error in tags POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const result = await updateTag(formData, {});
    
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: result?.success || 'Tag updated successfully' });
  } catch (error) {
    console.error('Error in tags PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const formData = await request.formData();
    const result = await deleteTag(formData, {});
    
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: result?.success || 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error in tags DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
