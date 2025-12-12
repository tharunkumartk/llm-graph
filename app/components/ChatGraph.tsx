"use client";

import React, { useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, Upload, Copy, Plus, HelpCircle } from "lucide-react";

import { useChatGraph } from "@/app/hooks/useChatGraph";
import MessageNode from "./nodes/MessageNode";
import InputNode from "./nodes/InputNode";
import TutorialModal from "./TutorialModal";
import NodeSearchOverlay from "./NodeSearchOverlay";

const nodeTypes = {
  message: MessageNode,
  inputNode: InputNode,
};

function ChatGraphContent() {
  const { getNodes, getEdges, setCenter } = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeDrag,
    startNewConversation,
    exportState,
    importState,
    copyStateToClipboard,
    saveToLocalStorage,
    addInputNode,
  } = useChatGraph();

  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // Navigation state
  const focusedNodeIdRef = useRef<string | null>(null);

  // Helper to focus on a node with smart zoom (top-aligned, width-fitting)
  const focusNode = React.useCallback(
    (nodeId: string) => {
      const node = getNodes().find((n) => n.id === nodeId);
      if (!node) return;

      const vh = window.innerHeight || 800;
      const vw = window.innerWidth || 1200;

      const nodeWidth = node.measured?.width || 500;

      // Target zoom: 1.0 (readable) or fit width if node is too wide
      let targetZoom = 1.0;
      const paddingX = 40;
      if (nodeWidth * targetZoom > vw - paddingX) {
        targetZoom = (vw - paddingX) / nodeWidth;
      }

      // Calculate center coordinates
      // We want to center horizontally on the node
      // And vertically align the top of the node near the top of the screen

      // Determine node top and center-x based on origin
      // Default origin is [0,0] (top-left). useChatGraph sets [0.5, 0] (top-center) for some.
      const isOriginCenteredX = node.origin?.[0] === 0.5;
      const isOriginTopY = !node.origin || node.origin[1] === 0;

      const nodeCenterX = isOriginCenteredX
        ? node.position.x
        : node.position.x + nodeWidth / 2;

      const nodeTopY = isOriginTopY
        ? node.position.y
        : node.position.y - (node.measured?.height || 0) / 2; // Assuming 0.5 originY if not 0

      const paddingTop = 100; // Distance from top of screen

      // Calculate viewport center that places nodeTopY at paddingTop
      // CenterY = TopY + (ScreenHeight/2 - PaddingTop) / Zoom
      const targetCenterY = nodeTopY + (vh / 2 - paddingTop) / targetZoom;

      setCenter(nodeCenterX, targetCenterY, {
        zoom: targetZoom,
        duration: 800,
      });
      focusedNodeIdRef.current = nodeId;
    },
    [getNodes, setCenter]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + F: open Spotlight-like node search (override browser Find)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // While search is open, let it own keyboard input.
      if (isSearchOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsSearchOpen(false);
        }
        return;
      }

      // Only handle navigation if not typing in an input field (unless it's the graph itself)
      // Since InputNode has an input field, we might want to be careful.
      // But typically "Tab" and Arrow keys in a canvas context should be handled if the canvas is focused or globally if not inside a textarea/input.
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        // Allow Tab to escape input? Or Arrows to move cursor?
        // If it's the InputNode's input, we probably want normal behavior.
        // But if user wants to navigate OUT of the input to the graph?
        // For now, let's ignore if inside input/textarea to avoid conflict.
        return;
      }

      // Cmd + = to add new node to most recent assistant response
      if ((event.metaKey || event.ctrlKey) && event.key === "=") {
        event.preventDefault();
        const currentNodes = getNodes();

        // Find most recent assistant node
        const assistantNodes = currentNodes.filter(
          (n) => n.data.role === "assistant"
        );

        if (assistantNodes.length > 0) {
          // Sort by timestamp descending
          assistantNodes.sort(
            (a, b) =>
              ((b.data.timestamp as number) || 0) -
              ((a.data.timestamp as number) || 0)
          );

          const mostRecentAssistant = assistantNodes[0];
          addInputNode(mostRecentAssistant.id);
        }
        return;
      }

      // Cmd + Up: Go to absolute first node (root)
      if ((event.metaKey || event.ctrlKey) && event.key === "ArrowUp") {
        event.preventDefault();
        const currentNodes = getNodes();
        if (currentNodes.length > 0) {
          // Try to find root first
          let targetNode = currentNodes.find((n) => n.id === "root");

          // If no root, find the earliest node by timestamp
          if (!targetNode) {
            const sortedNodes = [...currentNodes].sort(
              (a, b) =>
                ((a.data.timestamp as number) || 0) -
                ((b.data.timestamp as number) || 0)
            );
            targetNode = sortedNodes[0];
          }

          if (targetNode) {
            focusNode(targetNode.id);
          }
        }
        return;
      }

      // Cmd + Down: Go to absolute last node (most recent)
      if ((event.metaKey || event.ctrlKey) && event.key === "ArrowDown") {
        event.preventDefault();
        const currentNodes = getNodes();
        if (currentNodes.length > 0) {
          // Find most recent node by timestamp
          const sortedNodes = [...currentNodes].sort(
            (a, b) =>
              ((b.data.timestamp as number) || 0) -
              ((a.data.timestamp as number) || 0)
          );

          if (sortedNodes.length > 0) {
            focusNode(sortedNodes[0].id);
          }
        }
        return;
      }

      if (
        ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          event.key
        )
      ) {
        const currentNodes = getNodes();
        const currentEdges = getEdges();

        if (currentNodes.length === 0) return;

        // If no node is focused, default to the first one (or root)
        let currentNodeId = focusedNodeIdRef.current;
        if (
          !currentNodeId ||
          !currentNodes.find((n) => n.id === currentNodeId)
        ) {
          // Try to find root or just take the first one
          // Assuming root is first or has specific ID 'root'
          const root =
            currentNodes.find((n) => n.id === "root") || currentNodes[0];
          currentNodeId = root.id;
          // If we are just starting, we might not want to preventDefault yet if we are not "active"
          // But let's assume we want to start navigation.
        }

        let nextNodeId: string | null = null;

        if (event.key === "Tab") {
          event.preventDefault();
          // Linear navigation by timestamp
          const sortedNodes = [...currentNodes].sort((a, b) => {
            return (a.data.timestamp as number) - (b.data.timestamp as number);
          });
          const currentIndex = sortedNodes.findIndex(
            (n) => n.id === currentNodeId
          );
          const nextIndex = (currentIndex + 1) % sortedNodes.length;
          nextNodeId = sortedNodes[nextIndex].id;
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          // Find children (outgoing edges)
          const outgoingEdges = currentEdges.filter(
            (e) => e.source === currentNodeId
          );
          if (outgoingEdges.length > 0) {
            // If multiple children, pick the one with most recent timestamp or just first
            // Let's pick the first one for now, or the one that is "closest" to x=0 relative to parent?
            // Chat usually branches. Let's just pick the first one found.
            // Or maybe the one most recently added?
            // Finding the child node to check timestamp
            const children = outgoingEdges
              .map((e) => currentNodes.find((n) => n.id === e.target))
              .filter(Boolean);
            // Sort by timestamp descending (newest first)
            children.sort(
              (a, b) =>
                ((b?.data.timestamp as number) || 0) -
                ((a?.data.timestamp as number) || 0)
            );
            if (children.length > 0 && children[0]) {
              nextNodeId = children[0].id;
            }
          }
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          // Find parent (incoming edge)
          const incomingEdge = currentEdges.find(
            (e) => e.target === currentNodeId
          );
          if (incomingEdge) {
            nextNodeId = incomingEdge.source;
          }
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          // Siblings
          const incomingEdge = currentEdges.find(
            (e) => e.target === currentNodeId
          );
          if (incomingEdge) {
            const parentId = incomingEdge.source;
            // Find all children of parent
            const siblingEdges = currentEdges.filter(
              (e) => e.source === parentId
            );
            const siblings = siblingEdges
              .map((e) => currentNodes.find((n) => n.id === e.target))
              .filter(Boolean);

            // Sort siblings by timestamp (creation order)
            siblings.sort(
              (a, b) =>
                ((a?.data.timestamp as number) || 0) -
                ((b?.data.timestamp as number) || 0)
            );

            const currentIndex = siblings.findIndex(
              (n) => n?.id === currentNodeId
            );
            if (currentIndex !== -1) {
              if (event.key === "ArrowLeft") {
                // Previous sibling
                const nextIndex = currentIndex - 1;
                if (nextIndex >= 0 && siblings[nextIndex]) {
                  nextNodeId = siblings[nextIndex]!.id;
                }
              } else {
                // Next sibling
                const nextIndex = currentIndex + 1;
                if (nextIndex < siblings.length && siblings[nextIndex]) {
                  nextNodeId = siblings[nextIndex]!.id;
                }
              }
            }
          }
        }

        if (nextNodeId) {
          focusNode(nextNodeId);
        } else if (!focusedNodeIdRef.current) {
          // If we didn't move but we just initialized focus (e.g. first Tab press)
          focusNode(currentNodeId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [getNodes, getEdges, focusNode, addInputNode, isSearchOpen]);

  React.useEffect(() => {
    // Check initial preference
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setIsDarkMode(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (importState(content)) {
          // Optional: Show a toast notification here
        } else {
          alert("Failed to import conversation. Please check the file format.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    exportState();
  };

  const handleCopyToClipboard = async () => {
    await copyStateToClipboard();
    // Optional: Show a toast notification here
  };

  const handleStartNew = () => {
    if (nodes.length > 1) {
      const confirmed = confirm(
        "Are you sure you want to start a new conversation? This will clear the current graph."
      );
      if (!confirmed) return;
    }
    startNewConversation();
  };

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-black relative group/canvas">
      <NodeSearchOverlay
        isOpen={isSearchOpen}
        nodes={nodes}
        onClose={() => setIsSearchOpen(false)}
        onSelectNode={(nodeId) => {
          setIsSearchOpen(false);
          focusNode(nodeId);
        }}
      />

      {/* Top Control Bar */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2 p-1.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-gray-200/60 dark:border-zinc-800/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200 dark:border-zinc-800">
          <button
            onClick={handleExport}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 rounded-xl transition-all duration-200 group relative"
            title="Export JSON"
          >
            <Download size={18} strokeWidth={2} />
            <span className="sr-only">Export</span>
          </button>
          <button
            onClick={handleImport}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 rounded-xl transition-all duration-200 group relative"
            title="Import JSON"
          >
            <Upload size={18} strokeWidth={2} />
            <span className="sr-only">Import</span>
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 rounded-xl transition-all duration-200 group relative"
            title="Copy to Clipboard"
          >
            <Copy size={18} strokeWidth={2} />
            <span className="sr-only">Copy</span>
          </button>
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 rounded-xl transition-all duration-200 group relative"
            title="Help & Shortcuts"
          >
            <HelpCircle size={18} strokeWidth={2} />
            <span className="sr-only">Help</span>
          </button>
        </div>

        <button
          onClick={handleStartNew}
          className="flex items-center gap-2 pl-2 pr-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 group"
        >
          <div className="p-1 rounded-lg bg-gray-100 dark:bg-zinc-800 group-hover:bg-red-100 dark:group-hover:bg-red-900/40 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            <Plus
              size={14}
              strokeWidth={2.5}
              className="group-hover:rotate-90 transition-transform duration-300"
            />
          </div>
          <span>New Chat</span>
        </button>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={(_, node) => {
          focusedNodeIdRef.current = node.id;
        }}
        onNodeDrag={onNodeDrag}
        onNodeClick={(_, node) => {
          focusedNodeIdRef.current = node.id;
        }}
        onMoveEnd={saveToLocalStorage} // Add this
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        panOnScroll={true}
        zoomActivationKeyCode="Meta"
        nodesDraggable={true}
        nodesConnectable={true}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          style: { stroke: isDarkMode ? "#52525b" : "#e5e7eb", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={24}
          size={1}
          color={isDarkMode ? "#27272a" : "#E5E7EB"}
        />
        <Controls className="!left-6 !bottom-6 !m-0 p-1.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-gray-200/60 dark:border-zinc-800/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden !flex !flex-col gap-1 [&>button]:!bg-transparent [&>button]:!border-0 [&>button]:p-2 [&>button]:text-gray-500 dark:[&>button]:text-gray-400 [&>button:hover]:text-gray-900 dark:[&>button:hover]:text-gray-100 [&>button:hover]:!bg-gray-100/50 dark:[&>button:hover]:!bg-zinc-800/50 [&>button]:rounded-xl [&>button]:transition-all [&>button]:duration-200" />
        <MiniMap
          zoomable
          pannable
          className="!bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-sm !border-gray-200 dark:!border-zinc-800 !shadow-sm !rounded-xl !overflow-hidden !right-6 !bottom-6 !m-0"
          maskColor={
            isDarkMode ? "rgba(9, 9, 11, 0.6)" : "rgba(249, 250, 251, 0.6)"
          }
          nodeColor={(n) => {
            if (n.type === "inputNode") return "#3b82f6";
            if (n.data?.role === "user")
              return isDarkMode ? "#1e40af" : "#93c5fd";
            return isDarkMode ? "#3f3f46" : "#e5e7eb";
          }}
        />
      </ReactFlow>

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />
    </div>
  );
}

export default function ChatGraph() {
  return (
    <ReactFlowProvider>
      <ChatGraphContent />
    </ReactFlowProvider>
  );
}
