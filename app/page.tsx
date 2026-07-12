import type { Metadata } from "next";
import TodoQuest from "./TodoQuest";

export const metadata: Metadata = {
  title: "Level List",
  description: "Todo-лист с уровнями, XP, комбо и мягкими звуками действий.",
};

export default function Home() {
  return <TodoQuest />;
}
