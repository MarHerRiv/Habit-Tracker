
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// Valid weekday numbers: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
function isValidScheduledDays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (day) =>
        typeof day === 'number' &&
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6
    )
  );
}

// GET /api/habits - Fetch the current user's habits
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const habits = await prisma.habit.findMany({
      where: { userId: session.user.id },
      include: { logs: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(habits);
  } catch (error) {
    console.error('SERVER ERROR IN /api/habits GET:', error);

    return NextResponse.json(
      { error: 'Failed to fetch habits' },
      { status: 500 }
    );
  }
}

// POST /api/habits - Create a new habit for the current user
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      !('title' in body)
    ) {
      return NextResponse.json(
        { error: 'A habit title is required' },
        { status: 400 }
      );
    }

    const { title, scheduledDays } = body as {
      title: unknown;
      scheduledDays?: unknown;
    };

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Title must be a non-empty string' },
        { status: 400 }
      );
    }

    if (
      scheduledDays !== undefined &&
      !isValidScheduledDays(scheduledDays)
    ) {
      return NextResponse.json(
        {
          error:
            'scheduledDays must be an array of weekday numbers from 0 (Sunday) to 6 (Saturday)',
        },
        { status: 400 }
      );
    }

    const normalizedScheduledDays = [
      ...new Set(scheduledDays ?? []),
    ];

    const habit = await prisma.habit.create({
      data: {
        title: title.trim(),
        scheduledDays: normalizedScheduledDays,
        userId: session.user.id,
      },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error('SERVER ERROR IN /api/habits POST:', error);

    return NextResponse.json(
      { error: 'Failed to create habit' },
      { status: 500 }
    );
  }
}
