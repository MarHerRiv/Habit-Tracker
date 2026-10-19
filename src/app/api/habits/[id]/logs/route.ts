
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function getDateInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not determine date in time zone');
  }

  return `${year}-${month}-${day}`;
}

// POST /api/habits/[id]/logs
// Mark a habit complete or undo its completion for today only.
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

    const { date, note, completed, timeZone } = body as {
      date: unknown;
      note?: unknown;
      completed?: unknown;
      timeZone?: unknown;
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
      typeof timeZone !== 'string' ||
      timeZone.length === 0 ||
      timeZone.length > 100
    ) {
      return NextResponse.json(
        { error: 'A valid time zone is required' },
        { status: 400 }
      );
    }

    let todayInTimeZone: string;

    try {
      todayInTimeZone = getDateInTimeZone(timeZone);
    } catch {
      return NextResponse.json(
        { error: 'Invalid time zone' },
        { status: 400 }
      );
    }

    if (date !== todayInTimeZone) {
      return NextResponse.json(
        { error: "You can only change today's completion" },
        { status: 400 }
      );
    }

    if (
      completed !== undefined &&
      typeof completed !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'completed must be true or false' },
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

    // Verify ownership and retrieve the current point value and schedule.
    const habit = await prisma.habit.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        points: true,
        scheduledDays: true,
      },
    });

    if (!habit) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      );
    }

    // The date is a calendar date, so UTC weekday matches its weekday.
    const isCompleting = completed !== false;
    const weekday = logDate.getUTCDay();

    if (
      isCompleting &&
      habit.scheduledDays.length > 0 &&
      !habit.scheduledDays.includes(weekday)
    ) {
      return NextResponse.json(
        { error: 'This habit is not scheduled for that day' },
        { status: 400 }
      );
    }

    const savedNote =
      typeof note === 'string' ? note.trim() || null : note;

    const existingLog = await prisma.log.findUnique({
      where: {
        habitId_date: {
          habitId: habit.id,
          date: logDate,
        },
      },
    });

    // Undoing a completion should not create a new log.
    if (!isCompleting) {
      if (!existingLog || !existingLog.completed) {
        return NextResponse.json(
          { error: 'No active completion exists for today' },
          { status: 404 }
        );
      }

      const log = await prisma.log.update({
        where: {
          habitId_date: {
            habitId: habit.id,
            date: logDate,
          },
        },
        data: {
          completed: false,
          pointsEarned: 0,
          ...(note !== undefined ? { note: savedNote } : {}),
        },
      });

      return NextResponse.json(log);
    }

    // Preserve the original points earned if this completion already exists.
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
        pointsEarned: habit.points,
        ...(note !== undefined ? { note: savedNote } : {}),
      },
      update: {
        completed: true,
        pointsEarned: existingLog?.completed
          ? existingLog.pointsEarned
          : habit.points,
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
