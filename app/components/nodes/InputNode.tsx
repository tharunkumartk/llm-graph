import React, { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { ChatNodeData } from "@/types/chat";
import { cn } from "@/app/lib/utils";
import { Send } from "lucide-react";

type ResponseMode = "concise" | "regular" | "explanatory";

const MODE_PREFIXES = {
  concise: "Be concise and brief in your response. ",
  regular: "",
  explanatory: "Please provide a detailed and explanatory response. ",
};

const MODE_LABELS = {
  concise: "Concise",
  regular: "Regular",
  explanatory: "Explanatory",
};

const InputNode = ({ data }: NodeProps) => {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ResponseMode>("regular");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus the textarea when the component mounts
    // Use a small timeout to ensure the element is ready and animations have settled
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const cycleMode = (direction: "next" | "prev") => {
    const modes: ResponseMode[] = ["concise", "regular", "explanatory"];
    const currentIndex = modes.indexOf(mode);

    if (direction === "next") {
      const nextIndex = (currentIndex + 1) % modes.length;
      setMode(modes[nextIndex]);
    } else {
      const prevIndex =
        currentIndex === 0 ? modes.length - 1 : currentIndex - 1;
      setMode(modes[prevIndex]);
    }
  };

  const handleSend = () => {
    const nodeData = data as ChatNodeData;
    if (text.trim() && nodeData.onSend) {
      const modifiedText = MODE_PREFIXES[mode] + text;
      nodeData.onSend(modifiedText);
      setText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd+] (next mode) or Cmd+[ (prev mode)
    if ((e.metaKey || e.ctrlKey) && e.key === "]") {
      e.preventDefault();
      cycleMode("next");
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "[") {
      e.preventDefault();
      cycleMode("prev");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === "Escape") {
      const nodeData = data as ChatNodeData;
      if (text.trim() === "" && nodeData.onCancel) {
        nodeData.onCancel();
      }
    }
  };

  return (
    <div className="shadow-lg rounded-xl border border-blue-300 bg-white dark:bg-zinc-900 dark:border-blue-700 min-w-[400px] max-w-[600px]">
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        isConnectable={false}
        className="w-16 h-16 bg-blue-500 border-2 border-white dark:border-zinc-800 shadow-md opacity-50 hover:scale-[1.125] transition-all duration-200"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left"
        isConnectable={false}
        className="w-12 h-12 bg-blue-500 border-2 border-white dark:border-zinc-800 shadow-md opacity-50 hover:scale-[1.125] transition-all duration-200"
        style={{ top: "50%" }}
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right"
        isConnectable={false}
        className="w-12 h-12 bg-blue-500 border-2 border-white dark:border-zinc-800 shadow-md opacity-50 hover:scale-[1.125] transition-all duration-200"
        style={{ top: "50%" }}
      />

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            New Prompt
          </label>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wide transition-colors",
                mode === "concise" &&
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                mode === "regular" &&
                  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                mode === "explanatory" &&
                  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
              )}
              title="Use Cmd+[ or Cmd+] to change mode"
            >
              {MODE_LABELS[mode]}
            </span>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className={cn(
            "w-full p-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder-gray-400 nodrag cursor-text"
          )}
          placeholder="Type your message here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="flex justify-between items-center gap-2 mt-2">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Cmd+[ / Cmd+] to cycle mode
          </span>
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            Ask
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(InputNode);
