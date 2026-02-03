
import type { LogicNode, MechanicState, LogicCondition } from "../Data/types";
import type { LocationDef } from "../Data/locations";
import type { RandomizedMechanicsState } from "./mechanics";
export interface StrawberryLogic {
  normal?: LogicCondition;
  sequenceBreak?: LogicCondition[];
}

export type EvaluateResult = {
  status: "free" | "sequence" | "locked";
  missing: string[];
};

export function evaluateLogic(
  logic: LogicNode,
  mechanics: MechanicState
): EvaluateResult {
  if (!logic) return { status: "free", missing: [] };

  // Helper function to evaluate a LogicNode
  function evaluateNode(node: LogicNode): { met: boolean; missing: string[] } {
    if (node.type === "has" || node.type === "seq") {
      // Special case for no condition
      if (node.key === "noCondition") {
        return { met: true, missing: [] };
      }
      
      // Use the logic key directly from the mechanics state
      // The logic.key should match a key in the mechanics state
      const mechKey = node.key as keyof RandomizedMechanicsState;
      
      if (!mechKey) {
        return { met: false, missing: [node.key || "unknown"] };
      }
      
      // Check if the mechanic exists in the mechanics state
      // Note: mechanics is of type MechanicState which should include all randomized mechanics
      const met = mechanics[mechKey] === true;
      return { 
        met, 
        missing: met ? [] : [mechKey] 
      };
    }
    
    if (node.type === "and") {
      const results = node.nodes.map(evaluateNode);
      const allMet = results.every(r => r.met);
      const missing = results.flatMap(r => r.missing);
      return { met: allMet, missing };
    }
    
    if (node.type === "or") {
      const results = node.nodes.map(evaluateNode);
      const anyMet = results.some(r => r.met);
      const missing = anyMet ? [] : results.flatMap(r => r.missing);
      return { met: anyMet, missing };
    }
    
    return { met: false, missing: [] };
  }

  const result = evaluateNode(logic);
  
  if (result.met) {
    return { status: "free", missing: [] };
  }
  
  // Check if any nodes are sequence breaks
  const hasSeqNodes = (node: LogicNode): boolean => {
    if (node.type === "seq") return true;
    if (node.type === "and" || node.type === "or") {
      return node.nodes.some(hasSeqNodes);
    }
    return false;
  };
  
  if (hasSeqNodes(logic)) {
    return { status: "sequence", missing: result.missing };
  }
  
  return { status: "locked", missing: result.missing };
}

export function isReachable(
  loc: LocationDef,
  mechanics: RandomizedMechanicsState
): boolean {
  return loc.requires.every(r => (mechanics as Record<string, boolean>)[r]);
}

export function missingMechanics(
  loc: LocationDef,
  mechanics: RandomizedMechanicsState
): string[] {
  return loc.requires.filter(r => !(mechanics as Record<string, boolean>)[r]);
}
