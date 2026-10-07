import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/habits/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.habit.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Habit deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 });
  }
}