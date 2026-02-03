import type { LocationDef } from "./locations";
export type MechanicState = Record<string, boolean>;

export type LogicCondition = {
  [key: string]: boolean | number | undefined;
};

export type LogicBlock = {
  normal?: LogicCondition;
  sequenceBreak?: LogicCondition[];
};

export type TrackerItemType =
  | "strawberry"
  | "key"
  | "cassette"
  | "heart";

export interface TrackerItem {
  id: string;
  chapter: number;
  type: "strawberry" | "key" | "cassette" | "heart";
  name: string;
  apLocation: string;
  collected?: boolean;
  logic?: any;
}
export interface Strawberry {
  id: string;
  name: string;
  chapter: number;
  collected: boolean;

  // NEW
  type: "strawberry";
  apLocation: string;
}
export type LogicNode =
  | { type: "and"; nodes: LogicNode[] }
  | { type: "or"; nodes: LogicNode[] }
  | { type: "has"; key: string }
  | { type: "seq"; key: string };


export type APLocationType =
  | "strawberry"
  | "cassette"
  | "crystal_heart"
  | "conversation"
  | "sign"
  | "checkpoint"
  | "other";

export interface LocationState extends LocationDef {
checked: boolean;
reachable: boolean;
logic: LogicNode;
apLocationId?: number; // Add this line
}