import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/habits/[id]
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