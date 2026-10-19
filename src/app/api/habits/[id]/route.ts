
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

// PATCH /api/habits/[id] - Update an existing habit
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Confirm the habit belongs to the signed-in user.
    const existingHabit = await prisma.habit.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!existingHabit) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'A valid update object is required' },
        { status: 400 }
      );
    }

    const { title, scheduledDays, points } = body as {
      title?: unknown;
      scheduledDays?: unknown;
      points?: unknown;
    };

    const data: {
      title?: string;
      scheduledDays?: number[];
      points?: number;
    } = {};

    if (title !== undefined) {
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        title.trim().length > 120
      ) {
        return NextResponse.json(
          {
            error:
              'Title must be a non-empty string of at most 120 characters',
          },
          { status: 400 }
        );
      }

      data.title = title.trim();
    }

    if (scheduledDays !== undefined) {
      if (!isValidScheduledDays(scheduledDays)) {
        return NextResponse.json(
          {
            error:
              'scheduledDays must be an array of weekday numbers from 0 (Sunday) to 6 (Saturday)',
          },
          { status: 400 }
        );
      }

      data.scheduledDays = [...new Set(scheduledDays)];
    }

    if (points !== undefined) {
      if (
        typeof points !== 'number' ||
        !Number.isSafeInteger(points) ||
        points < 0 ||
        points > 1000000
      ) {
        return NextResponse.json(
          { error: 'Points must be a whole number from 0 to 1,000,000' },
          { status: 400 }
        );
      }

      data.points = points;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'At least one valid field must be provided for the update' },
        { status: 400 }
      );
    }

    const updatedHabit = await prisma.habit.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedHabit);
  } catch (error) {
    console.error('SERVER ERROR IN /api/habits/[id] PATCH:', error);

    return NextResponse.json(
      { error: 'Failed to update habit' },
      { status: 500 }
    );
  }
}

// DELETE /api/habits/[id] - Delete an existing habit
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const habit = await prisma.habit.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!habit) {
      return NextResponse.json(
        { error: 'Habit not found' },
        { status: 404 }
      );
    }

    await prisma.habit.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Habit deleted' });
  } catch (error) {
    console.error('SERVER ERROR IN /api/habits/[id] DELETE:', error);
    return NextResponse.json(
      { error: 'Failed to delete habit' },
      { status: 500 }
    );
  }
}
