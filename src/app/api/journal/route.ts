
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// Validate a date string and convert it to a UTC calendar date.
function parseCalendarDate(value: unknown): Date | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

// GET /api/journal?date=YYYY-MM-DD
// Retrieve the current user's entry for a date.
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const dateValue = url.searchParams.get('date');

    if (dateValue === null) {
      return NextResponse.json(
        { error: 'A date in YYYY-MM-DD format is required' },
        { status: 400 }
      );
    }

    const date = parseCalendarDate(dateValue);

    if (!date) {
      return NextResponse.json(
        { error: 'Invalid calendar date' },
        { status: 400 }
      );
    }

    const entry = await prisma.journalEntry.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date,
        },
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('SERVER ERROR IN /api/journal GET:', error);

    return NextResponse.json(
      { error: 'Failed to fetch journal entry' },
      { status: 500 }
    );
  }
}

// POST /api/journal
// Create or update the current user's entry for a date.
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      !('date' in body) ||
      !('content' in body)
    ) {
      return NextResponse.json(
        { error: 'Both date and content are required' },
        { status: 400 }
      );
    }

    const { date: dateValue, content } = body as {
      date: unknown;
      content: unknown;
    };

    const date = parseCalendarDate(dateValue);

    if (!date) {
      return NextResponse.json(
        { error: 'Date must be a valid YYYY-MM-DD calendar date' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Journal content must be text' },
        { status: 400 }
      );
    }

    if (content.length > 10000) {
      return NextResponse.json(
        { error: 'Journal entries must be 10000 characters or fewer' },
        { status: 400 }
      );
    }

    const entry = await prisma.journalEntry.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date,
        },
      },
      create: {
        userId: session.user.id,
        date,
        content,
      },
      update: {
        content,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('SERVER ERROR IN /api/journal POST:', error);

    return NextResponse.json(
      { error: 'Failed to save journal entry' },
      { status: 500 }
    );
  }
}
