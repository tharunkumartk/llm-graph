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
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();

  // Track where the connection started
  const connectingNodeId = useRef<string | null>(null);
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
      const assistantNode: ChatNode = {
        id: assistantId,
        type: "message",
        position: { x: 0, y: 0 },
        origin: [0.5, 0.0],
        data: {
          role: "assistant",
          content: "Thinking...",
          timestamp: Date.now(),
        },
      };

      setNodes((prevNodes) => {
        const inputNode = prevNodes.find((n) => n.id === inputNodeId);
        if (inputNode) {
          assistantNode.position = {
            x: inputNode.position.x,
            y: inputNode.position.y + 200,
          };
        }
        return [...prevNodes, assistantNode];
      });

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
    [nodes, edges, getContextForNode, setNodes, setEdges]
  );

  // Standard onConnect for connecting existing nodes (less relevant here but good to keep)
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

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
        const inputId = `input-${Date.now()}`;

        const newNode: ChatNode = {
          id: inputId,
          type: "inputNode",
          position, // Use the drop position
          data: {
            role: "user",
            content: "",
            timestamp: Date.now(),
            isInput: true,
            onSend: (text) => handleSend(text, parentId, inputId),
          },
          origin: [0.5, 0.0],
        };

        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) =>
          addEdge(
            {
              id: `e-${parentId}-${inputId}`,
              source: parentId,
              target: inputId,
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
            },
            eds
          )
        );
      }

      connectingNodeId.current = null;
    },
    [screenToFlowPosition, handleSend, setNodes, setEdges]
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
    serializeState,
    exportState,
    importState,
    copyStateToClipboard,
    saveToLocalStorage,
    loadFromLocalStorage,
    startNewConversation,
  };
};
