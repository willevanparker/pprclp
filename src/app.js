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
  menuOpen: false,
  openDeleteHabitId: null,
  confirmDeleteHabitId: null,
};

let swipeGesture = null;
let suppressNextHabitClickUntil = 0;

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
  state.menuOpen = false;
  state.openDeleteHabitId = null;
  state.confirmDeleteHabitId = null;
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
  state.menuOpen = false;
  state.openDeleteHabitId = null;
  state.confirmDeleteHabitId = null;
  navigate('home');
}

function shell(content) {
  const active = (route) => (state.route === route ? 'active' : '');
  const menuItems = state.user
    ? `<button class="${active('dashboard')}" data-nav="dashboard" type="button">Dashboard</button><button data-action="logout" type="button">Log Out</button>`
    : `<button class="${active('login')}" data-nav="login" type="button">Log In</button>`;

  return `
    <div class="app-shell">
      <header class="site-header">
        <button class="brand" data-nav="${state.user ? 'dashboard' : 'home'}" type="button">pprclp</button>
        <div class="menu-wrap">
          <button class="hamburger-button" data-menu-toggle="true" aria-label="Open navigation menu" aria-expanded="${state.menuOpen}" type="button">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <nav class="menu-popover ${state.menuOpen ? 'open' : ''}" aria-label="Primary navigation">
            <button class="${active('home')}" data-nav="home" type="button">Home</button>
            <button class="${active('about')}" data-nav="about" type="button">About</button>
            ${menuItems}
          </nav>
        </div>
      </header>
      <main>${content}</main>
    </div>
  `;
}

function homePage() {
  return `
    <section class="hero page-panel">
      <p class="eyebrow">Small actions, visible momentum.</p>
      <h1>Track habits with pprclp.</h1>
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
      <h1>A simple way to track habits.</h1>
<p>
  pprclp is a minimal web app designed to help track your daily habits.
  Inspired by the
  <a href="https://jamesclear.com/paper-clips" target="_blank" rel="noopener noreferrer">paper clip method</a>,
  it's absolutely free and does not track a single keystroke, tap, or share.
  The way the internet should be.
</p>    </section>
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
  const habitBeingDeleted = state.habits.find((habit) => habit.id === state.confirmDeleteHabitId);
  const habits = state.habits.map((habit) => {
    const expanded = state.expandedHabitId === habit.id;
    const deleteOpen = state.openDeleteHabitId === habit.id;
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
      <article class="habit-card ${expanded ? 'expanded' : ''} ${deleteOpen ? 'delete-open' : ''}" data-habit-card="${habit.id}">
        <div class="swipe-shell">
          <div class="delete-reveal" aria-hidden="${deleteOpen ? 'false' : 'true'}">
            <button data-delete-prompt="${habit.id}" type="button">Delete</button>
          </div>
          <div class="habit-foreground" data-swipe-habit="${habit.id}" style="transform: translateX(${deleteOpen ? '-92px' : '0'});">
            <div class="habit-topline">
              <button class="habit-row" data-expand-habit="${habit.id}" type="button">
                <span>${escapeHtml(habit.name)}</span>
                <strong>🔥 ${habit.current_streak}</strong>
              </button>
              <button class="trash-button" data-delete-prompt="${habit.id}" aria-label="Delete ${escapeHtml(habit.name)}" type="button">×</button>
            </div>
            ${response}
          </div>
        </div>
      </article>
    `;
  }).join('');

  const addControl = state.isAdding ? `
    <form class="add-habit-form" data-form="add-habit">
      <input autofocus aria-label="New habit name" name="habit_name" placeholder="Watch Seinfeld" />
      <button aria-label="Save habit" type="submit">+</button>
    </form>` : '<button class="add-button" data-action="show-add" type="button">Add Habit +</button>';

  return `
    <section class="dashboard page-panel compact-panel">
      <div class="dashboard-greeting">Hi, ${escapeHtml(state.profile?.first_name || 'there')}.</div>
      <div class="habit-list" aria-live="polite">${habits}</div>
      ${addControl}
      ${state.message ? `<p class="form-message center-message">${escapeHtml(state.message)}</p>` : ''}
      ${habitBeingDeleted ? `
        <div class="modal-backdrop" role="presentation" data-delete-cancel="true">
          <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete this habit?</h2>
            <p>${escapeHtml(habitBeingDeleted.name)} and its daily logs will be removed.</p>
            <div class="confirm-actions">
              <button class="secondary-button" data-delete-cancel="true" type="button">Cancel</button>
              <button class="danger-button" data-delete-confirm="${habitBeingDeleted.id}" type="button">Delete</button>
            </div>
          </div>
        </div>` : ''}
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
    state.openDeleteHabitId = null;
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
    state.message = logError.code === '23505' ? 'This habit has already been logged today.' : logError.message;
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

async function deleteHabit(habitId) {
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit || !state.user) return;

  const previousHabits = state.habits;
  const previousLogs = state.logsByHabit;
  state.habits = state.habits.filter((item) => item.id !== habitId);
  state.logsByHabit = Object.fromEntries(Object.entries(state.logsByHabit).filter(([id]) => id !== habitId));
  state.expandedHabitId = null;
  state.openDeleteHabitId = null;
  state.confirmDeleteHabitId = null;
  state.message = '';
  render();

  const { error } = await supabase.from('habits').delete().eq('id', habitId);
  if (error) {
    state.habits = previousHabits;
    state.logsByHabit = previousLogs;
    state.message = error.message;
    render();
  }
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

  if (target.dataset.menuToggle) {
    state.menuOpen = !state.menuOpen;
    render();
    return;
  }

  if (target.dataset.nav) {
    navigate(target.dataset.nav);
    return;
  }

  if (target.dataset.action === 'logout') {
    state.menuOpen = false;
    logout();
    return;
  }

  if (target.dataset.deletePrompt) {
    state.confirmDeleteHabitId = target.dataset.deletePrompt;
    state.openDeleteHabitId = null;
    state.expandedHabitId = null;
    render();
    return;
  }

  if (target.dataset.deleteCancel) {
    state.confirmDeleteHabitId = null;
    state.openDeleteHabitId = null;
    render();
    return;
  }

  if (target.dataset.deleteConfirm) {
    deleteHabit(target.dataset.deleteConfirm);
    return;
  }

  if (target.dataset.action === 'show-add') {
    state.isAdding = true;
    state.expandedHabitId = null;
    state.openDeleteHabitId = null;
    render();
    return;
  }

  if (target.dataset.expandHabit) {
    if (Date.now() < suppressNextHabitClickUntil) return;
    state.isAdding = false;
    state.openDeleteHabitId = null;
    state.expandedHabitId = state.expandedHabitId === target.dataset.expandHabit ? null : target.dataset.expandHabit;
    render();
    return;
  }

  if (target.dataset.answer) answerHabit(target.dataset.habitId, target.dataset.answer === 'yes');
});

root.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  if (event.target.closest('[data-delete-prompt], [data-answer], [data-delete-cancel], [data-delete-confirm]')) return;

  const foreground = event.target.closest('[data-swipe-habit]');
  if (!foreground) return;

  swipeGesture = {
    habitId: foreground.dataset.swipeHabit,
    startX: event.clientX,
    currentX: event.clientX,
    startY: event.clientY,
    moved: false,
    foreground,
  };
});

root.addEventListener('pointermove', (event) => {
  if (!swipeGesture) return;

  const deltaX = Math.min(0, event.clientX - swipeGesture.startX);
  const deltaY = Math.abs(event.clientY - swipeGesture.startY);
  if (deltaY > 40 && Math.abs(deltaX) < 25) return;

  swipeGesture.currentX = event.clientX;
  if (Math.abs(deltaX) > 8) swipeGesture.moved = true;
  if (!swipeGesture.moved) return;

  event.preventDefault();
  state.openDeleteHabitId = null;
  const offset = Math.max(deltaX, -104);
  swipeGesture.foreground.style.transform = `translateX(${offset}px)`;
}, { passive: false });

root.addEventListener('pointerup', () => {
  if (!swipeGesture) return;

  const deltaX = swipeGesture.currentX - swipeGesture.startX;
  if (swipeGesture.moved) {
    suppressNextHabitClickUntil = Date.now() + 350;
    state.openDeleteHabitId = deltaX < -48 ? swipeGesture.habitId : null;
    state.expandedHabitId = deltaX < -48 ? null : state.expandedHabitId;
    render();
  }

  swipeGesture = null;
});

root.addEventListener('pointercancel', () => {
  swipeGesture = null;
  render();
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'auth') handleAuthSubmit(form);
  if (form.dataset.form === 'add-habit') createHabit(form);
});


document.addEventListener('click', (event) => {
  if (!state.menuOpen || event.target.closest('.menu-wrap')) return;
  state.menuOpen = false;
  render();
});

window.addEventListener('popstate', () => {
  state.route = routeFromLocation();
  render();
  if (state.route === 'dashboard') loadDashboard();
});

render();
initAuth();
