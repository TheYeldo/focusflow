"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage hydration is client-only state sync. */

import {
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CircleAlert,
  Flame,
  Gem,
  GraduationCap,
  GripVertical,
  HeartPulse,
  Home,
  Layers3,
  ListChecks,
  Moon,
  Music2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

const TASKS_KEY = "level-list.tasks";
const STATS_KEY = "level-list.stats";

const CATEGORIES = [
  { id: "work", name: "Работа", color: "blue", icon: BriefcaseBusiness },
  { id: "study", name: "Учёба", color: "violet", icon: GraduationCap },
  { id: "home", name: "Дом", color: "green", icon: Home },
  { id: "personal", name: "Личное", color: "pink", icon: Sparkles },
  { id: "health", name: "Здоровье", color: "orange", icon: HeartPulse },
] as const;

const PRIORITIES = {
  low: { label: "Лёгкий", xp: 25, order: 1, tone: "green" },
  medium: { label: "Важный", xp: 45, order: 2, tone: "amber" },
  high: { label: "Критичный", xp: 70, order: 3, tone: "red" },
} as const;

const TAB_ITEMS = [
  { id: "all", label: "Все", icon: Layers3 },
  { id: "today", label: "Сегодня", icon: CalendarClock },
  { id: "overdue", label: "Срочно", icon: CircleAlert },
  { id: "done", label: "Готово", icon: BadgeCheck },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];
type Priority = keyof typeof PRIORITIES;
type Tab = (typeof TAB_ITEMS)[number]["id"] | CategoryId;
type PriorityFilter = Priority | "all";
type SortMode = "manual" | "deadline" | "priority" | "newest";
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

const shiftDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
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
    desc: "Одна задача, которая делает день заметно легче.",
    category: "work",
    priority: "high",
    deadline: today(),
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 45,
  },
  {
    id: "starter-2",
    title: "Закрыть короткий хвост",
    desc: "Быстрая победа для разгона серии.",
    category: "home",
    priority: "low",
    deadline: today(),
    completed: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    completedAt: new Date().toISOString(),
  },
  {
    id: "starter-3",
    title: "Подготовить план на завтра",
    desc: "Черновик, дедлайн, первый шаг.",
    category: "study",
    priority: "medium",
    deadline: shiftDate(1),
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 10,
  },
  {
    id: "starter-4",
    title: "Разобрать просроченную задачу",
    desc: "Либо выполнить, либо честно удалить.",
    category: "personal",
    priority: "high",
    deadline: shiftDate(-1),
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 22,
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
    deadline: typeof item.deadline === "string" ? item.deadline : today(),
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

  if (value === shiftDate(1)) {
    return "Завтра";
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

function getCategory(task: Task) {
  return CATEGORIES.find((item) => item.id === task.category) ?? CATEGORIES[0];
}

export default function TodoQuest() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [quickTitle, setQuickTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
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
        add: [349, 440, 587],
        complete: [523, 659, 880],
        delete: [220, 174],
        level: [523, 659, 784, 1046],
        soft: [330],
      };

      const now = context.currentTime;
      patterns[kind].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.064;
        const duration = kind === "level" ? 0.14 : 0.085;

        oscillator.type = kind === "delete" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(kind === "soft" ? 0.032 : 0.072, start + 0.012);
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
    const highOpen = tasks.filter((task) => !task.completed && task.priority === "high").length;
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
      highOpen,
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

        if (activeTab === "done") {
          return task.completed;
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
        if (sortMode === "manual") {
          return 0;
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
      return "Срочный список";
    }

    if (activeTab === "done") {
      return "Готово";
    }

    return CATEGORIES.find((category) => category.id === activeTab)?.name ?? "Категория";
  }, [activeTab]);

  const focusTask = useMemo(() => {
    const openTasks = tasks.filter((task) => !task.completed);
    return [...openTasks].sort((a, b) => {
      const deadlineScore = (a.deadline || "9999").localeCompare(b.deadline || "9999");
      if (deadlineScore !== 0) {
        return deadlineScore;
      }

      return PRIORITIES[b.priority].order - PRIORITIES[a.priority].order;
    })[0];
  }, [tasks]);

  const achievements = useMemo(
    () => [
      {
        icon: Trophy,
        title: "Первый уровень",
        value: `LVL ${levelInfo.level}`,
        active: levelInfo.level > 1,
      },
      {
        icon: Flame,
        title: "Серия",
        value: `${stats.combo} подряд`,
        active: stats.combo >= 3,
      },
      {
        icon: Zap,
        title: "Критичные",
        value: `${counts.highOpen} открыто`,
        active: counts.highOpen === 0 && tasks.length > 0,
      },
      {
        icon: Gem,
        title: "Чистый день",
        value: `${counts.dayProgress}%`,
        active: counts.dayProgress === 100 && counts.dueToday > 0,
      },
    ],
    [counts.dayProgress, counts.dueToday, counts.highOpen, levelInfo.level, stats.combo, tasks.length],
  );

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

  function quickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();

    if (!title) {
      playSound("soft");
      return;
    }

    const task: Task = {
      id: newTaskId(),
      title,
      desc: "",
      category: activeTab !== "all" && activeTab !== "today" && activeTab !== "overdue" && activeTab !== "done"
        ? activeTab
        : "work",
      priority: "medium",
      deadline: today(),
      completed: false,
      createdAt: Date.now(),
    };

    setTasks((currentTasks) => [task, ...currentTasks]);
    setQuickTitle("");
    showToast("Фокус добавлен");
    playSound("add");
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
    showToast("Готовые задачи очищены");
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

  function reorderTask(draggedId: string, targetId: string) {
    if (draggedId === targetId) {
      return;
    }

    setTasks((currentTasks) => {
      const from = currentTasks.findIndex((task) => task.id === draggedId);
      const to = currentTasks.findIndex((task) => task.id === targetId);

      if (from < 0 || to < 0) {
        return currentTasks;
      }

      const nextTasks = [...currentTasks];
      const [movedTask] = nextTasks.splice(from, 1);
      nextTasks.splice(to, 0, movedTask);
      return nextTasks;
    });

    setSortMode("manual");
    showToast("Порядок обновлён");
    playSound("soft");
  }

  const progressStyle = {
    "--progress": `${levelInfo.progress}%`,
  } as CSSProperties;

  return (
    <main className={`focus-app theme-${stats.theme}`}>
      <div className="ambient-layer" aria-hidden="true" />

      <aside className="side-rail glass-shell" aria-label="Навигация">
        <div className="brand-block">
          <div className="brand-mark">
            <Sparkles size={22} strokeWidth={2.4} />
          </div>
          <div>
            <p className="app-name">FocusFlow</p>
            <p className="app-subtitle">Level organizer</p>
          </div>
        </div>

        <button className="primary-action" type="button" onClick={openCreateModal}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Новая задача</span>
        </button>

        <nav className="nav-stack" aria-label="Списки">
          <p className="rail-label">Обзор</p>
          {TAB_ITEMS.map((item) => (
            <RailButton
              active={activeTab === item.id}
              count={
                item.id === "all"
                  ? counts.all
                  : item.id === "today"
                    ? counts.dueToday
                    : item.id === "overdue"
                      ? counts.overdue
                      : counts.completed
              }
              icon={item.icon}
              key={item.id}
              label={item.label}
              tone={item.id === "overdue" ? "red" : undefined}
              onClick={() => setActiveTab(item.id)}
            />
          ))}
        </nav>

        <nav className="nav-stack" aria-label="Категории">
          <p className="rail-label">Категории</p>
          {CATEGORIES.map((category) => (
            <RailButton
              active={activeTab === category.id}
              count={counts.categoryCounts[category.id]}
              icon={category.icon}
              key={category.id}
              label={category.name}
              tone={category.color}
              onClick={() => setActiveTab(category.id)}
            />
          ))}
        </nav>

        <div className="rail-tools">
          <IconToggle
            active={stats.theme === "light"}
            icon={stats.theme === "dark" ? Moon : Sun}
            label={stats.theme === "dark" ? "Тёмная тема" : "Светлая тема"}
            onClick={toggleTheme}
          />
          <IconToggle
            active={stats.soundOn}
            icon={stats.soundOn ? Volume2 : VolumeX}
            label={stats.soundOn ? "Звук включён" : "Звук выключен"}
            onClick={toggleSound}
          />
        </div>
      </aside>

      <section className="workspace">
        <header className="topline">
          <div>
            <p className="eyebrow">Личный ритм</p>
            <h1>FocusFlow</h1>
          </div>
          <div className="level-orb glass-shell" style={progressStyle}>
            <span>LVL</span>
            <strong>{levelInfo.level}</strong>
          </div>
        </header>

        <section className="command-deck glass-shell" aria-label="Панель дня">
          <div className="mission-copy">
            <p className="eyebrow">Сегодня</p>
            <h2>Стеклянная доска задач</h2>
            <span>{counts.doneToday} из {counts.dueToday || 1} закрыто · {levelInfo.current}/{levelInfo.next} XP</span>
          </div>
          <div className="metrics-row">
            <MetricCard icon={Target} label="Активно" value={counts.active} tone="blue" />
            <MetricCard icon={BadgeCheck} label="Готово" value={counts.completed} tone="green" />
            <MetricCard icon={CircleAlert} label="Срочно" value={counts.overdue} tone="red" />
          </div>
        </section>

        <section className="control-deck glass-shell" aria-label="Управление задачами">
          <label className="search-control">
            <Search size={18} strokeWidth={2.4} />
            <input
              aria-label="Поиск задач"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск задач..."
              value={searchQuery}
            />
          </label>

          <form className="quick-add" onSubmit={quickAdd}>
            <Plus size={18} strokeWidth={2.4} />
            <input
              aria-label="Быстро добавить задачу"
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="Быстро добавить фокус..."
              value={quickTitle}
            />
            <button aria-label="Добавить" type="submit">
              <Plus size={18} strokeWidth={2.7} />
            </button>
          </form>

          <div className="filter-strip" aria-label="Приоритет">
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

          <label className="select-control">
            <span>Сортировка</span>
            <select
              aria-label="Сортировка"
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              value={sortMode}
            >
              <option value="manual">Мой порядок</option>
              <option value="deadline">По дедлайну</option>
              <option value="priority">По приоритету</option>
              <option value="newest">Сначала новые</option>
            </select>
          </label>
        </section>

        <section className="task-zone">
          <div className="section-heading">
            <h2>
              {activeTitle}
              <span>{filteredTasks.length}</span>
            </h2>
            <button
              className="subtle-action"
              disabled={!counts.completed}
              onClick={clearCompleted}
              type="button"
            >
              <Archive size={16} />
              <span>Очистить</span>
            </button>
          </div>

          <div className="task-list" aria-live="polite">
            {filteredTasks.length ? (
              filteredTasks.map((task) => (
                <TaskCard
                  burst={burstId === task.id}
                  dragging={draggingId === task.id}
                  key={task.id}
                  onDelete={() => deleteTask(task.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragStart={(event) => {
                    setDraggingId(task.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", task.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const draggedTaskId = event.dataTransfer.getData("text/plain") || draggingId;
                    if (draggedTaskId) {
                      reorderTask(draggedTaskId, task.id);
                    }
                  }}
                  onEdit={() => openEditModal(task)}
                  onToggle={() => toggleTask(task.id)}
                  task={task}
                />
              ))
            ) : (
              <EmptyState onCreate={openCreateModal} />
            )}
          </div>
        </section>
      </section>

      <aside className="insight-rail">
        <section className="focus-card glass-shell">
          <div className="focus-icon">
            <Target size={22} strokeWidth={2.4} />
          </div>
          <p className="eyebrow">Следующий фокус</p>
          <h2>{focusTask?.title ?? "День чистый"}</h2>
          <span>
            {focusTask
              ? `${getCategory(focusTask).name} · ${formatDeadline(focusTask.deadline)}`
              : "Можно добавить новую цель"}
          </span>
          <div className="focus-meter">
            <span style={{ width: `${counts.dayProgress}%` }} />
          </div>
        </section>

        <section className="achievement-panel glass-shell">
          <div className="panel-head">
            <h2>Достижения</h2>
            <Sparkles size={18} strokeWidth={2.4} />
          </div>
          <div className="achievement-list">
            {achievements.map((achievement) => (
              <Achievement
                active={achievement.active}
                icon={achievement.icon}
                key={achievement.title}
                title={achievement.title}
                value={achievement.value}
              />
            ))}
          </div>
        </section>

        <section className="sound-card glass-shell">
          <Music2 size={18} strokeWidth={2.4} />
          <div>
            <strong>Sound design</strong>
            <span>{stats.soundOn ? "мягкие клики и уровень" : "сейчас тихо"}</span>
          </div>
        </section>
      </aside>

      <nav className="mobile-dock glass-shell" aria-label="Мобильная навигация">
        <DockButton active={activeTab === "all"} icon={Layers3} label="Все" onClick={() => setActiveTab("all")} />
        <DockButton active={activeTab === "today"} icon={CalendarClock} label="Сегодня" onClick={() => setActiveTab("today")} />
        <button className="dock-create" aria-label="Создать задачу" onClick={openCreateModal} type="button">
          <Plus size={24} strokeWidth={2.8} />
        </button>
        <DockButton active={activeTab === "overdue"} icon={CircleAlert} label="Срочно" onClick={() => setActiveTab("overdue")} />
        <DockButton active={activeTab === "done"} icon={BadgeCheck} label="Готово" onClick={() => setActiveTab("done")} />
      </nav>

      {modalOpen ? (
        <div
          className="modal-shell"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="task-modal glass-shell" onSubmit={saveTask}>
            <header>
              <div>
                <p className="eyebrow">{editingId ? "Редактирование" : "Новая задача"}</p>
                <h2>{editingId ? "Обновить фокус" : "Создать фокус"}</h2>
              </div>
              <button aria-label="Закрыть" className="icon-button" onClick={closeModal} type="button">
                <X size={18} strokeWidth={2.5} />
              </button>
            </header>

            <label>
              <span>Название</span>
              <input
                autoFocus
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: закрыть презентацию"
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
          <div className="toast glass-shell" key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}

function RailButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
  tone = "blue",
}: {
  active: boolean;
  count: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button className={active ? "rail-button is-active" : "rail-button"} onClick={onClick} type="button">
      <span className={`rail-icon tone-${tone}`}>
        <Icon size={17} strokeWidth={2.4} />
      </span>
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function IconToggle({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={active ? "tool-button is-active" : "tool-button"}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon size={18} strokeWidth={2.4} />
    </button>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon tone-${tone}`}>
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function TaskCard({
  burst,
  dragging,
  onDelete,
  onDragEnd,
  onDragStart,
  onDrop,
  onEdit,
  onToggle,
  task,
}: {
  burst: boolean;
  dragging: boolean;
  onDelete: () => void;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onEdit: () => void;
  onToggle: () => void;
  task: Task;
}) {
  const category = getCategory(task);
  const CategoryIcon = category.icon;
  const priority = PRIORITIES[task.priority];
  const isOverdue = !task.completed && task.deadline && task.deadline < today();

  return (
    <article
      className={[
        "task-card",
        "glass-shell",
        task.completed ? "is-complete" : "",
        dragging ? "is-dragging" : "",
      ].join(" ")}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <button
        aria-label={task.completed ? "Вернуть задачу" : "Завершить задачу"}
        className="round-check"
        onClick={onToggle}
        type="button"
      >
        {task.completed ? <Check size={16} strokeWidth={3} /> : null}
      </button>

      <div className="task-content">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className={`priority-badge tone-${priority.tone}`}>{priority.label}</span>
        </div>

        {task.desc ? <p>{task.desc}</p> : null}

        <div className="task-meta">
          <span>
            <CategoryIcon size={14} strokeWidth={2.4} />
            {category.name}
          </span>
          <span className={isOverdue ? "date-badge is-overdue" : "date-badge"}>
            <CalendarClock size={14} strokeWidth={2.4} />
            {formatDeadline(task.deadline)}
          </span>
          <span>+{priority.xp} XP</span>
        </div>
      </div>

      <div className="task-actions">
        <button aria-label="Переместить" className="icon-button drag-handle" title="Переместить" type="button">
          <GripVertical size={18} strokeWidth={2.4} />
        </button>
        <button aria-label="Редактировать" className="icon-button" onClick={onEdit} title="Редактировать" type="button">
          <Pencil size={17} strokeWidth={2.4} />
        </button>
        <button aria-label="Удалить" className="icon-button danger" onClick={onDelete} title="Удалить" type="button">
          <Trash2 size={17} strokeWidth={2.4} />
        </button>
      </div>

      {burst ? (
        <div className="burst" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              style={{ "--angle": `${index * 36}deg` } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Achievement({
  active,
  icon: Icon,
  title,
  value,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <div className={active ? "achievement is-active" : "achievement"}>
      <span>
        <Icon size={17} strokeWidth={2.4} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{value}</small>
      </div>
    </div>
  );
}

function DockButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "dock-button is-active" : "dock-button"} onClick={onClick} type="button">
      <Icon size={19} strokeWidth={2.4} />
      <span>{label}</span>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state glass-shell">
      <div className="empty-mark">
        <ListChecks size={28} strokeWidth={2.2} />
      </div>
      <strong>Пусто</strong>
      <span>Здесь появятся задачи под выбранный фильтр.</span>
      <button type="button" onClick={onCreate}>
        <Plus size={17} strokeWidth={2.5} />
        <span>Создать задачу</span>
      </button>
    </div>
  );
}
