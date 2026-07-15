import type { Metadata } from "next";
import TodoQuest from "./TodoQuest";

export const metadata: Metadata = {
  title: "FocusFlow",
  description:
    "Премиальная стеклянная доска задач с дедлайнами, категориями, XP, достижениями и звуками.",
};

export default function Home() {
  return <TodoQuest />;
}
