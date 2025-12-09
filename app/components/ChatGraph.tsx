import React, { useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Upload, Copy, Plus } from 'lucide-react';

import { useChatGraph } from '@/app/hooks/useChatGraph';
import MessageNode from './nodes/MessageNode';
import InputNode from './nodes/InputNode';

const nodeTypes = {
  message: MessageNode,
  inputNode: InputNode,
};

function ChatGraphContent() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect, 
    onConnectStart, 
    onConnectEnd,
    startNewConversation,
    exportState,
    importState,
    copyStateToClipboard,
    saveToLocalStorage // Add this
  } = useChatGraph();

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
          alert('Failed to import conversation. Please check the file format.');
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
      const confirmed = confirm('Are you sure you want to start a new conversation? This will clear the current graph.');
      if (!confirmed) return;
    }
    startNewConversation();
  };

  return (
    <div className="w-full h-screen bg-gray-50 relative group/canvas">
      {/* Top Control Bar */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
        
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
            <button
            onClick={handleExport}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 rounded-xl transition-all duration-200 group relative"
            title="Export JSON"
            >
            <Download size={18} strokeWidth={2} />
            <span className="sr-only">Export</span>
            </button>
            <button
            onClick={handleImport}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 rounded-xl transition-all duration-200 group relative"
            title="Import JSON"
            >
            <Upload size={18} strokeWidth={2} />
            <span className="sr-only">Import</span>
            </button>
            <button
            onClick={handleCopyToClipboard}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 rounded-xl transition-all duration-200 group relative"
            title="Copy to Clipboard"
            >
            <Copy size={18} strokeWidth={2} />
            <span className="sr-only">Copy</span>
            </button>
        </div>

        <button
          onClick={handleStartNew}
          className="flex items-center gap-2 pl-2 pr-4 py-1.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-all duration-200 group"
        >
          <div className="p-1 rounded-lg bg-gray-100 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
            <Plus size={14} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
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
        onMoveEnd={saveToLocalStorage} // Add this
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        nodesDraggable={true}
        nodesConnectable={true}
        defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#e5e7eb', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#E5E7EB" />
        <Controls className="bg-white/80 backdrop-blur-sm border-gray-200 shadow-sm rounded-xl overflow-hidden !left-6 !bottom-6 !m-0" />
        <MiniMap 
            zoomable 
            pannable 
            className="!bg-white/80 !backdrop-blur-sm !border-gray-200 !shadow-sm !rounded-xl !overflow-hidden !right-6 !bottom-6 !m-0"
            maskColor="rgba(249, 250, 251, 0.6)"
            nodeColor={(n) => {
                if (n.type === 'inputNode') return '#3b82f6';
                if (n.data?.role === 'user') return '#93c5fd';
                return '#e5e7eb';
            }}
        />
      </ReactFlow>
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
