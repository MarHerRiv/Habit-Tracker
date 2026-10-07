import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/habits - Fetch all habits with their logs
export async function GET() {
  try {
    const habits = await prisma.habit.findMany({
      include: { logs: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(habits);
  } catch (error) {
    console.error("SERVER ERROR IN /api/habits GET:", error);
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
  }
}

// POST /api/habits - Create a new habit
export async function POST(request: Request) {
  try {
    const { title } = await request.json();
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const habit = await prisma.habit.create({
      data: { title },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error("SERVER ERROR IN /api/habits POST:", error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}