// In LogicEditor.tsx - Complete rewrite for better UX
import type { LogicNode } from "../Data/types";
import { ALL_LOGIC_KEYS, MECHANIC_MAPPINGS } from "../Logic/mechanicsMapping";

type Props = {
  logic: LogicNode;
  onChange: (logic: LogicNode) => void;
  onRemove?: () => void;
  mechanics?: Record<string, boolean>;
  isRoot?: boolean;
};

export default function LogicEditor({ logic, onChange, onRemove, mechanics = {}, isRoot = false }: Props) {
  // Handle "has" and "seq" types (leaf nodes)
  if (logic.type === "has" || logic.type === "seq") {
    // Special case: "noCondition" should always be considered satisfied
    const hasMechanic = logic.key === "noCondition" ? true : (logic.key ? mechanics[logic.key] || false : false);

    // Get display name for the selected logic key
    
    for (const mapping of Object.values(MECHANIC_MAPPINGS)) {
      if (mapping.logicKey === logic.key) {
        break;
      }
    }

    return (
      <div style={{
        marginLeft: isRoot ? 0 : 16,
        borderLeft: isRoot ? "none" : "2px solid #ccc",
        paddingLeft: isRoot ? 0 : 12,
        marginTop: 8,
        marginBottom: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <select
            value={logic.key || ""}
            onChange={e => onChange({ ...logic, key: e.target.value })}
            style={{
              padding: "4px 8px",
              border: `2px solid ${hasMechanic ? "#4CAF50" : "#f44336"}`,
              background: hasMechanic ? "#e8f5e8" : "#f5e8e8",
              borderRadius: "4px",
              minWidth: "200px",
              color: "black"
            }}
          >
            <option value="">Select a mechanic...</option>
            {Object.entries(MECHANIC_MAPPINGS).map(([, mapping]) => (
              <option key={mapping.logicKey} value={mapping.logicKey}>
                {mapping.display}
              </option>
            ))}
          </select>
          <span style={{
            color: hasMechanic ? "#4CAF50" : "#f44336",
            fontSize: "1.2em",
            fontWeight: "bold",
            minWidth: "20px"
          }}>
            {hasMechanic ? "✓" : "✗"}
          </span>

          <button
            onClick={() => {
              if (logic.type === "has") {
                onChange({ type: "seq", key: logic.key });
              } else {
                onChange({ type: "has", key: logic.key });
              }
            }}
            style={{
              padding: "2px 8px",
              background: logic.type === "seq" ? "#ff9800" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.8em",
              cursor: "pointer"
            }}
          >
            {logic.type === "seq" ? "Seq" : "Has"}
          </button>

          {!isRoot && onRemove && (
            <button
              onClick={onRemove}
              style={{
                padding: "2px 8px",
                background: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "0.8em",
                cursor: "pointer"
              }}
            >
              Remove
            </button>
          )}
        </div>

        {/* Add buttons for single conditions - this fixes the main issue */}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => {
              // Convert single condition to AND group with this condition + new condition
              const newNode: LogicNode = {
                type: "has",
                key: ALL_LOGIC_KEYS[0] || "dashrefills"
              };
              onChange({
                type: "and",
                nodes: [logic, newNode]
              });
            }}
            style={{
              padding: "6px 12px",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9em",
              fontWeight: "bold"
            }}
          >
            + Add Condition
          </button>

          <button
            onClick={() => {
              // Convert single condition to AND group with this condition + new group
              const newNode: LogicNode = {
                type: "and",
                nodes: [{
                  type: "has",
                  key: ALL_LOGIC_KEYS[0] || "dashrefills"
                }]
              };
              onChange({
                type: "and",
                nodes: [logic, newNode]
              });
            }}
            style={{
              marginLeft: "8px",
              padding: "6px 12px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9em"
            }}
          >
            + Add Group
          </button>
        </div>
      </div>
    );
  }

  // Handle "and" and "or" types (group nodes)
  return (
    <div style={{
      marginLeft: isRoot ? 0 : 16,
      borderLeft: isRoot ? "none" : "2px solid #ccc",
      paddingLeft: isRoot ? 0 : 12,
      marginTop: 8,
      marginBottom: 8
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong style={{
          background: logic.type === "and" ? "#2196F3" : "#4CAF50",
          color: "white",
          padding: "2px 8px",
          borderRadius: "4px"
        }}>
          {logic.type.toUpperCase()}
        </strong>
        <button
          onClick={() => {
            if (logic.type === "and") {
              onChange({ type: "or", nodes: logic.nodes });
            } else {
              onChange({ type: "and", nodes: logic.nodes });
            }
          }}
          style={{
            padding: "2px 8px",
            background: "#ff9800",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "0.8em",
            cursor: "pointer"
          }}
        >
          Switch to {logic.type === "and" ? "OR" : "AND"}
        </button>

        {!isRoot && onRemove && (
          <button
            onClick={onRemove}
            style={{
              padding: "2px 8px",
              background: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.8em",
              cursor: "pointer"
            }}
          >
            Remove Group
          </button>
        )}
      </div>

      {logic.nodes.map((node, i) => (
        <LogicEditor
          key={i}
          logic={node}
          onChange={newNode => {
            const nodes = [...logic.nodes];
            nodes[i] = newNode;
            onChange({ ...logic, nodes });
          }}
          onRemove={() => {
            const nodes = [...logic.nodes];
            nodes.splice(i, 1);
            if (nodes.length === 0) {
              // If no nodes left, replace with a default condition
              onChange({ type: "has", key: "noCondition" });
            } else if (nodes.length === 1) {
              // If only one node left, replace group with that node
              onChange(nodes[0]);
            } else {
              // Otherwise just remove the node
              onChange({ ...logic, nodes });
            }
          }}
          mechanics={mechanics}
          isRoot={false}
        />
      ))}

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            const newNode: LogicNode = {
              type: "has",
              key: ALL_LOGIC_KEYS[0] || "dashrefills"
            };
            onChange({ ...logic, nodes: [...logic.nodes, newNode] });
          }}
          style={{
            padding: "6px 12px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9em",
            fontWeight: "bold"
          }}
        >
          + Add Condition
        </button>

        <button
          onClick={() => {
            const newNode: LogicNode = {
              type: "and",
              nodes: [{
                type: "has",
                key: ALL_LOGIC_KEYS[0] || "dashrefills"
              }]
            };
            onChange({ ...logic, nodes: [...logic.nodes, newNode] });
          }}
          style={{
            marginLeft: "8px",
            padding: "6px 12px",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9em"
          }}
        >
          + Add Group
        </button>
      </div>
    </div>
  );
}