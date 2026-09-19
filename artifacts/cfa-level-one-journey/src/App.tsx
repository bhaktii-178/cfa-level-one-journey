import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpFromLine, BarChart3, BookOpen, CalendarDays,
  ChevronRight, Clock3, FileText, Flame, FolderOpen, LayoutDashboard, Menu,
  NotebookPen, PanelLeftClose, Plus, Search, Settings2, Target, TrendingUp, X, type LucideIcon,
} from 'lucide-react';
import { subjects, readings, type Reading, type Subject } from '@/data/curriculum';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

type Status = 'not_started' | 'in_progress' | 'completed' | 'needs_revision';
type Progress = { status: Status; confidence: number; notes: string; lastStudied: string | null; revisionCount: number };
type ProgressMap = Record<string, Progress>;
type Session = { id: string; date: string; subjectId: string; topicId: string; durationMinutes: number; notes: string };
type Snapshot = { progress: ProgressMap; sessions: Session[] };
type Store = { progress: ProgressMap; sessions: Session[]; updateProgress: (id: string, patch: Partial<Progress>) => void; addSession: (session: Session) => void };

const STORAGE_KEY = 'cfa-2027-journey-v1';
const examDate = new Date('2027-02-20T08:00:00');
const motivationalLines = ['A steady hour compounds.', 'Return to the next useful page.', 'Clarity comes from showing up.', 'Small sessions build a large edge.', 'Study the question behind the formula.'];

const initialProgress = (): ProgressMap => Object.fromEntries(readings.map((topic) => [topic.id, {
  status: 'not_started', confidence: 1, notes: '', lastStudied: null, revisionCount: 0,
}]));

function readSnapshot(): Snapshot {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Snapshot;
      return { progress: { ...initialProgress(), ...(parsed.progress || {}) }, sessions: parsed.sessions || [] };
    }
  } catch { /* local storage can be unavailable or malformed; start clean */ }
  return { progress: initialProgress(), sessions: [] };
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins ? `${mins}m` : ''}` : `${mins}m`;
}
function formatDate(value: string | null) {
  if (!value) return 'Not studied yet';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function subjectFor(id: string) { return subjects.find((subject) => subject.id === id) || subjects[0]; }
function topicFor(id: string) { return readings.find((topic) => topic.id === id); }
function daysBetween(a: Date, b: Date) { return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / 86400000)); }

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(readSnapshot);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }, [snapshot]);
  const store: Store = {
    ...snapshot,
    updateProgress: (id, patch) => setSnapshot((current) => ({
      ...current, progress: { ...current.progress, [id]: { ...current.progress[id], ...patch } },
    })),
    addSession: (session) => setSnapshot((current) => ({ ...current, sessions: [session, ...current.sessions] })),
  };
  const backup = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'cfa-2027-journey-backup.json'; anchor.click(); URL.revokeObjectURL(url);
  };
  const importSnapshot = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result)) as Snapshot;
        if (incoming.progress && Array.isArray(incoming.sessions)) {
          setSnapshot({ progress: { ...initialProgress(), ...incoming.progress }, sessions: incoming.sessions });
        }
      } catch { /* invalid import stays safely ignored */ }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <TooltipProvider>
        <div className="grain min-h-[100dvh] bg-background">
          <Shell mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} backup={backup} importSnapshot={importSnapshot}>
            <ErrorBoundary resetKey={window.location.pathname}>
              <Switch>
                <Route path="/">{() => <Dashboard store={store} />}</Route>
                <Route path="/curriculum">{() => <Curriculum store={store} />}</Route>
                <Route path="/sessions">{() => <Sessions store={store} />}</Route>
                <Route path="/subjects/:subjectId">{() => <SubjectDetail store={store} />}</Route>
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
          </Shell>
          <Toaster />
        </div>
      </TooltipProvider>
    </WouterRouter>
  );
}

function Shell({ children, mobileOpen, setMobileOpen, backup, importSnapshot }: {
  children: ReactNode; mobileOpen: boolean; setMobileOpen: (open: boolean) => void;
  backup: () => void; importSnapshot: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [location] = useLocation();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const nav = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/curriculum', label: 'Curriculum', icon: BookOpen },
    { href: '/sessions', label: 'Study sessions', icon: Clock3 },
  ];
  return (
    <div className="flex min-h-[100dvh]">
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-navigation-overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[hsl(211_43%_27%/.2)] md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-border bg-[hsl(var(--card)/.88)] px-4 py-5 backdrop-blur-xl transition-transform md:sticky md:top-0 md:h-[100dvh] md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${desktopCollapsed ? 'md:w-[82px]' : ''}`}>
        <div className={`mb-10 flex items-center ${desktopCollapsed ? 'justify-center' : 'gap-3'} px-2`}>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Target size={19} strokeWidth={1.8} /></div>
          {!desktopCollapsed && <div><div className="font-serif text-[20px] font-semibold leading-none tracking-[-.03em]">The February<br /><span className="text-accent">ledger</span></div><div className="mt-2 font-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">CFA level I · 2027</div></div>}
        </div>
        <div className={`mb-3 px-3 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground ${desktopCollapsed ? 'text-center' : ''}`}>{desktopCollapsed ? '·' : 'Study desk'}</div>
        <nav className="space-y-1" aria-label="Primary navigation">
          {nav.map(({ href, label, icon: Icon }) => <NavItem key={href} href={href} label={label} icon={Icon} active={location === href} collapsed={desktopCollapsed} onClick={() => setMobileOpen(false)} />)}
        </nav>
        {!desktopCollapsed && <div className="mt-8 px-3 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Your map</div>}
        <nav className="mt-3 space-y-1">
          {subjects.slice(0, 5).map((subject) => <Link key={subject.id} href={`/subjects/${subject.id}`} onClick={() => setMobileOpen(false)} data-testid={`link-subject-${subject.id}`} className={`group flex items-center rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-secondary ${desktopCollapsed ? 'justify-center' : 'gap-3'}`}>
            <span className="size-2 rounded-full" style={{ backgroundColor: subject.accent }} />{!desktopCollapsed && <span className="truncate text-muted-foreground group-hover:text-foreground">{subject.shortLabel}</span>}
          </Link>)}
        </nav>
        <div className="mt-auto space-y-2">
          {!desktopCollapsed && <div className="rounded-xl border border-border bg-secondary/50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full bg-accent" />Stored locally</div><p className="text-[11px] leading-relaxed text-muted-foreground">Your notes stay in this browser. Back up when you need a second copy.</p></div>}
          <button type="button" data-testid="button-toggle-sidebar" onClick={() => setDesktopCollapsed(!desktopCollapsed)} className="hidden w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:flex">{desktopCollapsed ? <Menu size={17} /> : <PanelLeftClose size={17} />}</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/85 px-5 backdrop-blur-xl md:px-10">
          <button type="button" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden"><Menu size={20} /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-accent" />Local workspace <span className="text-border">/</span> February 2027</div>
          <div className="ml-auto flex items-center gap-2">
            <input id="import-backup" type="file" accept="application/json" className="hidden" onChange={importSnapshot} />
            <label htmlFor="import-backup" data-testid="button-import-backup" className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><ArrowUpFromLine size={14} /> <span className="hidden sm:inline">Import</span></label>
            <button type="button" data-testid="button-export-backup" onClick={backup} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-px"><ArrowDownToLine size={14} /> <span className="hidden sm:inline">Backup</span></button>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-11">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active, collapsed, onClick }: { href: string; label: string; icon: LucideIcon; active: boolean; collapsed: boolean; onClick: () => void }) {
  return <Link href={href} onClick={onClick} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${collapsed ? 'justify-center' : 'gap-3'} ${active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.8} />{!collapsed && label}</Link>;
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 font-mono text-[10px] uppercase tracking-[.22em] text-accent">{eyebrow}</div><h1 className="font-serif text-[38px] leading-[.98] tracking-[-.045em] text-primary md:text-[48px]">{title}</h1></div>{children}</div>;
}

function Dashboard({ store }: { store: Store }) {
  const [lineIndex] = useState(() => new Date().getDate() % motivationalLines.length);
  const now = new Date();
  const completed = readings.filter((topic) => store.progress[topic.id]?.status === 'completed').length;
  const average = readings.reduce((sum, topic) => sum + (store.progress[topic.id]?.confidence || 1), 0) / readings.length;
  const totalMinutes = store.sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const monthMinutes = store.sessions.filter((s) => daysBetween(new Date(s.date), now) <= 30).reduce((sum, session) => sum + session.durationMinutes, 0);
  const days = daysBetween(now, examDate);
  const progressPct = Math.round((completed / readings.length) * 100);
  const subjectStats = subjects.map((subject) => {
    const items = readings.filter((topic) => topic.subjectId === subject.id);
    const done = items.filter((topic) => store.progress[topic.id]?.status === 'completed').length;
    const averageConfidence = items.length ? items.reduce((sum, topic) => sum + (store.progress[topic.id]?.confidence || 1), 0) / items.length : 0;
    return { subject, count: items.length, done, averageConfidence, pct: items.length ? Math.round(done / items.length * 100) : 0 };
  }).filter((item) => item.count);
  const next = readings.filter((topic) => {
    const p = store.progress[topic.id];
    const stale = p?.lastStudied ? daysBetween(new Date(`${p.lastStudied}T12:00:00`), now) > 14 : false;
    return p?.status !== 'completed' && (p?.status === 'needs_revision' || p?.confidence <= 2 || !p?.lastStudied || stale);
  }).slice(0, 4);
  const recent = store.sessions.slice(0, 3);
  return <div className="page-enter">
    <PageHeading eyebrow="Wednesday · your study desk" title="Keep the thread." />
    <div className="mb-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="relative overflow-hidden rounded-2xl bg-primary p-7 text-primary-foreground paper-shadow md:p-9">
        <div className="absolute -right-10 -top-14 size-60 rounded-full border border-primary-foreground/10" /><div className="absolute -right-2 -top-6 size-40 rounded-full border border-primary-foreground/10" />
        <div className="relative max-w-xl"><div className="mb-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/65"><CalendarDays size={14} /> February 20, 2027 <span className="text-primary-foreground/30">·</span> {days} days to go</div><div className="font-serif text-[30px] leading-tight tracking-[-.03em] md:text-[38px]">“{motivationalLines[lineIndex]}”</div><p className="mt-5 max-w-md text-sm leading-relaxed text-primary-foreground/65">This is a quiet place to see what you know, what needs another pass, and where today’s hour can do the most good.</p></div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-7 paper-shadow"><div className="mb-5 flex items-center justify-between"><div className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Journey so far</div><span className="text-xs font-semibold text-accent">{progressPct}%</span></div><div className="mb-5 flex items-end gap-2"><span className="font-serif text-6xl leading-none text-primary">{completed}</span><span className="mb-1 text-sm text-muted-foreground">of {readings.length} readings complete</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progressPct}%` }} /></div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs"><div><div className="text-muted-foreground">Remaining</div><div className="mt-1 font-semibold text-primary">{readings.length - completed} readings</div></div><div><div className="text-muted-foreground">Confidence</div><div className="mt-1 font-semibold text-primary">{average.toFixed(1)} <span className="font-normal text-muted-foreground">/ 5</span></div></div></div></section>
    </div>
    <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
      <Metric label="Study hours" value={formatDuration(totalMinutes) || '0m'} icon={Clock3} detail="all logged time" />
      <Metric label="This week" value={formatDuration(store.sessions.filter((s) => daysBetween(new Date(s.date), now) <= 7).reduce((a, s) => a + s.durationMinutes, 0))} icon={TrendingUp} detail="logged sessions" />
      <Metric label="This month" value={formatDuration(monthMinutes)} icon={CalendarDays} detail="last 30 days" />
      <Metric label="Sessions" value={String(store.sessions.length)} icon={NotebookPen} detail="in your journal" />
      <Metric label="Streak" value={`${calculateStreak(store.sessions)}d`} icon={Flame} detail="days in a row" />
    </div>
    <div className="grid gap-8 xl:grid-cols-[1.15fr_.85fr]">
      <section><SectionHeader title="Next on the desk" actionLabel="View curriculum" actionHref="/curriculum" />{next.length ? <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{next.map((topic) => <NextItem key={topic.id} topic={topic} progress={store.progress[topic.id]} />)}</div> : <EmptyState title="The queue is clear." detail="Every reading has a completed mark. Take a breath, then revisit your lowest confidence topics." />}</section>
       <section><SectionHeader title="By subject" actionLabel="Full map" actionHref="/curriculum" /><div className="space-y-3 rounded-xl border border-border bg-card p-5">{subjectStats.slice(0, 6).map(({ subject, count, done, averageConfidence, pct }) => <Link href={`/subjects/${subject.id}`} key={subject.id} data-testid={`link-dashboard-subject-${subject.id}`} className="group block"><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium group-hover:text-accent">{subject.shortLabel}</span><span className="font-mono text-[10px] text-muted-foreground">{done}/{count} · {averageConfidence.toFixed(1)}/5</span></div><div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: subject.accent }} /></div></Link>)}<Link href="/curriculum" className="mt-2 flex items-center justify-end gap-1 text-xs font-semibold text-accent">All subjects <ChevronRight size={13} /></Link></div></section>
    </div>
    <section className="mt-8"><SectionHeader title="Recent sessions" actionLabel="Log a session" actionHref="/sessions" />{recent.length ? <div className="grid gap-3 md:grid-cols-3">{recent.map((session) => <SessionCard key={session.id} session={session} />)}</div> : <EmptyState title="Your study log is waiting." detail="A short session is enough to start the record. Log what you study and it will show up here." action={<Link href="/sessions" data-testid="link-empty-log-session" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Log first session <ChevronRight size={14} /></Link>} />}</section>
  </div>;
}

function Metric({ label, value, icon: Icon, detail }: { label: string; value: string; icon: LucideIcon; detail: string }) {
  return <div className="rounded-xl border border-border bg-card p-4 paper-shadow"><div className="mb-4 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</span><Icon size={16} className="text-accent" /></div><div className="font-serif text-[28px] leading-none text-primary">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{detail}</div></div>;
}
function SectionHeader({ title, actionLabel, actionHref }: { title: string; actionLabel: string; actionHref: string }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-[23px] tracking-[-.03em] text-primary">{title}</h2><Link href={actionHref} data-testid={`link-section-${title.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-primary">{actionLabel}<ChevronRight size={14} /></Link></div>;
}
function NextItem({ topic, progress }: { topic: Reading; progress: Progress }) {
  const subject = subjectFor(topic.subjectId);
  const stale = progress.lastStudied ? daysBetween(new Date(`${progress.lastStudied}T12:00:00`), new Date()) > 14 : false;
  const reason = progress.status === 'needs_revision' ? 'Needs another pass' : progress.confidence <= 2 ? 'Low confidence' : !progress.lastStudied ? 'Not studied yet' : stale ? 'Not studied recently' : 'Worth another look';
  return <Link href={`/subjects/${subject.id}`} data-testid={`link-next-${topic.id}`} className="group flex items-center gap-4 p-4 transition-colors hover:bg-secondary/50"><span className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold" style={{ backgroundColor: `${subject.accent}1c`, color: subject.accent }}>{topic.readingNumber.padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary group-hover:text-accent">{topic.title}</span><span className="mt-1 block text-xs text-muted-foreground">{subject.shortLabel} · {reason}</span></span><ChevronRight size={16} className="text-muted-foreground" /></Link>;
}
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"><div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground"><FolderOpen size={18} /></div><h3 className="font-semibold text-primary">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{detail}</p>{action}</div>;
}
function calculateStreak(sessions: Session[]) {
  const unique = [...new Set(sessions.map((s) => s.date))].sort().reverse();
  if (!unique.length) return 0;
  let streak = 0; const cursor = new Date(); cursor.setHours(12, 0, 0, 0);
  for (const date of unique) {
    const expected = cursor.toISOString().slice(0, 10);
    const diff = Math.round((cursor.getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000);
    if (diff > streak + 1 && !(streak === 0 && diff === 1)) break;
    if (date === expected || (streak === 0 && diff === 1)) { streak++; cursor.setDate(cursor.getDate() - 1); } else break;
  }
  return streak;
}
function SessionCard({ session }: { session: Session }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span>{formatDate(session.date)}</span><span className="font-mono">{formatDuration(session.durationMinutes)}</span></div><div className="mt-4 truncate text-sm font-semibold text-primary">{topicFor(session.topicId)?.title || 'Study session'}</div><div className="mt-1 text-xs text-muted-foreground">{subjectFor(session.subjectId).shortLabel}</div>{session.notes && <p className="mt-3 line-clamp-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{session.notes}</p>}</div>;
}

function Curriculum({ store }: { store: Store }) {
  const [query, setQuery] = useState(''); const [subjectFilter, setSubjectFilter] = useState('all'); const [statusFilter, setStatusFilter] = useState('all');
  const filtered = readings.filter((topic) => {
    const matchesQuery = `${topic.title} ${subjectFor(topic.subjectId).name}`.toLowerCase().includes(query.toLowerCase());
    const matchesSubject = subjectFilter === 'all' || topic.subjectId === subjectFilter;
    const matchesStatus = statusFilter === 'all' || store.progress[topic.id]?.status === statusFilter;
    return matchesQuery && matchesSubject && matchesStatus;
  });
  return <div className="page-enter"><PageHeading eyebrow="The reading map" title="Curriculum"><div className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 size={15} className="text-accent" /> {filtered.length} of {readings.length} readings</div></PageHeading>
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 md:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-search-curriculum" placeholder="Search readings or subjects" className="focus-ring h-10 w-full rounded-lg bg-secondary/60 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" /></label><div className="flex gap-2"><select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} data-testid="select-filter-subject" className="focus-ring h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs outline-none md:w-44"><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.shortLabel}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="select-filter-status" className="focus-ring h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs outline-none md:w-44"><option value="all">All statuses</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="needs_revision">Needs revision</option></select></div></div>
    {filtered.length ? <div className="space-y-3">{filtered.map((topic) => <CurriculumRow key={topic.id} topic={topic} progress={store.progress[topic.id]} updateProgress={store.updateProgress} />)}</div> : <EmptyState title="Nothing matches that search." detail="Try a broader subject, status, or reading title." />}</div>;
}

function CurriculumRow({ topic, progress, updateProgress }: { topic: Reading; progress: Progress; updateProgress: Store['updateProgress'] }) {
  const [expanded, setExpanded] = useState(false); const subject = subjectFor(topic.subjectId);
  const setStatus = (status: Status) => updateProgress(topic.id, { status, lastStudied: status === 'in_progress' || status === 'completed' ? new Date().toISOString().slice(0, 10) : progress.lastStudied, revisionCount: status === 'needs_revision' ? progress.revisionCount + 1 : progress.revisionCount });
  return <article className={`overflow-hidden rounded-xl border bg-card transition-colors ${expanded ? 'border-primary/30' : 'border-border'}`}><div className="flex flex-col gap-3 p-4 md:flex-row md:items-center"><button type="button" data-testid={`button-expand-topic-${topic.id}`} onClick={() => setExpanded(!expanded)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold" style={{ backgroundColor: `${subject.accent}1c`, color: subject.accent }}>{topic.readingNumber.padStart(2, '0')}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-primary">{topic.title}</span><span className="mt-1 block text-xs text-muted-foreground">{subject.shortLabel} <span className="mx-1 text-border">·</span> {topic.modules.length} modules</span></span></button><div className="flex items-center gap-2 pl-12 md:pl-0"><select value={progress.status} onChange={(e) => setStatus(e.target.value as Status)} data-testid={`select-status-${topic.id}`} aria-label={`Status for ${topic.title}`} className={`focus-ring h-8 rounded-md border border-border bg-background px-2 text-[11px] font-semibold outline-none ${progress.status === 'completed' ? 'text-accent' : progress.status === 'needs_revision' ? 'text-[#a56b3e]' : 'text-muted-foreground'}`}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="needs_revision">Needs revision</option></select><div className="flex items-center gap-0.5 rounded-md bg-secondary px-2 py-1.5" aria-label={`Confidence ${progress.confidence} of 5`}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" data-testid={`button-confidence-${topic.id}-${n}`} onClick={() => updateProgress(topic.id, { confidence: n })} className={`size-4 text-[11px] transition-colors ${n <= progress.confidence ? 'text-[#bb8337]' : 'text-border'}`}>●</button>)}</div><button type="button" data-testid={`button-toggle-detail-${topic.id}`} onClick={() => setExpanded(!expanded)} className="rounded-md p-2 text-muted-foreground hover:bg-secondary"><ChevronRight size={15} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} /></button></div></div>{expanded && <div className="border-t border-border bg-secondary/30 px-4 pb-5 pt-4 md:pl-[4.5rem]"><div className="mb-4 flex flex-wrap gap-2">{topic.modules.map((module) => <span key={module} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{module}</span>)}</div><label className="block text-xs font-semibold text-primary">Private notes<textarea value={progress.notes} onChange={(e) => updateProgress(topic.id, { notes: e.target.value })} data-testid={`textarea-notes-${topic.id}`} placeholder="What should you remember next time?" rows={2} className="focus-ring mt-2 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm outline-none placeholder:text-muted-foreground" /></label><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Last studied: {formatDate(progress.lastStudied)}{progress.revisionCount ? ` · ${progress.revisionCount} revision${progress.revisionCount > 1 ? 's' : ''}` : ''}</span><Link href={`/subjects/${subject.id}`} data-testid={`link-open-subject-${topic.id}`} className="font-semibold text-accent">Open {subject.shortLabel} <ChevronRight size={12} className="inline" /></Link></div></div>}</article>;
}

function Sessions({ store }: { store: Store }) {
  const [open, setOpen] = useState(false); const [range, setRange] = useState<'week' | 'month' | 'all'>('all');
  const now = new Date();
  const sessions = store.sessions.filter((session) => range === 'all' || daysBetween(new Date(session.date), now) <= (range === 'week' ? 7 : 30));
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  return <div className="page-enter"><PageHeading eyebrow="The study log" title="Sessions"><button type="button" data-testid="button-open-session-form" onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-px"><Plus size={15} /> Log a session</button></PageHeading>
    <div className="mb-8 grid gap-3 sm:grid-cols-3"><Metric label="This view" value={formatDuration(total)} icon={Clock3} detail={`${sessions.length} logged ${sessions.length === 1 ? 'session' : 'sessions'}`} /><Metric label="This week" value={formatDuration(store.sessions.filter((s) => daysBetween(new Date(s.date), now) <= 7).reduce((a, s) => a + s.durationMinutes, 0))} icon={TrendingUp} detail="focused minutes" /><Metric label="All time" value={formatDuration(store.sessions.reduce((a, s) => a + s.durationMinutes, 0))} icon={BarChart3} detail="across your journey" /></div>
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-serif text-[23px] tracking-[-.03em] text-primary">Your journal</h2><p className="mt-1 text-xs text-muted-foreground">A record of time spent with the material.</p></div><div className="flex rounded-lg border border-border bg-card p-1">{(['week', 'month', 'all'] as const).map((item) => <button key={item} type="button" onClick={() => setRange(item)} data-testid={`button-session-range-${item}`} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize ${range === item ? 'bg-secondary text-primary' : 'text-muted-foreground'}`}>{item}</button>)}</div></div>
    {sessions.length ? <div className="space-y-3">{sessions.map((session) => <SessionRow key={session.id} session={session} />)}</div> : <EmptyState title="No sessions in this view." detail="Log a focused block of study. It can be as short as 20 minutes." action={<button type="button" onClick={() => setOpen(true)} data-testid="button-empty-open-session-form" className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Log a session</button>} />}{open && <SessionForm store={store} close={() => setOpen(false)} />}</div>;
}

function SessionRow({ session }: { session: Session }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"><div className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary font-serif text-lg text-primary">{new Date(`${session.date}T12:00:00`).getDate()}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-primary">{topicFor(session.topicId)?.title || 'Study session'}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(session.date)} <span className="mx-1 text-border">·</span> {subjectFor(session.subjectId).shortLabel}</div></div><div className="flex items-center gap-4 pl-[3.5rem] sm:pl-0"><div className="font-mono text-xs text-accent">{formatDuration(session.durationMinutes)}</div>{session.notes && <div title={session.notes} className="max-w-[240px] truncate text-xs text-muted-foreground"><FileText size={13} className="mr-1 inline" />{session.notes}</div>}</div></div>;
}

function SessionForm({ store, close }: { store: Store; close: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [subjectId, setSubjectId] = useState(subjects[0].id); const [topicId, setTopicId] = useState(readings[0].id); const [duration, setDuration] = useState('45'); const [notes, setNotes] = useState('');
  const subjectTopics = readings.filter((topic) => topic.subjectId === subjectId);
  useEffect(() => { if (!subjectTopics.some((topic) => topic.id === topicId)) setTopicId(subjectTopics[0]?.id || readings[0].id); }, [subjectId]);
  const submit = (event: FormEvent) => { event.preventDefault(); store.addSession({ id: `session-${Date.now()}`, date, subjectId, topicId, durationMinutes: Number(duration), notes }); store.updateProgress(topicId, { lastStudied: date, status: store.progress[topicId].status === 'not_started' ? 'in_progress' : store.progress[topicId].status }); close(); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-primary/25 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-accent">Add to the log</div><h2 className="font-serif text-3xl tracking-[-.035em] text-primary">Log a session</h2></div><button type="button" onClick={close} data-testid="button-close-session-form" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X size={18} /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-primary">Date<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-session-date" className="focus-ring mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" /></label><label className="text-xs font-semibold text-primary">Minutes<input required min="1" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="input-session-duration" className="focus-ring mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" /></label><label className="text-xs font-semibold text-primary sm:col-span-2">Subject<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} data-testid="select-session-subject" className="focus-ring mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none">{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="text-xs font-semibold text-primary sm:col-span-2">Reading<select value={topicId} onChange={(e) => setTopicId(e.target.value)} data-testid="select-session-topic" className="focus-ring mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none">{subjectTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.readingNumber}. {topic.title}</option>)}</select></label><label className="text-xs font-semibold text-primary sm:col-span-2">Notes<span className="ml-1 font-normal text-muted-foreground">(optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="textarea-session-notes" rows={3} placeholder="What did you cover? What should you return to?" className="focus-ring mt-2 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={close} data-testid="button-cancel-session" className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary">Cancel</button><button type="submit" data-testid="button-save-session" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Save session</button></div></form></div>;
}

function SubjectDetail({ store }: { store: Store }) {
  const { subjectId = '' } = useParams<{ subjectId: string }>(); const subject = subjectFor(subjectId); const [location] = useLocation(); const subjectTopics = readings.filter((topic) => topic.subjectId === subject.id);
  const done = subjectTopics.filter((topic) => store.progress[topic.id]?.status === 'completed').length; const remaining = subjectTopics.length - done; const weak = subjectTopics.filter((topic) => (store.progress[topic.id]?.confidence || 1) <= 2).length; const revisions = subjectTopics.filter((topic) => store.progress[topic.id]?.status === 'needs_revision').length; const averageConfidence = subjectTopics.length ? subjectTopics.reduce((sum, topic) => sum + (store.progress[topic.id]?.confidence || 1), 0) / subjectTopics.length : 0; const minutes = store.sessions.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.durationMinutes, 0);
  return <div className="page-enter"><Link href="/curriculum" data-testid="link-back-curriculum" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> All curriculum</Link><div className="mb-8 flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground"><span className="size-2 rounded-full" style={{ backgroundColor: subject.accent }} /> Subject detail</div><h1 className="max-w-2xl font-serif text-[42px] leading-[.98] tracking-[-.045em] text-primary md:text-[58px]">{subject.name}</h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{subject.description}</p></div><div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 md:pb-1"><div><div className="font-serif text-3xl text-primary">{done}/{subjectTopics.length}</div><div className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted-foreground">complete</div></div><div><div className="font-serif text-3xl text-primary">{averageConfidence.toFixed(1)}</div><div className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted-foreground">confidence / 5</div></div><div><div className="font-serif text-3xl text-primary">{remaining}</div><div className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted-foreground">remaining</div></div><div><div className="font-serif text-3xl text-primary">{formatDuration(minutes)}</div><div className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted-foreground">logged</div></div></div></div><div className="mb-8 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full transition-all" style={{ width: `${subjectTopics.length ? done / subjectTopics.length * 100 : 0}%`, backgroundColor: subject.accent }} /></div><div className="grid gap-8 xl:grid-cols-[1fr_300px]"><section><h2 className="mb-3 font-serif text-2xl tracking-[-.03em] text-primary">Readings & notes</h2><div className="space-y-3">{subjectTopics.map((topic) => <CurriculumRow key={topic.id} topic={topic} progress={store.progress[topic.id]} updateProgress={store.updateProgress} />)}</div></section><aside><h2 className="mb-3 font-serif text-2xl tracking-[-.03em] text-primary">A useful lens</h2><div className="rounded-xl border border-border bg-card p-5"><div className="mb-4 grid size-9 place-items-center rounded-lg" style={{ backgroundColor: `${subject.accent}1c`, color: subject.accent }}><BarChart3 size={17} /></div><p className="text-sm leading-relaxed text-muted-foreground">Aim to leave each reading with one explanation you could give to another person, one formula you can recall, and one question worth revisiting.</p><div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs"><div><span className="font-semibold text-primary">{weak}</span><br /><span className="text-muted-foreground">weak topics</span></div><div><span className="font-semibold text-primary">{revisions}</span><br /><span className="text-muted-foreground">needs revision</span></div></div><div className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground"><span className="font-semibold text-primary">Last visited</span><br />{location ? 'This subject is in focus now.' : 'Keep going.'}</div></div></aside></div></div>;
}

export default App;