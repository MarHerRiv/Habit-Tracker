
'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

type Log = {
  id: string;
  completed: boolean;
  date: string;
  note?: string | null;
};

type Habit = {
  id: string;
  title: string;
  createdAt: string;
  scheduledDays: number[];
  logs: Log[];
};

type JournalEntry = {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function Home() {
  const { data: session, status } = useSession();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingHabitId, setSavingHabitId] = useState<string | null>(null);
  const [completionErrors, setCompletionErrors] = useState<
    Record<string, string>
  >({});

  const [journalContent, setJournalContent] = useState('');
  const [journalLoading, setJournalLoading] = useState(true);
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalStatus, setJournalStatus] = useState('');
  const [journalEntryDate, setJournalEntryDate] = useState('');

  const today = getLocalDateString();

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

  const fetchJournal = async () => {
    setJournalLoading(true);
    setJournalError('');
    setJournalStatus('');

    try {
      const res = await fetch(`/api/journal?date=${today}`);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setJournalError(data?.error || 'Could not load your journal entry.');
        return;
      }

      const data = await res.json();
      const entry: JournalEntry | null = data.entry ?? null;

      setJournalContent(entry?.content ?? '');
      setJournalEntryDate(entry ? today : '');
    } catch (error) {
      console.error('Error fetching journal entry:', error);
      setJournalError('A network error occurred while loading your journal.');
    } finally {
      setJournalLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchHabits();
      fetchJournal();
    } else if (status === 'unauthenticated') {
      setHabits([]);
      setLoading(false);
      setJournalContent('');
      setJournalEntryDate('');
      setJournalLoading(false);
    }
  }, [status]);

  const toggleScheduledDay = (day: number) => {
    setScheduledDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b)
    );
  };

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newHabit.trim()) {
      setFormError('Please enter a habit title.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newHabit.trim(),
          scheduledDays,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(data?.error || 'Could not create the habit.');
        return;
      }

      setNewHabit('');
      setScheduledDays([]);
      await fetchHabits();
    } catch (error) {
      console.error('Error adding habit:', error);
      setFormError('A network error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const completeHabit = async (habitId: string, existingNote: string) => {
    setSavingHabitId(habitId);
    setCompletionErrors((current) => ({
      ...current,
      [habitId]: '',
    }));

    try {
      const res = await fetch(`/api/habits/${habitId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          note: noteDrafts[habitId] ?? existingNote,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCompletionErrors((current) => ({
          ...current,
          [habitId]: data?.error || 'Could not save completion. Please try again.',
        }));
        return;
      }

      await fetchHabits();
    } catch (error) {
      console.error('Error recording habit completion:', error);
      setCompletionErrors((current) => ({
        ...current,
        [habitId]: 'A network error occurred. Please try again.',
      }));
    } finally {
      setSavingHabitId(null);
    }
  };

  const saveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setJournalSaving(true);
    setJournalError('');
    setJournalStatus('');

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          content: journalContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setJournalError(data?.error || 'Could not save your journal entry.');
        return;
      }

      const data = await res.json();
      const entry: JournalEntry | null = data.entry ?? null;

      setJournalContent(entry?.content ?? journalContent);
      setJournalEntryDate(today);
      setJournalStatus('Journal entry saved.');
    } catch (error) {
      console.error('Error saving journal entry:', error);
      setJournalError('A network error occurred while saving your journal.');
    } finally {
      setJournalSaving(false);
    }
  };

  const deleteHabit = async (habitId: string) => {
    try {
      const res = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchHabits();
      } else {
        console.error('Could not delete habit:', await res.text());
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  const formatSchedule = (days: number[]) => {
    if (days.length === 0) {
      return 'No days scheduled';
    }

    if (days.length === 7) {
      return 'Every day';
    }

    return WEEKDAYS
      .filter((day) => days.includes(day.value))
      .map((day) => day.label)
      .join(', ');
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
          Habit &amp; Micro-Journal Tracker
        </h1>

        <p className="text-gray-600 mb-6">
          Sign in to manage your habits and journal.
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
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Habit &amp; Micro-Journal Tracker
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

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-1">
          Daily micro-journal
        </h2>

        <p className="text-sm text-gray-500 mb-4">
          {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        {journalLoading ? (
          <p className="text-gray-500">Loading your journal...</p>
        ) : (
          <form onSubmit={saveJournal} className="space-y-3">
            <label
              htmlFor="daily-journal"
              className="block text-sm font-medium text-gray-700"
            >
              What's on your mind today?
            </label>

            <textarea
              id="daily-journal"
              value={journalContent}
              onChange={(e) => {
                setJournalContent(e.target.value);
                setJournalStatus('');
              }}
              maxLength={10000}
              rows={5}
              placeholder="Write a few thoughts about your day..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />

            {journalEntryDate === today && (
              <p className="text-xs text-gray-500">
                You have a saved entry for today. You can edit it and save again.
              </p>
            )}

            {journalError && (
              <p role="alert" className="text-sm text-red-600">
                {journalError}
              </p>
            )}

            {journalStatus && (
              <p role="status" className="text-sm text-green-700">
                {journalStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={journalSaving}
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {journalSaving ? 'Saving...' : 'Save journal entry'}
            </button>
          </form>
        )}
      </section>

      <form
        onSubmit={addHabit}
        className="mb-8 space-y-4 rounded-lg border p-4"
      >
        <h2 className="text-xl font-semibold text-gray-800">Habits</h2>

        <div>
          <label
            htmlFor="habit-title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            New habit
          </label>

          <input
            id="habit-title"
            type="text"
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="e.g., Read for 20 minutes"
            maxLength={120}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">
            Which days do you want to do this habit?
          </legend>

          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const selected = scheduledDays.includes(day.value);

              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleScheduledDay(day.value)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Select any combination of days. Leave all unselected if the
            habit has no fixed weekly schedule.
          </p>
        </fieldset>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Adding...' : 'Add habit'}
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
          {habits.map((habit) => {
            const todayLog = habit.logs.find(
              (log) => log.date.slice(0, 10) === today && log.completed
            );

            const existingNote = todayLog?.note ?? '';
            const completedCount = habit.logs.filter(
              (log) => log.completed
            ).length;

            return (
              <div
                key={habit.id}
                className="p-4 border rounded-lg shadow-sm bg-white"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {habit.title}
                    </h3>

                    <p className="text-sm text-gray-500 mt-1">
                      Schedule: {formatSchedule(habit.scheduledDays ?? [])}
                    </p>

                    <p className="text-sm text-gray-500">
                      Completed {completedCount} times
                    </p>
                  </div>

                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="px-3 py-2 bg-red-100 text-red-600 font-medium rounded-lg hover:bg-red-200 transition"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <label
                    htmlFor={`note-${habit.id}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Note for today (optional)
                  </label>

                  <textarea
                    id={`note-${habit.id}`}
                    value={noteDrafts[habit.id] ?? existingNote}
                    onChange={(e) =>
                      setNoteDrafts((current) => ({
                        ...current,
                        [habit.id]: e.target.value,
                      }))
                    }
                    maxLength={2000}
                    rows={2}
                    placeholder="How did it go today?"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  />

                  <button
                    onClick={() => completeHabit(habit.id, existingNote)}
                    disabled={savingHabitId === habit.id}
                    className={`px-4 py-2 font-medium rounded-lg transition disabled:opacity-50 ${
                      todayLog
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {savingHabitId === habit.id
                      ? 'Saving...'
                      : todayLog
                        ? "Update today's completion"
                        : 'Mark complete today'}
                  </button>

                  {todayLog && (
                    <p className="text-sm text-green-700">
                      Completed today
                    </p>
                  )}

                  {completionErrors[habit.id] && (
                    <p role="alert" className="text-sm text-red-600">
                      {completionErrors[habit.id]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
