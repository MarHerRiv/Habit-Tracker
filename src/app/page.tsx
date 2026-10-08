'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

type Log = {
  id: string;
  completed: boolean;
  date: string;
};

type Habit = {
  id: string;
  title: string;
  createdAt: string;
  logs: Log[];
};

export default function Home() {
  const { data: session, status } = useSession();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHabits = async () => {
    try {
      const res = await fetch('/api/habits');

      if (!res.ok) {
        setHabits([]);
        return;
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setHabits(data);
      } else {
        setHabits([]);
      }
    } catch (error) {
      console.error('Error fetching habits:', error);
      setHabits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchHabits();
    } else if (status === 'unauthenticated') {
      setHabits([]);
      setLoading(false);
    }
  }, [status]);

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.trim()) return;

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newHabit }),
      });

      if (res.ok) {
        setNewHabit('');
        await fetchHabits();
      }
    } catch (error) {
      console.error('Error adding habit:', error);
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      const res = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchHabits();
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  if (status === 'loading') {
    return (
      <main className="max-w-2xl mx-auto p-8 font-sans">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-2xl mx-auto p-8 font-sans">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          Habit & Micro-Journal Tracker
        </h1>

        <p className="text-gray-600 mb-6">
          Sign in to manage your habits.
        </p>

        <button
          onClick={() => signIn('google')}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-8 font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Habit & Micro-Journal Tracker
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Signed in as {session.user?.email}
          </p>
        </div>

        <button
          onClick={() => signOut()}
          className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
        >
          Sign out
        </button>
      </div>

      <form onSubmit={addHabit} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newHabit}
          onChange={(e) => setNewHabit(e.target.value)}
          placeholder="Enter a habit (e.g., Read for 20 mins)..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
        />

        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading habits...</p>
      ) : habits.length === 0 ? (
        <p className="text-gray-500">
          No habits added yet. Start by creating one above!
        </p>
      ) : (
        <div className="space-y-4">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="flex justify-between items-center p-4 border rounded-lg shadow-sm bg-white"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {habit.title}
                </h3>

                <p className="text-sm text-gray-500">
                  Completed {habit.logs.length} times
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="px-3 py-2 bg-red-100 text-red-600 font-medium rounded-lg hover:bg-red-200 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}