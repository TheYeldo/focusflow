import type { Metadata } from "next";
import TodoQuest from "./TodoQuest";

export const metadata: Metadata = {
  title: "FocusFlow",
  description: "Стеклянный todo-органайзер с дедлайнами, категориями, XP и звуками.",
};

export default function Home() {
  return <TodoQuest />;
}
