import { useCallback, useRef, useEffect } from "react";
import {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  OnConnectStart,
  OnConnectEnd,
} from "@xyflow/react";
import { ChatNode, ChatMessage, MessageRole } from "@/types/chat";

const STORAGE_KEY = "llm-graph-conversation-state";

const getInitialNodes = (): ChatNode[] => [
  {
    id: "root",
    type: "message",
    position: { x: 250, y: 50 },
    data: {
      role: "assistant",
      content:
        "Hello! I am your graph-based AI assistant. Drag from this node to start a new conversation branch.",
      timestamp: Date.now(),
    },
  },
];

export const useChatGraph = () => {
  const { screenToFlowPosition, getViewport, setViewport, setCenter, getNode } =
    useReactFlow();

  // Track where the connection started
  const connectingNodeId = useRef<string | null>(null);
  const connectingHandleId = useRef<string | null>(null);
  const isInitialized = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<ChatNode>(
    getInitialNodes()
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Helper: Trace back the conversation history for a given node ID
  const getContextForNode = useCallback(
    (
      nodeId: string,
      currentNodes: Node[],
      currentEdges: Edge[]
    ): ChatMessage[] => {
      const history: ChatMessage[] = [];
      let currentNodeId: string | null = nodeId;

      while (currentNodeId) {
        const node = currentNodes.find((n) => n.id === currentNodeId);
        if (!node) break;

        if (node.type === "message") {
          history.unshift({
            role: node.data.role as "user" | "assistant",
            content: node.data.content as string,
          });
        }

        const parentEdge = currentEdges.find((e) => e.target === currentNodeId);
        currentNodeId = parentEdge ? parentEdge.source : null;
      }

      return history;
    },
    []
  );

  const handleSend = useCallback(
    async (text: string, parentId: string, inputNodeId: string) => {
      // 1. Replace the Input Node with a User Message Node
      const userNodeId = inputNodeId;

      setNodes((prevNodes) => {
        return prevNodes.map((node) => {
          if (node.id === inputNodeId) {
            return {
              ...node,
              type: "message",
              data: {
                ...node.data,
                role: "user",
                content: text,
                isInput: false,
              },
            };
          }
          return node;
        });
      });

      // 2. Create a placeholder Assistant Node
      const assistantId = `ai-${Date.now()}`;

      // Calculate position based on input node
      // Use getNode to get the most current position, avoiding stale state in closures
      const inputNode = getNode(inputNodeId);
      const position = inputNode
        ? {
            x: inputNode.position.x,
            y: inputNode.position.y + 150 + (inputNode.measured?.height || 50),
          }
        : { x: 0, y: 0 };

      const assistantNode: ChatNode = {
        id: assistantId,
        type: "message",
        position,
        origin: [0.5, 0.0],
        data: {
          role: "assistant",
          content: "Thinking...",
          timestamp: Date.now(),
        },
      };

      setNodes((prevNodes) => [...prevNodes, assistantNode]);

      setEdges((prevEdges) =>
        addEdge(
          {
            id: `e-${userNodeId}-${assistantId}`,
            source: userNodeId,
            target: assistantId,
            markerEnd: { type: MarkerType.ArrowClosed },
            type: "smoothstep",
          },
          prevEdges
        )
      );

      // Auto-zoom to the new assistant node
      setCenter(position.x, position.y, {
        zoom: getViewport().zoom,
        duration: 800,
      });

      // 3. Prepare Context and Call API
      const parentContext = getContextForNode(parentId, nodes, edges);
      const contextMessages = [
        ...parentContext,
        { role: "user", content: text },
      ];

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: contextMessages }),
        });

        const data = await response.json();
        const reply = data.reply || "Error: No response";

        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === assistantId) {
              return {
                ...n,
                data: { ...n.data, content: reply },
              };
            }
            return n;
          })
        );
      } catch (error) {
        console.error("API Error", error);
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === assistantId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  content: "Error: Could not fetch response.",
                },
              };
            }
            return n;
          })
        );
      }
    },
    [
      nodes,
      edges,
      getContextForNode,
      setNodes,
      setEdges,
      setCenter,
      getViewport,
      getNode,
    ]
  );

  // Standard onConnect for connecting existing nodes (less relevant here but good to keep)
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onConnectStart: OnConnectStart = useCallback(
    (_, { nodeId, handleId }) => {
      connectingNodeId.current = nodeId;
      connectingHandleId.current = handleId || null;
    },
    []
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!connectingNodeId.current) return;

      const targetIsPane = (event.target as Element).classList.contains(
        "react-flow__pane"
      );

      if (targetIsPane) {
        // We need to figure out the position of the new node.
        // screenToFlowPosition converts screen coordinates to flow coordinates
        // event is a MouseEvent or TouchEvent
        const { clientX, clientY } =
          "changedTouches" in event
            ? event.changedTouches[0]
            : (event as MouseEvent);
        const position = screenToFlowPosition({ x: clientX, y: clientY });

        const parentId = connectingNodeId.current;
        const handleId = connectingHandleId.current || "bottom";
        const inputId = `input-${Date.now()}`;

        // Use the exact drop position as requested
        const adjustedPosition = position;

        const newNode: ChatNode = {
          id: inputId,
          type: "inputNode",
          position: adjustedPosition,
          data: {
            role: "user",
            content: "",
            timestamp: Date.now(),
            isInput: true,
            onSend: (text) => handleSend(text, parentId, inputId),
            onCancel: () => {
              // Delete the node
              setNodes((nds) => nds.filter((n) => n.id !== inputId));
              // Delete the edge
              setEdges((eds) => eds.filter((e) => e.target !== inputId));

              // Zoom back to the parent node
              const parentNode = nodes.find((n) => n.id === parentId);
              if (parentNode) {
                // Adjust for node width/height to center it properly
                // Assuming standard node size, or we could use measured dimensions if available
                const width = parentNode.measured?.width || 300;
                const height = parentNode.measured?.height || 100;

                setCenter(
                  parentNode.position.x + width / 2,
                  parentNode.position.y + height / 2,
                  {
                    zoom: getViewport().zoom,
                    duration: 800,
                  }
                );
              }
            },
          },
          origin: [0.5, 0.0],
        };

        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) =>
          addEdge(
            {
              id: `e-${parentId}-${inputId}`,
              source: parentId,
              sourceHandle: handleId,
              target: inputId,
              // Initial target handle based on the source handle used
              targetHandle:
                handleId === "left"
                  ? "right"
                  : handleId === "right"
                  ? "left"
                  : "top",
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
            },
            eds
          )
        );

        // Move view to the new node
        setCenter(adjustedPosition.x, adjustedPosition.y, {
          zoom: getViewport().zoom,
          duration: 800,
        });
      }

      connectingNodeId.current = null;
      connectingHandleId.current = null;
    },
    [
      screenToFlowPosition,
      handleSend,
      setNodes,
      setEdges,
      setCenter,
      getViewport,
      nodes,
    ]
  );

  // Helper: Get optimal handles based on relative node positions
  const getOptimalHandles = (sourceNode: Node, targetNode: Node) => {
    const sourceCenter = {
      x: sourceNode.position.x + (sourceNode.measured?.width || 300) / 2,
      y: sourceNode.position.y + (sourceNode.measured?.height || 100) / 2,
    };
    const targetCenter = {
      x: targetNode.position.x + (targetNode.measured?.width || 300) / 2,
      y: targetNode.position.y + (targetNode.measured?.height || 100) / 2,
    };

    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;

    // Determine primary direction
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal relationship
      if (dx > 0) {
        // Target is to the right
        return { source: "right", target: "left" }; // Using base IDs
      } else {
        // Target is to the left
        return { source: "left", target: "right" };
      }
    } else {
      // Vertical relationship
      if (dy > 0) {
        // Target is below
        return { source: "bottom", target: "top" };
      } else {
        // Target is above - standard flow usually down, but for flexible layout:
        return { source: "bottom", target: "top" };
      }
    }
  };

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setEdges((prevEdges) => {
        return prevEdges.map((edge) => {
          // Check if this edge is connected to the dragged node
          if (edge.source === node.id || edge.target === node.id) {
            const sourceNode =
              edge.source === node.id
                ? node
                : nodes.find((n) => n.id === edge.source);
            const targetNode =
              edge.target === node.id
                ? node
                : nodes.find((n) => n.id === edge.target);

            if (sourceNode && targetNode) {
              const { source, target } = getOptimalHandles(
                sourceNode,
                targetNode
              );

              // Determine precise handle IDs based on node type
              let finalTargetHandle = target;

              // InputNode uses "left", "right"
              // MessageNode uses "left-target", "right-target" for inputs
              if (
                targetNode.type === "message" &&
                (target === "left" || target === "right")
              ) {
                finalTargetHandle = `${target}-target`;
              } else if (targetNode.type === "inputNode") {
                // InputNode has IDs "left", "right"
                finalTargetHandle = target;
              } else if (target === "top") {
                finalTargetHandle = "top";
              }

              // Only update if handles changed
              if (
                edge.sourceHandle !== source ||
                edge.targetHandle !== finalTargetHandle
              ) {
                return {
                  ...edge,
                  sourceHandle: source,
                  targetHandle: finalTargetHandle,
                };
              }
            }
          }
          return edge;
        });
      });
    },
    [nodes, setEdges]
  );

  // Serialize the conversation state to JSON
  const serializeState = useCallback(() => {
    const state = {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          role: node.data.role,
          content: node.data.content,
          timestamp: node.data.timestamp,
          isInput: node.data.isInput,
          label: node.data.label,
        },
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        markerEnd: edge.markerEnd,
      })),
      viewport: getViewport(),
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };
    return state;
  }, [nodes, edges, getViewport]);

  // Export state as JSON file
  const exportState = useCallback(() => {
    const state = serializeState();
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [serializeState]);

  // Import state from JSON
  const importState = useCallback(
    (jsonString: string) => {
      try {
        const state = JSON.parse(jsonString);

        if (!state.nodes || !state.edges) {
          throw new Error("Invalid state format");
        }

        interface SerializedNode {
          id: string;
          type: string;
          position: { x: number; y: number };
          data: {
            role: MessageRole;
            content: string;
            timestamp: number;
            isInput?: boolean;
            label?: string;
          };
          origin?: [number, number];
        }

        interface SerializedEdge {
          id: string;
          source: string;
          target: string;
          type?: string;
          markerEnd?: { type: MarkerType };
        }

        // Restore nodes without the onSend callback (we'll recreate it if needed)
        const restoredNodes: ChatNode[] = (state.nodes as SerializedNode[]).map(
          (node) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: {
              role: node.data.role,
              content: node.data.content,
              timestamp: node.data.timestamp,
              isInput: node.data.isInput,
              label: node.data.label,
              // Re-attach onSend for input nodes
              ...(node.data.isInput && {
                onSend: (text: string) =>
                  handleSend(text, node.id.replace("input-", ""), node.id),
                onCancel: () => {
                  const inputId = node.id;
                  // We need to find the parent from edges.
                  // This is tricky because edges state isn't directly accessible here in the callback without closure.
                  // However, we can use functional state update to find the edge.

                  setEdges((currentEdges) => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const _edge = currentEdges.find(
                      (e) => e.target === inputId
                    );
                    return currentEdges.filter((e) => e.target !== inputId);
                  });

                  setNodes((currentNodes) => {
                    return currentNodes.filter((n) => n.id !== inputId);
                  });

                  // Note: Zooming back on restored nodes is skipped for simplicity.
                },
              }),
            },
            ...(node.origin && { origin: node.origin }),
          })
        );

        const restoredEdges: Edge[] = (state.edges as SerializedEdge[]).map(
          (edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type || "smoothstep",
            markerEnd: edge.markerEnd || { type: MarkerType.ArrowClosed },
          })
        );

        setNodes(restoredNodes);
        setEdges(restoredEdges);

        if (state.viewport) {
          setViewport(state.viewport);
        }

        return true;
      } catch (error) {
        console.error("Failed to import state:", error);
        return false;
      }
    },
    [setNodes, setEdges, handleSend, setViewport]
  );

  // Copy state to clipboard
  const copyStateToClipboard = useCallback(async () => {
    const state = serializeState();
    const jsonString = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(jsonString);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  }, [serializeState]);

  // Save state to localStorage
  const saveToLocalStorage = useCallback(() => {
    try {
      const state = serializeState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }, [serializeState]);

  // Load state from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        return importState(savedState);
      }
      return false;
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      return false;
    }
  }, [importState]);

  // Clear state and start fresh
  const startNewConversation = useCallback(() => {
    const initialNodes = getInitialNodes();
    setNodes(initialNodes);
    setEdges([]);
    localStorage.removeItem(STORAGE_KEY);
  }, [setNodes, setEdges]);

  // Auto-save whenever nodes or edges change
  useEffect(() => {
    if (isInitialized.current) {
      // Debounce the save to avoid excessive writes
      const timeoutId = setTimeout(() => {
        try {
          const state = serializeState();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
          console.error("Failed to save to localStorage:", error);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges, serializeState]);

  // Load saved state on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const success = importState(savedState);
        if (success) {
          console.log("Loaded conversation from localStorage");
        }
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    isInitialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeDrag,
    serializeState,
    exportState,
    importState,
    copyStateToClipboard,
    saveToLocalStorage,
    loadFromLocalStorage,
    startNewConversation,
  };
};
