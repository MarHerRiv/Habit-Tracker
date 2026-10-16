
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// POST /api/habits/[id]/logs
// Mark a habit complete for a specific calendar date.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      !('date' in body)
    ) {
      return NextResponse.json(
        { error: 'A date in YYYY-MM-DD format is required' },
        { status: 400 }
      );
    }

    const { date, note } = body as {
      date: unknown;
      note?: unknown;
    };

    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return NextResponse.json(
        { error: 'Date must use YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const logDate = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(logDate.getTime()) ||
      logDate.toISOString().slice(0, 10) !== date
    ) {
      return NextResponse.json(
        { error: 'Invalid calendar date' },
        { status: 400 }
      );
    }

    if (
      note !== undefined &&
      note !== null &&
      typeof note !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Note must be text' },
        { status: 400 }
      );
    }

    if (typeof note === 'string' && note.length > 2000) {
      return NextResponse.json(
        { error: 'Note must be 2000 characters or fewer' },
        { status: 400 }
      );
    }

    // Verify this habit belongs to the signed-in user.
    const habit = await prisma.habit.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!habit) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      );
    }

    const savedNote =
      typeof note === 'string' ? note.trim() || null : note;

    // The database's unique constraint prevents duplicate logs
    // for the same habit and calendar date.
    const log = await prisma.log.upsert({
      where: {
        habitId_date: {
          habitId: habit.id,
          date: logDate,
        },
      },
      create: {
        habitId: habit.id,
        date: logDate,
        completed: true,
        ...(note !== undefined ? { note: savedNote } : {}),
      },
      update: {
        completed: true,
        ...(note !== undefined ? { note: savedNote } : {}),
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error(
      'SERVER ERROR IN /api/habits/[id]/logs POST:',
      error
    );

    return NextResponse.json(
      { error: 'Failed to record habit completion' },
      { status: 500 }
    );
  }
}
