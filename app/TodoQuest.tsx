"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage hydration is client-only state sync. */

import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TASKS_KEY = "level-list.tasks";
const STATS_KEY = "level-list.stats";

const CATEGORIES = [
  { id: "work", name: "Работа", color: "blue" },
  { id: "study", name: "Учёба", color: "violet" },
  { id: "home", name: "Дом", color: "green" },
  { id: "personal", name: "Личное", color: "pink" },
  { id: "health", name: "Здоровье", color: "orange" },
] as const;

const PRIORITIES = {
  low: { label: "Низкий", xp: 25, order: 1, tone: "green" },
  medium: { label: "Средний", xp: 45, order: 2, tone: "amber" },
  high: { label: "Высокий", xp: 70, order: 3, tone: "red" },
} as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];
type Priority = keyof typeof PRIORITIES;
type Tab = "all" | "today" | "overdue" | CategoryId;
type PriorityFilter = Priority | "all";
type SortMode = "newest" | "oldest" | "deadline" | "priority";
type Theme = "light" | "dark";
type SoundKind = "add" | "complete" | "delete" | "level" | "soft";

type Task = {
  id: string;
  title: string;
  desc: string;
  category: CategoryId;
  priority: Priority;
  deadline: string;
  completed: boolean;
  createdAt: number;
  completedAt?: string;
};

type Stats = {
  combo: number;
  soundOn: boolean;
  theme: Theme;
  lastCompletedDay: string;
};

type TaskForm = {
  title: string;
  desc: string;
  category: CategoryId;
  priority: Priority;
  deadline: string;
};

type Toast = {
  id: number;
  message: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const yesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

const emptyForm: TaskForm = {
  title: "",
  desc: "",
  category: "work",
  priority: "medium",
  deadline: today(),
};

const initialTasks: Task[] = [
  {
    id: "starter-1",
    title: "Собрать главный фокус дня",
    desc: "Одна задача, которая сделает день легче.",
    category: "work",
    priority: "high",
    deadline: today(),
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "starter-2",
    title: "Закрыть маленький хвост",
    desc: "Быстрая победа для разгона комбо.",
    category: "home",
    priority: "low",
    deadline: today(),
    completed: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 7,
    completedAt: new Date().toISOString(),
  },
  {
    id: "starter-3",
    title: "Подготовить план на завтра",
    desc: "Черновик, дедлайн, первый шаг.",
    category: "study",
    priority: "medium",
    deadline: tomorrow(),
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 10,
  },
  {
    id: "starter-4",
    title: "Разобрать просроченную задачу",
    desc: "Либо выполнить, либо честно удалить.",
    category: "personal",
    priority: "high",
    deadline: yesterday(),
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

const initialStats: Stats = {
  combo: 1,
  soundOn: true,
  theme: "dark",
  lastCompletedDay: today(),
};

function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && CATEGORIES.some((category) => category.id === value);
}

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

function normalizeTask(raw: unknown, index: number): Task | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Partial<Task> & {
    tag?: string;
    difficulty?: string;
    createdAt?: string | number;
  };

  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (!title) {
    return null;
  }

  const priority: Priority = isPriority(item.priority)
    ? item.priority
    : item.difficulty === "boss"
      ? "high"
      : item.difficulty === "quick"
        ? "low"
        : "medium";

  const category: CategoryId = isCategoryId(item.category)
    ? item.category
    : item.tag === "Дом"
      ? "home"
      : item.tag === "Учёба"
        ? "study"
        : item.tag === "Личное"
          ? "personal"
          : "work";

  const createdAt =
    typeof item.createdAt === "number"
      ? item.createdAt
      : typeof item.createdAt === "string"
        ? new Date(item.createdAt).getTime()
        : Date.now() - index * 1000;

  return {
    id: typeof item.id === "string" ? item.id : `task-${Date.now()}-${index}`,
    title,
    desc: typeof item.desc === "string" ? item.desc : "",
    category,
    priority,
    deadline: typeof item.deadline === "string" ? item.deadline : "",
    completed: Boolean(item.completed),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - index * 1000,
    completedAt: typeof item.completedAt === "string" ? item.completedAt : undefined,
  };
}

function calculateXp(tasks: Task[]) {
  return tasks.reduce(
    (sum, task) => sum + (task.completed ? PRIORITIES[task.priority].xp : 0),
    0,
  );
}

function getLevelInfo(xp: number) {
  let level = 1;
  let remaining = xp;
  let next = 140;

  while (remaining >= next) {
    remaining -= next;
    level += 1;
    next = 140 + level * 55;
  }

  return {
    level,
    current: remaining,
    next,
    progress: Math.min(100, Math.round((remaining / next) * 100)),
  };
}

function formatDeadline(value: string) {
  if (!value) {
    return "Без срока";
  }

  if (value === today()) {
    return "Сегодня";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function newTaskId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}`;
}

export default function TodoQuest() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    try {
      const savedTasks = window.localStorage.getItem(TASKS_KEY);
      const savedStats = window.localStorage.getItem(STATS_KEY);

      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks) as unknown[];
        const normalizedTasks = Array.isArray(parsedTasks)
          ? parsedTasks
              .map((task, index) => normalizeTask(task, index))
              .filter((task): task is Task => Boolean(task))
          : [];

        if (normalizedTasks.length) {
          setTasks(normalizedTasks);
        }
      }

      if (savedStats) {
        const parsedStats = JSON.parse(savedStats) as Partial<Stats>;
        setStats({
          ...initialStats,
          ...parsedStats,
          theme: parsedStats.theme === "light" ? "light" : "dark",
          soundOn: parsedStats.soundOn !== false,
        });
      }
    } catch {
      setTasks(initialTasks);
      setStats(initialStats);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [hydrated, stats, tasks]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const showToast = useCallback((message: string) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToasts((currentToasts) => [...currentToasts, { id, message }]);
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, 2300);
  }, []);

  const playSound = useCallback(
    (kind: SoundKind) => {
      if (!stats.soundOn) {
        return;
      }

      const AudioContextClass =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;

      if (context.state === "suspended") {
        void context.resume();
      }

      const patterns: Record<SoundKind, number[]> = {
        add: [392, 523],
        complete: [523, 659, 784],
        delete: [220, 165],
        level: [523, 659, 784, 1046],
        soft: [330],
      };

      const now = context.currentTime;
      patterns[kind].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.075;
        const duration = kind === "level" ? 0.13 : 0.09;

        oscillator.type = kind === "delete" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(kind === "soft" ? 0.035 : 0.07, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });
    },
    [stats.soundOn],
  );

  const counts = useMemo(() => {
    const todayKey = today();
    const completed = tasks.filter((task) => task.completed).length;
    const active = tasks.length - completed;
    const dueToday = tasks.filter((task) => task.deadline === todayKey).length;
    const doneToday = tasks.filter(
      (task) => task.deadline === todayKey && task.completed,
    ).length;
    const overdue = tasks.filter(
      (task) => !task.completed && task.deadline && task.deadline < todayKey,
    ).length;
    const categoryCounts = CATEGORIES.reduce(
      (acc, category) => ({
        ...acc,
        [category.id]: tasks.filter((task) => task.category === category.id).length,
      }),
      {} as Record<CategoryId, number>,
    );

    return {
      all: tasks.length,
      active,
      completed,
      dueToday,
      doneToday,
      overdue,
      progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      dayProgress: dueToday ? Math.round((doneToday / dueToday) * 100) : 0,
      categoryCounts,
    };
  }, [tasks]);

  const xp = useMemo(() => calculateXp(tasks), [tasks]);
  const levelInfo = useMemo(() => getLevelInfo(xp), [xp]);

  const filteredTasks = useMemo(() => {
    const todayKey = today();
    const query = searchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        if (activeTab === "today") {
          return task.deadline === todayKey;
        }

        if (activeTab === "overdue") {
          return !task.completed && task.deadline && task.deadline < todayKey;
        }

        if (activeTab !== "all") {
          return task.category === activeTab;
        }

        return true;
      })
      .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
      .filter((task) => {
        if (!query) {
          return true;
        }

        return (
          task.title.toLowerCase().includes(query) ||
          task.desc.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sortMode === "oldest") {
          return a.createdAt - b.createdAt;
        }

        if (sortMode === "deadline") {
          if (!a.deadline) {
            return 1;
          }

          if (!b.deadline) {
            return -1;
          }

          return a.deadline.localeCompare(b.deadline);
        }

        if (sortMode === "priority") {
          return PRIORITIES[b.priority].order - PRIORITIES[a.priority].order;
        }

        return b.createdAt - a.createdAt;
      });
  }, [activeTab, priorityFilter, searchQuery, sortMode, tasks]);

  const activeTitle = useMemo(() => {
    if (activeTab === "all") {
      return "Все задачи";
    }

    if (activeTab === "today") {
      return "Сегодня";
    }

    if (activeTab === "overdue") {
      return "Просроченные";
    }

    return CATEGORIES.find((category) => category.id === activeTab)?.name ?? "Категория";
  }, [activeTab]);

  function openCreateModal() {
    setEditingId(null);
    setForm({ ...emptyForm, deadline: today() });
    setModalOpen(true);
    playSound("soft");
  }

  function openEditModal(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      desc: task.desc,
      category: task.category,
      priority: task.priority,
      deadline: task.deadline,
    });
    setModalOpen(true);
    playSound("soft");
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    if (!title) {
      playSound("soft");
      return;
    }

    if (editingId) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === editingId
            ? {
                ...task,
                title,
                desc: form.desc.trim(),
                category: form.category,
                priority: form.priority,
                deadline: form.deadline,
              }
            : task,
        ),
      );
      showToast("Задача обновлена");
      playSound("add");
    } else {
      const task: Task = {
        id: newTaskId(),
        title,
        desc: form.desc.trim(),
        category: form.category,
        priority: form.priority,
        deadline: form.deadline,
        completed: false,
        createdAt: Date.now(),
      };

      setTasks((currentTasks) => [task, ...currentTasks]);
      showToast("Задача создана");
      playSound("add");
    }

    closeModal();
  }

  function toggleTask(id: string) {
    setTasks((currentTasks) => {
      const previousLevel = getLevelInfo(calculateXp(currentTasks)).level;
      let completedNow = false;

      const nextTasks = currentTasks.map((task) => {
        if (task.id !== id) {
          return task;
        }

        completedNow = !task.completed;
        return {
          ...task,
          completed: !task.completed,
          completedAt: task.completed ? undefined : new Date().toISOString(),
        };
      });

      const nextLevel = getLevelInfo(calculateXp(nextTasks)).level;

      if (completedNow) {
        setStats((currentStats) => ({
          ...currentStats,
          combo:
            currentStats.lastCompletedDay === today() || !currentStats.lastCompletedDay
              ? currentStats.combo + 1
              : 1,
          lastCompletedDay: today(),
        }));
        setBurstId(id);
        window.setTimeout(() => setBurstId(null), 520);
        playSound(nextLevel > previousLevel ? "level" : "complete");
        showToast(nextLevel > previousLevel ? "Новый уровень" : "Задача закрыта");
      } else {
        playSound("soft");
      }

      return nextTasks;
    });
  }

  function deleteTask(id: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    playSound("delete");
    showToast("Задача удалена");
  }

  function clearCompleted() {
    if (!counts.completed) {
      playSound("soft");
      return;
    }

    setTasks((currentTasks) => currentTasks.filter((task) => !task.completed));
    playSound("delete");
    showToast("Выполненные очищены");
  }

  function toggleTheme() {
    setStats((currentStats) => ({
      ...currentStats,
      theme: currentStats.theme === "dark" ? "light" : "dark",
    }));
  }

  function toggleSound() {
    setStats((currentStats) => ({
      ...currentStats,
      soundOn: !currentStats.soundOn,
    }));
  }

  return (
    <main className={`app-shell theme-${stats.theme}`}>
      <div className="ambient-surface" aria-hidden="true" />

      <aside className="sidebar glass-panel" aria-label="Навигация">
        <div>
          <div className="brand-row">
            <div className="app-mark">F</div>
            <div>
              <p className="app-name">FocusFlow</p>
              <p className="app-subtitle">Level organizer</p>
            </div>
          </div>

          <button className="create-button" type="button" onClick={openCreateModal}>
            <span>＋</span>
            <strong>Создать задачу</strong>
          </button>

          <nav className="nav-group" aria-label="Временные рамки">
            <p className="nav-label">Временные рамки</p>
            <FilterButton
              active={activeTab === "all"}
              count={counts.all}
              label="Все задачи"
              onClick={() => setActiveTab("all")}
            />
            <FilterButton
              active={activeTab === "today"}
              count={counts.dueToday}
              label="Сегодня"
              onClick={() => setActiveTab("today")}
            />
            <FilterButton
              active={activeTab === "overdue"}
              count={counts.overdue}
              danger
              label="Просроченные"
              onClick={() => setActiveTab("overdue")}
            />
          </nav>

          <nav className="nav-group" aria-label="Категории">
            <p className="nav-label">Категории</p>
            {CATEGORIES.map((category) => (
              <FilterButton
                active={activeTab === category.id}
                count={counts.categoryCounts[category.id]}
                key={category.id}
                label={category.name}
                marker={category.color}
                onClick={() => setActiveTab(category.id)}
              />
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="utility-button" type="button" onClick={toggleTheme}>
            <span>{stats.theme === "dark" ? "☾" : "☼"}</span>
            <strong>{stats.theme === "dark" ? "Dark" : "Light"}</strong>
          </button>
          <button className="utility-button" type="button" onClick={toggleSound}>
            <span>{stats.soundOn ? "♪" : "∅"}</span>
            <strong>Sound {stats.soundOn ? "on" : "off"}</strong>
          </button>
        </div>
      </aside>

      <section className="main-stage">
        <header className="stage-header">
          <div>
            <p className="eyebrow">Личный ритм</p>
            <h1>Стеклянная доска задач</h1>
          </div>
          <div className="level-pill glass-panel">
            <span>LVL</span>
            <strong>{levelInfo.level}</strong>
          </div>
        </header>

        <section className="stats-grid" aria-label="Статистика">
          <StatCard label="Активно" value={counts.active} tone="blue" />
          <StatCard label="Готово" value={counts.completed} tone="green" />
          <div className="stat-card glass-panel progress-stat">
            <div className="stat-topline">
              <span>Прогресс</span>
              <strong>{counts.progress}%</strong>
            </div>
            <div className="liquid-track">
              <span style={{ width: `${counts.progress}%` }} />
            </div>
            <small>
              {levelInfo.current} / {levelInfo.next} XP · комбо {stats.combo}
            </small>
          </div>
        </section>

        <section className="control-strip glass-panel" aria-label="Управление задачами">
          <label className="search-box">
            <span>⌕</span>
            <input
              aria-label="Поиск среди задач"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск среди задач"
              value={searchQuery}
            />
          </label>

          <div className="priority-tabs" aria-label="Фильтр приоритета">
            {(["all", "high", "medium", "low"] as const).map((priority) => (
              <button
                className={priorityFilter === priority ? "chip is-active" : "chip"}
                key={priority}
                onClick={() => setPriorityFilter(priority)}
                type="button"
              >
                {priority === "all" ? "Все" : PRIORITIES[priority].label}
              </button>
            ))}
          </div>

          <label className="sort-box">
            <span>Сортировка</span>
            <select
              aria-label="Сортировка"
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              value={sortMode}
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="deadline">По дедлайну</option>
              <option value="priority">По приоритету</option>
            </select>
          </label>
        </section>

        <section className="task-section">
          <div className="task-section-head">
            <h2>
              {activeTitle}
              <span>{filteredTasks.length}</span>
            </h2>
            <button
              className={counts.completed ? "clear-button is-visible" : "clear-button"}
              disabled={!counts.completed}
              onClick={clearCompleted}
              type="button"
            >
              Очистить выполненные
            </button>
          </div>

          <div className="task-list" aria-live="polite">
            {filteredTasks.length ? (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  burst={burstId === task.id}
                  onDelete={() => deleteTask(task.id)}
                  onEdit={() => openEditModal(task)}
                  onToggle={() => toggleTask(task.id)}
                  task={task}
                />
              ))
            ) : (
              <div className="empty-state glass-panel">
                <strong>Пусто</strong>
                <span>Фильтр не нашёл задач.</span>
              </div>
            )}
          </div>
        </section>
      </section>

      {modalOpen ? (
        <div
          className="modal-shell"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="task-modal glass-panel" onSubmit={saveTask}>
            <header>
              <div>
                <p className="eyebrow">{editingId ? "Редактирование" : "Новая задача"}</p>
                <h2>{editingId ? "Обновить задачу" : "Создать задачу"}</h2>
              </div>
              <button aria-label="Закрыть" className="icon-button" onClick={closeModal} type="button">
                ×
              </button>
            </header>

            <label>
              <span>Название</span>
              <input
                autoFocus
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: закончить презентацию"
                required
                value={form.title}
              />
            </label>

            <label>
              <span>Описание</span>
              <textarea
                onChange={(event) => setForm((current) => ({ ...current, desc: event.target.value }))}
                placeholder="Детали задачи"
                rows={3}
                value={form.desc}
              />
            </label>

            <div className="form-grid">
              <label>
                <span>Категория</span>
                <select
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as CategoryId,
                    }))
                  }
                  value={form.category}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Дедлайн</span>
                <input
                  onChange={(event) =>
                    setForm((current) => ({ ...current, deadline: event.target.value }))
                  }
                  type="date"
                  value={form.deadline}
                />
              </label>
            </div>

            <fieldset className="priority-field">
              <legend>Приоритет</legend>
              {(["low", "medium", "high"] as const).map((priority) => (
                <label
                  className={form.priority === priority ? "priority-option is-selected" : "priority-option"}
                  key={priority}
                >
                  <input
                    checked={form.priority === priority}
                    name="priority"
                    onChange={() => setForm((current) => ({ ...current, priority }))}
                    type="radio"
                    value={priority}
                  />
                  <span className={`priority-dot tone-${PRIORITIES[priority].tone}`} />
                  {PRIORITIES[priority].label}
                </label>
              ))}
            </fieldset>

            <footer>
              <button className="secondary-button" onClick={closeModal} type="button">
                Отмена
              </button>
              <button className="submit-button" type="submit">
                {editingId ? "Сохранить" : "Создать"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast glass-panel" key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}

function FilterButton({
  active,
  count,
  danger = false,
  label,
  marker,
  onClick,
}: {
  active: boolean;
  count: number;
  danger?: boolean;
  label: string;
  marker?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "filter-button is-active" : "filter-button"}
      onClick={onClick}
      type="button"
    >
      <span className="filter-label">
        {marker ? <i className={`category-marker marker-${marker}`} /> : null}
        <span className={danger ? "danger-text" : undefined}>{label}</span>
      </span>
      <strong>{count}</strong>
    </button>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: string; value: number }) {
  return (
    <div className="stat-card glass-panel">
      <div className={`stat-icon tone-${tone}`}>{label.slice(0, 1)}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function TaskCard({
  burst,
  onDelete,
  onEdit,
  onToggle,
  task,
}: {
  burst: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  task: Task;
}) {
  const category = CATEGORIES.find((item) => item.id === task.category) ?? CATEGORIES[0];
  const priority = PRIORITIES[task.priority];
  const isOverdue = !task.completed && task.deadline && task.deadline < today();

  return (
    <article className={task.completed ? "task-card glass-panel is-complete" : "task-card glass-panel"}>
      <button
        aria-label={task.completed ? "Вернуть задачу" : "Завершить задачу"}
        className="round-check"
        onClick={onToggle}
        type="button"
      >
        {task.completed ? "✓" : ""}
      </button>

      <div className="task-content">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className={`priority-badge tone-${priority.tone}`}>{priority.label}</span>
        </div>

        {task.desc ? <p>{task.desc}</p> : null}

        <div className="task-meta">
          <span>
            <i className={`category-marker marker-${category.color}`} />
            {category.name}
          </span>
          <span className={isOverdue ? "date-badge is-overdue" : "date-badge"}>
            {formatDeadline(task.deadline)}
          </span>
          <span>+{priority.xp} XP</span>
        </div>
      </div>

      <div className="task-actions">
        <button aria-label="Редактировать" className="icon-button" onClick={onEdit} type="button">
          ✎
        </button>
        <button aria-label="Удалить" className="icon-button danger" onClick={onDelete} type="button">
          ×
        </button>
      </div>

      {burst ? (
        <div className="burst" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              style={{ "--angle": `${index * 45}deg` } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
