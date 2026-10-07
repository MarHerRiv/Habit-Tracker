'use client';

import { useState, useEffect } from 'react';

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
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch habits from API
  const fetchHabits = async () => {
    try {
      const res = await fetch('/api/habits');
      const data = await res.json();
      setHabits(data);
    } catch (error) {
      console.error('Error fetching habits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  // Add a new habit
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

  // Delete a habit
  const deleteHabit = async (habitId: string) => {
    try {
      await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      });
      await fetchHabits();
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Habit & Micro-Journal Tracker</h1>

      {/* Form to Add New Habit */}
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

      {/* Habit List */}
      {loading ? (
        <p className="text-gray-500">Loading habits...</p>
      ) : habits.length === 0 ? (
        <p className="text-gray-500">No habits added yet. Start by creating one above!</p>
      ) : (
        <div className="space-y-4">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="flex justify-between items-center p-4 border rounded-lg shadow-sm bg-white"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{habit.title}</h3>
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