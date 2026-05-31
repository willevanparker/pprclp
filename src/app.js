import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.PPRCLP_CONFIG ?? {};
const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey && !config.supabaseUrl.includes('your-project-ref'));
const supabase = createClient(
  config.supabaseUrl || 'https://placeholder.supabase.co',
  config.supabaseAnonKey || 'placeholder-anon-key',
);

const routes = new Set(['home', 'about', 'login', 'signup', 'dashboard']);
const state = {
  route: routeFromLocation(),
  user: null,
  profile: null,
  authLoading: true,
  habits: [],
  logsByHabit: {},
  expandedHabitId: null,
  isAdding: false,
  dashboardLoading: false,
  busyHabitId: null,
  message: '',
};

const root = document.getElementById('root');

function todayISO() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function readableDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

function routeFromLocation() {
  const route = window.location.pathname.replace('/', '') || 'home';
  return routes.has(route) ? route : 'home';
}

function navigate(route) {
  state.route = routes.has(route) ? route : 'home';
  window.history.pushState({}, '', state.route === 'home' ? '/' : `/${state.route}`);
  state.message = '';
  render();
  if (state.route === 'dashboard') loadDashboard();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data ?? null;
}

async function applySession(session) {
  state.user = session?.user ?? null;
  state.profile = state.user ? await loadProfile(state.user.id) : null;
  state.authLoading = false;
  if (state.user && ['login', 'signup'].includes(state.route)) navigate('dashboard');
  render();
  if (state.user && state.route === 'dashboard') loadDashboard();
}

async function initAuth() {
  if (!isSupabaseConfigured) {
    state.authLoading = false;
    render();
    return;
  }

  const { data } = await supabase.auth.getSession();
  await applySession(data.session);
  supabase.auth.onAuthStateChange((_event, session) => applySession(session));
}

async function loadDashboard() {
  if (!state.user || !isSupabaseConfigured) return;
  state.dashboardLoading = true;
  state.message = '';
  render();

  const today = todayISO();
  const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] = await Promise.all([
    supabase.from('habits').select('*').order('created_at', { ascending: true }),
    supabase.from('habit_logs').select('*').eq('log_date', today),
  ]);

  if (habitsError || logsError) {
    state.message = habitsError?.message ?? logsError?.message ?? 'Unable to load dashboard.';
  } else {
    state.habits = habits ?? [];
    state.logsByHabit = Object.fromEntries((logs ?? []).map((log) => [log.habit_id, log]));
  }

  state.dashboardLoading = false;
  render();
}

async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  state.habits = [];
  state.logsByHabit = {};
  navigate('home');
}

function shell(content) {
  const active = (route) => (state.route === route ? 'active' : '');
  const authedNav = state.user
    ? `<button class="${active('dashboard')}" data-nav="dashboard" type="button">Dashboard</button><button data-action="logout" type="button">Log Out</button>`
    : `<button class="${active('login')}" data-nav="login" type="button">Log In</button>`;

  return `
    <div class="app-shell">
      <header class="site-header">
        <button class="brand" data-nav="${state.user ? 'dashboard' : 'home'}" type="button">pprclp</button>
        <nav class="nav-links" aria-label="Primary navigation">
          <button class="${active('home')}" data-nav="home" type="button">Home</button>
          <button class="${active('about')}" data-nav="about" type="button">About</button>
          ${authedNav}
        </nav>
      </header>
      <main>${content}</main>
    </div>
  `;
}

function homePage() {
  return `
    <section class="hero page-panel">
      <p class="eyebrow">Small actions, visible momentum.</p>
      <h1>Build better habits with pprclp.</h1>
      <p class="hero-copy">A simple daily habit tracker inspired by the paper clip method.</p>
      <div class="hero-actions">
        <button class="primary-button" data-nav="${state.user ? 'dashboard' : 'signup'}" type="button">Get Started</button>
        <button class="secondary-button" data-nav="${state.user ? 'dashboard' : 'login'}" type="button">${state.user ? 'Dashboard' : 'Log In'}</button>
      </div>
    </section>
  `;
}

function aboutPage() {
  return `
    <section class="page-panel text-page">
      <p class="eyebrow">About</p>
      <h1>A quieter way to keep promises to yourself.</h1>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer non magna vitae leo tincidunt vestibulum. Donec tempor, justo at suscipit dignissim, neque lectus porttitor lectus, vitae interdum est lacus eget sem.</p>
      <p>Praesent sed augue at ipsum luctus pretium. Curabitur posuere, turpis at commodo viverra, arcu sapien sagittis lorem, vitae blandit nibh lorem sit amet erat.</p>
    </section>
  `;
}

function authPage(mode) {
  const isSignup = mode === 'signup';
  return `
    <section class="auth-panel page-panel">
      <p class="eyebrow">${isSignup ? 'Get Started' : 'Welcome back'}</p>
      <h1>${isSignup ? 'Create your account.' : 'Log in to pprclp.'}</h1>
      <form class="stacked-form" data-form="auth">
        ${isSignup ? `
          <div class="name-grid">
            <label>First name<input name="first_name" required autocomplete="given-name" /></label>
            <label>Last name<input name="last_name" required autocomplete="family-name" /></label>
          </div>` : ''}
        <label>Email<input name="email" type="email" required autocomplete="email" /></label>
        <label>Password<input name="password" type="password" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}" /></label>
        ${state.message ? `<p class="form-message">${escapeHtml(state.message)}</p>` : ''}
        <button class="primary-button full-width" type="submit">${isSignup ? 'Create Account' : 'Log In'}</button>
      </form>
      <button class="text-button" data-nav="${isSignup ? 'login' : 'signup'}" type="button">${isSignup ? 'Already have an account? Log in.' : 'New here? Create an account.'}</button>
    </section>
  `;
}

function dashboardPage() {
  if (state.authLoading || state.dashboardLoading) {
    return '<section class="dashboard page-panel compact-panel">Loading…</section>';
  }

  if (!isSupabaseConfigured) {
    return '<section class="dashboard page-panel compact-panel"><p>Supabase is not configured yet. Add your environment variables to use the dashboard.</p></section>';
  }

  if (!state.user) {
    setTimeout(() => navigate('login'), 0);
    return '<section class="dashboard page-panel compact-panel">Loading…</section>';
  }

  const today = todayISO();
  const habits = state.habits.map((habit) => {
    const expanded = state.expandedHabitId === habit.id;
    const log = state.logsByHabit[habit.id];
    const response = !expanded ? '' : `
      <div class="habit-response">
        <p>${readableDate(today)}</p>
        ${log ? `<div class="answered-state">Today: ${log.completed ? 'Yes' : 'No'}</div>` : `
          <div class="answer-actions">
            <button data-answer="yes" data-habit-id="${habit.id}" ${state.busyHabitId === habit.id ? 'disabled' : ''} type="button">Yes</button>
            <button data-answer="no" data-habit-id="${habit.id}" ${state.busyHabitId === habit.id ? 'disabled' : ''} type="button">No</button>
          </div>`}
      </div>`;

    return `
      <article class="habit-card ${expanded ? 'expanded' : ''}">
        <button class="habit-row" data-expand-habit="${habit.id}" type="button">
          <span>${escapeHtml(habit.name)}</span>
          <strong>${habit.current_streak}</strong>
        </button>
        ${response}
      </article>
    `;
  }).join('');

  const addControl = state.isAdding ? `
    <form class="add-habit-form" data-form="add-habit">
      <input autofocus aria-label="New habit name" name="habit_name" placeholder="Daily walk" />
      <button aria-label="Save habit" type="submit">+</button>
    </form>` : '<button class="add-button" data-action="show-add" type="button">Add +</button>';

  return `
    <section class="dashboard page-panel compact-panel">
      <div class="dashboard-greeting">Hi, ${escapeHtml(state.profile?.first_name || 'there')}.</div>
      <div class="habit-list" aria-live="polite">${habits}</div>
      ${addControl}
      ${state.message ? `<p class="form-message center-message">${escapeHtml(state.message)}</p>` : ''}
    </section>
  `;
}

async function handleAuthSubmit(form) {
  state.message = '';
  if (!isSupabaseConfigured) {
    state.message = 'Supabase is not configured yet. Add your environment variables to continue.';
    render();
    return;
  }

  const formData = new FormData(form);
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    if (state.route === 'signup') {
      const firstName = String(formData.get('first_name') ?? '').trim();
      const lastName = String(formData.get('last_name') ?? '').trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (error) throw error;
      if (data.session && data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          first_name: firstName,
          last_name: lastName,
        });
        if (profileError) throw profileError;
      }
      if (!data.session) {
        state.message = 'Account created. Log in with your email and password to continue.';
        state.route = 'login';
        window.history.pushState({}, '', '/login');
        render();
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    navigate('dashboard');
  } catch (error) {
    state.message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    render();
  }
}

async function createHabit(form) {
  const name = String(new FormData(form).get('habit_name') ?? '').trim();
  if (!name || !state.user) return;

  const { data, error } = await supabase.from('habits').insert({ name, user_id: state.user.id }).select('*').single();
  if (error) {
    state.message = error.message;
  } else {
    state.habits = [...state.habits, data];
    state.isAdding = false;
    state.message = '';
  }
  render();
}

async function answerHabit(habitId, completed) {
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit || !state.user || state.logsByHabit[habit.id]) return;

  const today = todayISO();
  const nextStreak = completed ? habit.current_streak + 1 : 0;
  state.busyHabitId = habit.id;
  state.message = '';
  render();

  const { data: log, error: logError } = await supabase
    .from('habit_logs')
    .insert({ habit_id: habit.id, user_id: state.user.id, log_date: today, completed })
    .select('*')
    .single();

  if (logError) {
    state.message = logError.code === '23505' ? 'This habit has already been answered today.' : logError.message;
    state.busyHabitId = null;
    state.expandedHabitId = null;
    render();
    return;
  }

  const { data: updatedHabit, error: habitError } = await supabase
    .from('habits')
    .update({ current_streak: nextStreak })
    .eq('id', habit.id)
    .select('*')
    .single();

  if (habitError) {
    state.message = habitError.message;
  } else {
    state.habits = state.habits.map((item) => (item.id === habit.id ? updatedHabit : item));
    state.logsByHabit = { ...state.logsByHabit, [habit.id]: log };
  }

  state.busyHabitId = null;
  state.expandedHabitId = null;
  render();
}

function render() {
  const page = state.route === 'about'
    ? aboutPage()
    : state.route === 'login' || state.route === 'signup'
      ? authPage(state.route)
      : state.route === 'dashboard'
        ? dashboardPage()
        : homePage();

  root.innerHTML = shell(page);
  root.querySelector('[autofocus]')?.focus();
}

root.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.dataset.nav) navigate(target.dataset.nav);
  if (target.dataset.action === 'logout') logout();
  if (target.dataset.action === 'show-add') {
    state.isAdding = true;
    state.expandedHabitId = null;
    render();
  }
  if (target.dataset.expandHabit) {
    state.isAdding = false;
    state.expandedHabitId = state.expandedHabitId === target.dataset.expandHabit ? null : target.dataset.expandHabit;
    render();
  }
  if (target.dataset.answer) answerHabit(target.dataset.habitId, target.dataset.answer === 'yes');
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'auth') handleAuthSubmit(form);
  if (form.dataset.form === 'add-habit') createHabit(form);
});

window.addEventListener('popstate', () => {
  state.route = routeFromLocation();
  render();
  if (state.route === 'dashboard') loadDashboard();
});

render();
initAuth();
