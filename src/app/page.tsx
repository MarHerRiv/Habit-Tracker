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
  pointsEarned?: number;
};

type Habit = {
  id: string;
  title: string;
  createdAt: string;
  scheduledDays: number[];
  points: number;
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
  const [newHabitPoints, setNewHabitPoints] = useState('10');
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
  const [activeView, setActiveView] = useState<
    'home' | 'create' | 'edit' | 'shop' | 'journals'
  >('home');

  // State for the Edit Current Habits screen.
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPoints, setEditPoints] = useState('10');
  const [editScheduledDays, setEditScheduledDays] = useState<number[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editStatus, setEditStatus] = useState('');

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

  const toggleEditScheduledDay = (day: number) => {
    setEditScheduledDays((current) =>
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

    const pointsValue = Number(newHabitPoints);
    if (
      newHabitPoints.trim() === '' ||
      !Number.isSafeInteger(pointsValue) ||
      pointsValue < 0 ||
      pointsValue > 1000000
    ) {
      setFormError('Points must be a whole number from 0 to 1,000,000.');
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
          points: pointsValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(data?.error || 'Could not create the habit.');
        return;
      }

      setNewHabit('');
      setNewHabitPoints('10');
      setScheduledDays([]);
      await fetchHabits();
      setActiveView('home');
    } catch (error) {
      console.error('Error adding habit:', error);
      setFormError('A network error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const completeHabit = async (
    habitId: string,
    existingNote: string,
    completed: boolean
  ) => {
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
          completed,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  const startEditingHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditTitle(habit.title);
    setEditPoints(String(habit.points ?? 10));
    setEditScheduledDays([...(habit.scheduledDays ?? [])]);
    setEditError('');
    setEditStatus('');
  };

  const cancelEditingHabit = () => {
    setEditingHabitId(null);
    setEditTitle('');
    setEditPoints('10');
    setEditScheduledDays([]);
    setEditError('');
  };

  const saveHabitChanges = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingHabitId) return;

    setEditError('');
    setEditStatus('');

    const pointsValue = Number(editPoints);
    if (
      !editTitle.trim() ||
      editTitle.trim().length > 120
    ) {
      setEditError('Enter a habit name between 1 and 120 characters.');
      return;
    }

    if (
      editPoints.trim() === '' ||
      !Number.isSafeInteger(pointsValue) ||
      pointsValue < 0 ||
      pointsValue > 1000000
    ) {
      setEditError('Points must be a whole number from 0 to 1,000,000.');
      return;
    }

    setEditSaving(true);

    try {
      const res = await fetch(`/api/habits/${editingHabitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          points: pointsValue,
          scheduledDays: editScheduledDays,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || 'Could not update the habit.');
        return;
      }

      await fetchHabits();
      setEditingHabitId(null);
      setEditStatus('Habit updated successfully.');
    } catch (error) {
      console.error('Error updating habit:', error);
      setEditError('A network error occurred. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const deleteHabit = async (habitId: string) => {
    const habit = habits.find((item) => item.id === habitId);
    const confirmed = window.confirm(
      `Delete "${habit?.title ?? 'this habit'}"? This action cannot be undone, and its associated completion history will also be deleted.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (editingHabitId === habitId) cancelEditingHabit();
        setEditStatus('Habit deleted.');
        await fetchHabits();
      } else {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || 'Could not delete habit.');
        console.error('Could not delete habit:', data);
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
      setEditError('A network error occurred while deleting the habit.');
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

  const allLogs = habits.flatMap((habit) => habit.logs ?? []);
  const finalizedPoints = allLogs
    .filter((log) => log.completed && log.date.slice(0, 10) < today)
    .reduce((total, log) => total + (log.pointsEarned ?? 0), 0);
  const pendingPoints = allLogs
    .filter((log) => log.completed && log.date.slice(0, 10) === today)
    .reduce((total, log) => total + (log.pointsEarned ?? 0), 0);

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

  const todayWeekday = new Date().getDay();
  const todaysHabits = habits.filter(
    (habit) =>
      !habit.scheduledDays?.length ||
      habit.scheduledDays.includes(todayWeekday)
  );

  const navigation = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: 'create', label: 'Create new Habit', icon: '+' },
    { id: 'edit', label: 'Edit current habits', icon: '✎' },
    { id: 'shop', label: 'Points shop', icon: '✦' },
    { id: 'journals', label: 'View Journals', icon: '▤' },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-24 items-center justify-between gap-6 px-6 py-4 lg:px-10">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Habit &amp; Micro-Journal Tracker
            </h1>
            <p className="mt-1 truncate text-sm text-slate-500">
              Signed in as {session.user?.email}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-right">
              <p className="text-sm font-bold text-amber-950">
                {finalizedPoints.toLocaleString()} points
              </p>
              <p className="text-xs text-amber-800">
                +{pendingPoints.toLocaleString()} pending today
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-97px)] max-w-[1800px]">
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Main navigation">
            {navigation.map((item) => {
              const selected = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                    selected
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-base ${
                    selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-8 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Small steps add up. Keep your momentum going.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-6 lg:p-8">
          {activeView === 'home' && (
            <div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-blue-700">YOUR DASHBOARD</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Today at a glance
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your daily reflection and habits scheduled for today.
                </p>
              </div>

              <div className="grid grid-cols-1 items-start gap-6">
                <section className="min-w-0">
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                        Daily checklist
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">Today’s habits</h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {todaysHabits.filter((habit) =>
                        habit.logs.some((log) => log.date.slice(0, 10) === today && log.completed)
                      ).length} / {todaysHabits.length} complete
                    </span>
                  </div>

                  {loading ? (
                    <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                      Loading habits...
                    </p>
                  ) : todaysHabits.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">
                        +
                      </div>
                      <h4 className="mt-3 font-semibold text-slate-900">Nothing scheduled yet</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Create a habit to start building your daily routine.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveView('create')}
                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Create a habit
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {todaysHabits.map((habit) => {
                        const todayLogRecord = habit.logs.find(
                          (log) => log.date.slice(0, 10) === today
                        );
                        const todayLog = todayLogRecord?.completed ? todayLogRecord : null;
                        const existingNote = todayLogRecord?.note ?? '';
                        const completedCount = habit.logs.filter((log) => log.completed).length;

                        return (
                          <article
                            key={habit.id}
                            className={`flex min-w-0 flex-col rounded-2xl border bg-white p-4 shadow-sm transition ${
                              todayLog ? 'border-emerald-200' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="break-words font-bold text-slate-900">
                                  {habit.title}
                                </h4>
                                <p className="mt-1 text-xs text-slate-500">
                                  {habit.points ?? 10} points · completed {completedCount} times
                                </p>
                              </div>
                              {todayLog && (
                                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                  Done
                                </span>
                              )}
                            </div>

                            <div className="mt-4 flex flex-1 flex-col gap-3">
                              <label
                                htmlFor={`note-${habit.id}`}
                                className="text-xs font-semibold text-slate-600"
                              >
                                Note for today <span className="font-normal text-slate-400">(optional)</span>
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
                                rows={3}
                                placeholder="How did it go?"
                                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                              />

                              {completionErrors[habit.id] && (
                                <p role="alert" className="text-xs text-red-600">
                                  {completionErrors[habit.id]}
                                </p>
                              )}

                              {todayLog ? (
                                <>
                                  <p className="text-xs leading-5 text-emerald-700">
                                    Completed today · +{todayLog.pointsEarned ?? 0} pending points
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => completeHabit(habit.id, existingNote, false)}
                                    disabled={savingHabitId === habit.id}
                                    className="mt-auto rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    {savingHabitId === habit.id ? 'Saving...' : 'Undo completion'}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => completeHabit(habit.id, existingNote, true)}
                                  disabled={savingHabitId === habit.id}
                                  className="mt-auto rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {savingHabitId === habit.id
                                    ? 'Saving...'
                                    : `Complete (+${habit.points ?? 10} points)`}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => deleteHabit(habit.id)}
                                className="self-start text-xs font-medium text-slate-400 transition hover:text-red-600"
                              >
                                Delete habit
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                      Daily reflection
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">
                      Micro-journal
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  {journalLoading ? (
                    <p className="py-4 text-sm text-slate-500">Loading your journal...</p>
                  ) : (
                    <form onSubmit={saveJournal} className="space-y-3">
                      <label
                        htmlFor="daily-journal"
                        className="block text-sm font-medium text-slate-700"
                      >
                        What’s on your mind today?
                      </label>
                      <textarea
                        id="daily-journal"
                        value={journalContent}
                        onChange={(e) => {
                          setJournalContent(e.target.value);
                          setJournalStatus('');
                        }}
                        maxLength={10000}
                        rows={10}
                        placeholder="Write a few thoughts about your day..."
                        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                      {journalEntryDate === today && (
                        <p className="text-xs text-slate-500">
                          You have a saved entry for today. You can edit it and save again.
                        </p>
                      )}
                      {journalError && (
                        <p role="alert" className="text-sm text-red-600">{journalError}</p>
                      )}
                      {journalStatus && (
                        <p role="status" className="text-sm text-emerald-700">{journalStatus}</p>
                      )}
                      <button
                        type="submit"
                        disabled={journalSaving}
                        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {journalSaving ? 'Saving...' : 'Save journal entry'}
                      </button>
                    </form>
                  )}
                </section>
              </div>
            </div>
          )}

          {activeView === 'create' && (
            <div className="mx-auto max-w-3xl">
              <p className="text-sm font-semibold text-blue-700">HABIT MANAGEMENT</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Create a new habit
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Set a name, choose a weekly schedule, and decide how many points it earns.
              </p>

              <form
                onSubmit={addHabit}
                className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div>
                  <label htmlFor="habit-title" className="mb-2 block text-sm font-semibold text-slate-700">
                    Habit name
                  </label>
                  <input
                    id="habit-title"
                    type="text"
                    value={newHabit}
                    onChange={(e) => setNewHabit(e.target.value)}
                    placeholder="e.g., Read for 20 minutes"
                    maxLength={120}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="habit-points" className="mb-2 block text-sm font-semibold text-slate-700">
                    Points for completing this habit
                  </label>
                  <input
                    id="habit-points"
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    required
                    value={newHabitPoints}
                    onChange={(e) => setNewHabitPoints(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Points stay pending until the end of the day. You can undo a completion during the day to remove its pending points.
                  </p>
                </div>

                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-slate-700">
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
                          className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                            selected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Select any combination of days. Leave all unselected if the habit has no fixed weekly schedule.
                  </p>
                </fieldset>

                {formError && (
                  <p role="alert" className="text-sm text-red-600">{formError}</p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Creating habit...' : 'Create habit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('home')}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to Home
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeView === 'edit' && (
            <div className="mx-auto max-w-5xl">
              <p className="text-sm font-semibold text-blue-700">HABIT MANAGEMENT</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Edit current habits
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update a habit’s name, point value, or weekly schedule. Existing completion history and earned points are preserved.
              </p>

              {editStatus && (
                <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {editStatus}
                </p>
              )}
              {editError && (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {editError}
                </p>
              )}

              {loading ? (
                <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  Loading habits...
                </p>
              ) : habits.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <h3 className="font-semibold text-slate-900">No habits to manage yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Create your first habit before editing it.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditError('');
                      setEditStatus('');
                      setActiveView('create');
                    }}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Create a habit
                  </button>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {habits.map((habit) => {
                    const isEditing = editingHabitId === habit.id;
                    const completedCount = (habit.logs ?? []).filter((log) => log.completed).length;

                    return (
                      <article
                        key={habit.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        {!isEditing ? (
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="break-words text-lg font-bold text-slate-900">
                                {habit.title}
                              </h3>
                              <p className="mt-1 text-sm text-slate-600">
                                {habit.points ?? 10} points per completion
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Schedule: {formatSchedule(habit.scheduledDays ?? [])}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Completed {completedCount} {completedCount === 1 ? 'time' : 'times'}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingHabit(habit)}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteHabit(habit.id)}
                                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={saveHabitChanges} className="space-y-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                                  Editing habit
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900">
                                  {habit.title}
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={cancelEditingHabit}
                                disabled={editSaving}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>

                            <div>
                              <label htmlFor={`edit-title-${habit.id}`} className="mb-2 block text-sm font-semibold text-slate-700">
                                Habit name
                              </label>
                              <input
                                id={`edit-title-${habit.id}`}
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                maxLength={120}
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div>
                              <label htmlFor={`edit-points-${habit.id}`} className="mb-2 block text-sm font-semibold text-slate-700">
                                Points per completion
                              </label>
                              <input
                                id={`edit-points-${habit.id}`}
                                type="number"
                                min={0}
                                max={1000000}
                                step={1}
                                value={editPoints}
                                onChange={(e) => setEditPoints(e.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              />
                              <p className="mt-2 text-xs text-slate-500">
                                This changes the points awarded for future completions. Points already recorded in your history are not recalculated.
                              </p>
                            </div>

                            <fieldset>
                              <legend className="mb-3 text-sm font-semibold text-slate-700">
                                Weekly schedule
                              </legend>
                              <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map((day) => {
                                  const selected = editScheduledDays.includes(day.value);
                                  return (
                                    <button
                                      key={day.value}
                                      type="button"
                                      aria-pressed={selected}
                                      onClick={() => toggleEditScheduledDay(day.value)}
                                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                                        selected
                                          ? 'border-blue-600 bg-blue-600 text-white'
                                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      {day.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="mt-3 text-xs text-slate-500">
                                Selected days determine when the habit appears on Home. Leave all days unselected for a flexible habit.
                              </p>
                            </fieldset>

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="submit"
                                disabled={editSaving}
                                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {editSaving ? 'Saving changes...' : 'Save changes'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingHabit}
                                disabled={editSaving}
                                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeView === 'shop' && (
            <ComingSoon title="Points shop" description="You’ll be able to spend your earned points here in a future update." />
          )}
          {activeView === 'journals' && (
            <ComingSoon title="View Journals" description="Browse and revisit your previous journal entries here in a future update." />
          )}
        </section>
      </div>
    </main>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">
          ✦
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-blue-700">
          Coming soon
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
