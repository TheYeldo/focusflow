"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage hydration is client-only state sync. */

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TASKS_KEY = "level-list.tasks";
const STATS_KEY = "level-list.stats";

const DIFFICULTIES = {
  quick: { label: "Легко", xp: 20, tone: "mint" },
  focus: { label: "Фокус", xp: 35, tone: "cyan" },
  boss: { label: "Босс", xp: 60, tone: "coral" },
} as const;

type Difficulty = keyof typeof DIFFICULTIES;

type Task = {
  id: string;
  title: string;
  tag: string;
  difficulty: Difficulty;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
};

type Stats = {
  combo: number;
  soundOn: boolean;
  lastCompletedDay: string;
};

type Filter = "active" | "all" | "done";
type SoundKind = "add" | "complete" | "delete" | "level" | "soft";

const initialTasks: Task[] = [
  {
    id: "starter-1",
    title: "Собрать главный фокус дня",
    tag: "Работа",
    difficulty: "focus",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "starter-2",
    title: "Закрыть одну маленькую задачу",
    tag: "Дом",
    difficulty: "quick",
    completed: true,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: "starter-3",
    title: "Разобрать большой хвост",
    tag: "Босс",
    difficulty: "boss",
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

const initialStats: Stats = {
  combo: 1,
  soundOn: true,
  lastCompletedDay: new Date().toISOString().slice(0, 10),
};

function getTaskXp(task: Task) {
  return DIFFICULTIES[task.difficulty].xp;
}

function calculateXp(tasks: Task[]) {
  return tasks.reduce((sum, task) => sum + (task.completed ? getTaskXp(task) : 0), 0);
}

function getLevelInfo(xp: number) {
  let level = 1;
  let remaining = xp;
  let next = 120;

  while (remaining >= next) {
    remaining -= next;
    level += 1;
    next = 120 + level * 45;
  }

  return {
    level,
    current: remaining,
    next,
    progress: Math.min(100, Math.round((remaining / next) * 100)),
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodoQuest() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("Работа");
  const [difficulty, setDifficulty] = useState<Difficulty>("focus");
  const [filter, setFilter] = useState<Filter>("active");
  const [burstId, setBurstId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dateLabel, setDateLabel] = useState("Сегодня");
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const date = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    setDateLabel(date.charAt(0).toUpperCase() + date.slice(1));

    try {
      const savedTasks = window.localStorage.getItem(TASKS_KEY);
      const savedStats = window.localStorage.getItem(STATS_KEY);

      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks) as Task[];
        if (Array.isArray(parsedTasks)) {
          setTasks(parsedTasks);
        }
      }

      if (savedStats) {
        const parsedStats = JSON.parse(savedStats) as Stats;
        setStats({ ...initialStats, ...parsedStats });
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
        const duration = kind === "level" ? 0.12 : 0.09;

        oscillator.type = kind === "delete" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(kind === "soft" ? 0.045 : 0.075, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });
    },
    [stats.soundOn],
  );

  const xp = useMemo(() => calculateXp(tasks), [tasks]);
  const levelInfo = useMemo(() => getLevelInfo(xp), [xp]);
  const completedCount = tasks.filter((task) => task.completed).length;
  const activeCount = tasks.length - completedCount;
  const todayDone = tasks.filter((task) => task.completedAt?.startsWith(todayKey())).length;
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks = useMemo(() => {
    if (filter === "done") {
      return tasks.filter((task) => task.completed);
    }

    if (filter === "active") {
      return tasks.filter((task) => !task.completed);
    }

    return tasks;
  }, [filter, tasks]);

  const addTask = () => {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      playSound("soft");
      return;
    }

    const task: Task = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      tag,
      difficulty,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((currentTasks) => [task, ...currentTasks]);
    setTitle("");
    playSound("add");
  };

  const toggleTask = (id: string) => {
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
            currentStats.lastCompletedDay === todayKey() || !currentStats.lastCompletedDay
              ? currentStats.combo + 1
              : 1,
          lastCompletedDay: todayKey(),
        }));
        setBurstId(id);
        window.setTimeout(() => setBurstId(null), 520);
        playSound(nextLevel > previousLevel ? "level" : "complete");
      } else {
        playSound("soft");
      }

      return nextTasks;
    });
  };

  const deleteTask = (id: string) => {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    playSound("delete");
  };

  const clearDone = () => {
    if (!completedCount) {
      playSound("soft");
      return;
    }

    setTasks((currentTasks) => currentTasks.filter((task) => !task.completed));
    playSound("delete");
  };

  const toggleSound = () => {
    setStats((currentStats) => ({
      ...currentStats,
      soundOn: !currentStats.soundOn,
    }));
  };

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Панель состояния">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>Level List</h1>
        </div>

        <button className="sound-toggle" type="button" onClick={toggleSound}>
          <span className={stats.soundOn ? "sound-dot is-on" : "sound-dot"} />
          Звук {stats.soundOn ? "on" : "off"}
        </button>
      </section>

      <section className="hero-panel" aria-label="Прогресс">
        <div className="level-mark">
          <span>LVL</span>
          <strong>{levelInfo.level}</strong>
        </div>

        <div className="progress-copy">
          <p className="eyebrow">XP прогресс</p>
          <h2>
            {levelInfo.current} / {levelInfo.next} XP
          </h2>
          <div className="xp-track" aria-label={`Прогресс уровня ${levelInfo.progress}%`}>
            <span style={{ width: `${levelInfo.progress}%` }} />
          </div>
        </div>

        <div className="combo-pill">
          <span>Комбо</span>
          <strong>{stats.combo}</strong>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="status-rail" aria-label="Статистика">
          <div className="metric">
            <span>Сегодня</span>
            <strong>{todayDone}</strong>
          </div>
          <div className="metric">
            <span>Активно</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="metric">
            <span>Готово</span>
            <strong>{completionRate}%</strong>
          </div>
          <button className="ghost-button" type="button" onClick={clearDone}>
            Очистить done
          </button>
        </aside>

        <div className="task-zone">
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              addTask();
            }}
          >
            <input
              aria-label="Новая задача"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Новая задача"
            />

            <select
              aria-label="Категория"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
            >
              <option>Работа</option>
              <option>Учёба</option>
              <option>Дом</option>
              <option>Личное</option>
              <option>Босс</option>
            </select>

            <select
              aria-label="Сложность"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty)}
            >
              {Object.entries(DIFFICULTIES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label} +{value.xp}
                </option>
              ))}
            </select>

            <button className="primary-button" type="submit">
              Добавить
            </button>
          </form>

          <div className="filter-row" aria-label="Фильтры">
            {(["active", "all", "done"] as const).map((option) => (
              <button
                className={filter === option ? "filter-button is-active" : "filter-button"}
                key={option}
                type="button"
                onClick={() => setFilter(option)}
              >
                {option === "active" ? "В работе" : option === "all" ? "Все" : "Done"}
              </button>
            ))}
          </div>

          <div className="task-list" aria-live="polite">
            {filteredTasks.length ? (
              filteredTasks.map((task) => {
                const difficultyMeta = DIFFICULTIES[task.difficulty];

                return (
                  <article
                    className={task.completed ? "task-card is-complete" : "task-card"}
                    key={task.id}
                  >
                    <button
                      className="check-button"
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      aria-label={task.completed ? "Вернуть задачу" : "Завершить задачу"}
                    >
                      <span />
                    </button>

                    <div className="task-main">
                      <div className="task-title-row">
                        <h3>{task.title}</h3>
                        <span className={`xp-chip tone-${difficultyMeta.tone}`}>
                          +{difficultyMeta.xp} XP
                        </span>
                      </div>

                      <div className="task-meta">
                        <span>{task.tag}</span>
                        <span>{difficultyMeta.label}</span>
                      </div>
                    </div>

                    <button
                      className="delete-button"
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      aria-label="Удалить задачу"
                      title="Удалить"
                    >
                      ×
                    </button>

                    {burstId === task.id ? (
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
              })
            ) : (
              <div className="empty-state">
                <strong>Пусто</strong>
                <span>Смена фильтра или новая задача вернут доску в игру.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
