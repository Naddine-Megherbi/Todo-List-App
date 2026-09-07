import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, LogOut,
  Menu, Plus, Search, Sparkles, Trash2, X
} from 'lucide-react';

type Theme = { id: string; name: string; color: string };
type Task = {
  id: string; theme_id: string | null; title: string; notes: string | null;
  due_at: string | null; reminder_at: string | null; completed: boolean; completed_at: string | null;
};

const palette = ['#F29E89', '#F4C95D', '#8BC6A8', '#80B7D8', '#B7A4D4', '#D78FA5', '#9CA3AF'];

function formatDue(date: string | null) {
  if (!date) return 'No deadline';
  const value = new Date(date);
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isOverdue(task: Task) {
  return Boolean(task.due_at && !task.completed && new Date(task.due_at).getTime() < Date.now());
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === 'signup' && !result.data.session) setError('Account created. You can now sign in.');
    setBusy(false);
  };
  return (
    <main className="auth-shell">
      <div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" />
      <section className="auth-card">
        <div className="brand-mark"><Check size={20} strokeWidth={3} /></div>
        <p className="eyebrow">YOUR SPACE TO FOCUS</p>
        <h1>Little things,<br /><em>beautifully done.</em></h1>
        <p className="auth-copy">A calmer way to organize your day, one small step at a time.</p>
        <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Create account</button></div>
        <form onSubmit={submit} className="auth-form">
          <label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
          {error && <p className="form-message">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Enter my space' : 'Start my space'} <span>→</span></button>
        </form>
      </section>
      <p className="auth-footer"><Sparkles size={14} /> Made for your everyday moments</p>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);
  if (loading) return <div className="loading-screen"><div className="brand-mark"><Check size={20} /></div></div>;
  return session ? <Workspace session={session} /> : <AuthScreen />;
}

function Workspace({ session }: { session: Session }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataError, setDataError] = useState('');
  const [now, setNow] = useState(Date.now());

  const loadData = async () => {
    const [themeResult, taskResult] = await Promise.all([
      supabase.from('todo_themes').select('id, name, color').order('created_at'),
      supabase.from('todo_tasks').select('id, theme_id, title, notes, due_at, reminder_at, completed, completed_at').order('created_at', { ascending: false })
    ]);
    if (themeResult.error || taskResult.error) setDataError('We could not load your list right now. Please refresh and try again.');
    else { setThemes(themeResult.data ?? []); setTasks(taskResult.data ?? []); }
  };
  useEffect(() => { void loadData(); const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const dueReminder = tasks.find(task => task.reminder_at && !task.completed && new Date(task.reminder_at).getTime() <= now && new Date(task.reminder_at).getTime() > now - 45000);
    if (dueReminder && 'Notification' in window && Notification.permission === 'granted') new Notification('A little reminder from daymark', { body: dueReminder.title });
  }, [now, tasks]);

  const visibleTasks = useMemo(() => tasks.filter(task => (selectedTheme === 'all' || task.theme_id === selectedTheme) && task.title.toLowerCase().includes(search.toLowerCase())), [tasks, selectedTheme, search]);
  const activeTasks = visibleTasks.filter(task => !task.completed).sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || new Date(a.due_at ?? '2999').getTime() - new Date(b.due_at ?? '2999').getTime());
  const doneTasks = visibleTasks.filter(task => task.completed).sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime());
  const completedToday = tasks.filter(task => task.completed && task.completed_at && new Date(task.completed_at).toDateString() === new Date().toDateString()).length;
  const currentTheme = themes.find(theme => theme.id === selectedTheme);
  const completeTask = async (task: Task) => {
    const completed = !task.completed; const completedAt = completed ? new Date().toISOString() : null;
    setTasks(current => current.map(item => item.id === task.id ? { ...item, completed, completed_at: completedAt } : item));
    const { error } = await supabase.from('todo_tasks').update({ completed, completed_at: completedAt }).eq('id', task.id);
    if (error) void loadData();
  };
  const deleteTask = async (id: string) => { setTasks(current => current.filter(task => task.id !== id)); const { error } = await supabase.from('todo_tasks').delete().eq('id', id); if (error) void loadData(); };
  const logout = async () => { await supabase.auth.signOut(); };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-top"><div className="brand-lockup"><div className="brand-mark small"><Check size={17} /></div><span>daymark</span></div><button className="close-mobile" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
      <div className="profile"><div className="avatar">{(session.user.email?.[0] ?? 'U').toUpperCase()}</div><div><strong>{session.user.email?.split('@')[0]}</strong><span>Keeping it together</span></div><ChevronDown size={15} /></div>

      <div className="sidebar-bottom"><div className="mini-progress"><div className="progress-heading"><span>Today’s progress</span><strong>{completedToday}/{tasks.filter(t => !t.completed || (t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString())).length || 0}</strong></div><div className="progress-track"><span style={{ width: `${tasks.length ? Math.min(100, completedToday / Math.max(1, tasks.filter(t => !t.completed || (t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString())).length) * 100) : 0}%` }} /></div></div><button className="logout" onClick={logout}><LogOut size={16} /> Sign out</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><div className="breadcrumb"><span>My space</span><i>/</i><strong>{currentTheme?.name ?? 'All tasks'}</strong></div><div className="top-actions"><div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks" /></div><button className="icon-button" title="Reminders"><Bell size={18} /><span className="notification-dot" /></button></div></header>
      <div className="content-wrap"><div className="theme-bar"><button className={selectedTheme === 'all' ? 'theme-chip active' : 'theme-chip'} onClick={() => setSelectedTheme('all')}><span className="nav-dot all-dot" />All tasks<b>{tasks.filter(t => !t.completed).length}</b></button>{themes.map(theme => <button key={theme.id} className={selectedTheme === theme.id ? 'theme-chip active' : 'theme-chip'} onClick={() => setSelectedTheme(theme.id)}><span className="nav-dot" style={{ background: theme.color }} />{theme.name}<b>{tasks.filter(t => t.theme_id === theme.id && !t.completed).length || ''}</b></button>)}<button className="add-theme-chip" onClick={() => setShowThemeModal(true)}><Plus size={15} /></button></div><section className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</p><h2>{currentTheme?.name ?? 'All tasks'}<span className="title-spark">✦</span></h2><p className="subtitle">A little progress is still progress.</p></div><div className="summary-card"><div className="summary-icon"><CheckCircle2 size={20} /></div><div><strong>{completedToday} {completedToday === 1 ? 'thing' : 'things'} done</strong><span>Keep the momentum going</span></div></div></section>
        {dataError && <div className="data-error">{dataError}</div>}
        <section className="task-section"><div className="section-heading"><h3>To do <span>{activeTasks.length}</span></h3></div>{activeTasks.length === 0 ? <EmptyState onAdd={() => setShowTaskModal(true)} /> : <div className="task-list">{activeTasks.map(task => <TaskRow key={task.id} task={task} themes={themes} onComplete={completeTask} onDelete={deleteTask} />)}</div>}</section>
        {doneTasks.length > 0 && <section className="completed-section"><div className="completed-divider"><span>COMPLETED</span><i /></div><div className="task-list done-list">{doneTasks.map(task => <TaskRow key={task.id} task={task} themes={themes} onComplete={completeTask} onDelete={deleteTask} />)}</div></section>}
      </div>
      <button className="floating-add" onClick={() => setShowTaskModal(true)}><Plus size={28} strokeWidth={2.3} /></button>
    </main>
    {showTaskModal && <TaskModal themes={themes} defaultTheme={selectedTheme === 'all' ? themes[0]?.id ?? '' : selectedTheme} onClose={() => setShowTaskModal(false)} onCreated={task => { setTasks(current => [task, ...current]); setShowTaskModal(false); }} />}
    {showThemeModal && <ThemeModal onClose={() => setShowThemeModal(false)} onCreated={theme => { setThemes(current => [...current, theme]); setSelectedTheme(theme.id); setShowThemeModal(false); }} />}
  </div>;
}

function TaskRow({ task, themes, onComplete, onDelete }: { task: Task; themes: Theme[]; onComplete: (task: Task) => void; onDelete: (id: string) => void }) {
  const overdue = isOverdue(task); const theme = themes.find(item => item.id === task.theme_id);
  return <article className={`task-row ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}`}><button className="check-button" onClick={() => onComplete(task)} aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}>{task.completed && <Check size={15} strokeWidth={3} />}</button><div className="task-main"><div className="task-title-line"><h4>{task.title}</h4>{theme && <span className="task-tag" style={{ background: `${theme.color}33`, color: theme.color }}>{theme.name}</span>}</div>{task.notes && <p>{task.notes}</p>}<div className="task-meta"><span className={overdue ? 'late' : ''}>{overdue ? <Clock3 size={14} /> : <CalendarDays size={14} />}{overdue ? 'Overdue · ' : ''}{formatDue(task.due_at)}</span>{task.reminder_at && <span><Bell size={13} /> Reminder set</span>}</div></div><button className="delete-button" onClick={() => onDelete(task.id)} aria-label="Delete task"><Trash2 size={17} /></button></article>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) { return <div className="empty-state"><div className="empty-art"><Check size={30} /></div><h4>Nothing pressing right now</h4><p>Give your future self a hand and add the next little thing.</p><button onClick={onAdd}><Plus size={16} /> Add your first task</button></div>; }

function TaskModal({ themes, defaultTheme, onClose, onCreated }: { themes: Theme[]; defaultTheme: string; onClose: () => void; onCreated: (task: Task) => void }) {
  const [title, setTitle] = useState(''); const [notes, setNotes] = useState(''); const [themeId, setThemeId] = useState(defaultTheme); const [dueDate, setDueDate] = useState(''); const [dueHour, setDueHour] = useState(''); const [dueMinute, setDueMinute] = useState(''); const [reminderDate, setReminderDate] = useState(''); const [reminderHour, setReminderHour] = useState(''); const [reminderMinute, setReminderMinute] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); if (reminderDate && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); const due = dueDate && dueHour && dueMinute ? `${dueDate}T${dueHour}:${dueMinute}` : ''; const reminder = reminderDate && reminderHour && reminderMinute ? `${reminderDate}T${reminderHour}:${reminderMinute}` : ''; const payload = { title: title.trim(), notes: notes.trim() || null, theme_id: themeId || null, due_at: due ? new Date(due).toISOString() : null, reminder_at: reminder ? new Date(reminder).toISOString() : null }; const { data, error: insertError } = await supabase.from('todo_tasks').insert(payload).select('id, theme_id, title, notes, due_at, reminder_at, completed, completed_at').maybeSingle(); if (insertError || !data) setError(insertError?.message ?? 'Could not create task.'); else onCreated(data as Task); setBusy(false); };
  return <Modal title="Add a little thing" onClose={onClose}><form onSubmit={submit} className="modal-form"><label>What needs doing?<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Water the plants" /></label><label>Notes <span>optional</span><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything helpful to remember…" rows={3} /></label><div className="form-grid"><DateTimeFields label="Deadline" date={dueDate} hour={dueHour} minute={dueMinute} onDateChange={setDueDate} onHourChange={setDueHour} onMinuteChange={setDueMinute} /><DateTimeFields label="Reminder" date={reminderDate} hour={reminderHour} minute={reminderMinute} onDateChange={setReminderDate} onHourChange={setReminderHour} onMinuteChange={setReminderMinute} /></div><label>Theme<select value={themeId} onChange={e => setThemeId(e.target.value)}><option value="">No theme</option>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>{error && <p className="form-message">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Add'} <span>→</span></button></form></Modal>;
}

function DateTimeFields({ label, date, hour, minute, onDateChange, onHourChange, onMinuteChange }: { label: string; date: string; hour: string; minute: string; onDateChange: (value: string) => void; onHourChange: (value: string) => void; onMinuteChange: (value: string) => void }) {
  return <div className="date-time-fields"><label>{label} <span>optional</span><input type="date" value={date} onChange={event => onDateChange(event.target.value)} /></label><div className="time-selects"><select aria-label={`${label} hour`} value={hour} onChange={event => onHourChange(event.target.value)}><option value="">Hour</option>{Array.from({ length: 24 }, (_, index) => { const value = String(index).padStart(2, '0'); return <option key={value} value={value}>{value}</option>; })}</select><select aria-label={`${label} minute`} value={minute} onChange={event => onMinuteChange(event.target.value)}><option value="">Min</option>{Array.from({ length: 60 }, (_, index) => { const value = String(index).padStart(2, '0'); return <option key={value} value={value}>{value}</option>; })}</select></div></div>;
}

function ThemeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (theme: Theme) => void }) { const [name, setName] = useState(''); const [color, setColor] = useState(palette[0]); const [busy, setBusy] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); const { data, error } = await supabase.from('todo_themes').insert({ name: name.trim(), color }).select('id, name, color').maybeSingle(); if (!error && data) onCreated(data as Theme); setBusy(false); }; return <Modal title="Create a new theme" onClose={onClose}><form onSubmit={submit} className="modal-form"><label>Theme name<input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home, Ideas, Health" /></label><label>Choose a color</label><div className="color-picker">{palette.map(item => <button type="button" key={item} className={color === item ? 'selected' : ''} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Choose ${item}`} />)}</div><button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create theme'} <span>→</span></button></form></Modal>; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal"><div className="modal-head"><div><p className="eyebrow">A SMALL STEP</p><h3>{title}</h3></div><button className="modal-close" onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }

export default App;
