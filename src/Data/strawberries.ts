import { type LogicNode } from "./types";

export type StrawberryDef = {
  id: string;
  name: string;
  chapter: number;
  logic: LogicNode;
};

export const strawberries: StrawberryDef[] = [
  {
    id: "ch1-berry-1",
    name: "Chapter 1 - Strawberry 1",
    chapter: 1,
    logic: {
      type: "has",
      key: "hasDashRefills"
    }
  },
  {
    id: "ch1-berry-2",
    name: "Chapter 1 - Strawberry 2",
    chapter: 1,
    logic: {
      type: "and",
      nodes: [
        { type: "has", key: "hasDashRefills" },
        { type: "has", key: "hasSprings" }
      ]
    }
  }
];
