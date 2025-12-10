import React from 'react';
import { X, Keyboard, GitGraph, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden m-4 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <GitGraph className="w-6 h-6 text-blue-500" />
            About LLM Graph
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <div className="space-y-8">
            {/* Description Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                What is this?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                LLM Graph is a visual chat interface that allows you to branch conversations like a tree. 
                Instead of a linear chat history, you can create multiple paths from any message to explore different ideas, 
                comparisons, or refinements without losing context.
              </p>
              <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  Drag from any node to create a new branch
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  Explore multiple conversation paths simultaneously
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  Visual history of your entire thought process
                </li>
              </ul>
            </section>

            {/* Shortcuts Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-gray-500" />
                Keyboard Shortcuts
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Navigation Group */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Navigation
                  </h4>
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 space-y-3">
                    <ShortcutItem 
                      keys={['Tab']} 
                      label="Cycle through nodes linearly" 
                    />
                    <ShortcutItem 
                      keys={[<ArrowUp size={14} key="up" />]} 
                      label="Navigate to parent" 
                    />
                    <ShortcutItem 
                      keys={[<ArrowDown size={14} key="down" />]} 
                      label="Navigate to child" 
                    />
                    <ShortcutItem 
                      keys={[<ArrowLeft size={14} key="left" />, <ArrowRight size={14} key="right" />]} 
                      label="Navigate between siblings" 
                    />
                  </div>
                </div>

                {/* Actions Group */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Input & Actions
                  </h4>
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 space-y-3">
                    <ShortcutItem 
                      keys={[<CornerDownLeft size={14} key="enter" />]} 
                      label="Send message" 
                    />
                    <ShortcutItem 
                      keys={['Shift', <CornerDownLeft size={14} key="s-enter" />]} 
                      label="New line" 
                    />
                    <ShortcutItem 
                      keys={['⌘', '[']} 
                      label="Previous response mode" 
                    />
                    <ShortcutItem 
                      keys={['⌘', ']']} 
                      label="Next response mode" 
                    />
                    <ShortcutItem 
                      keys={['Esc']} 
                      label="Cancel empty input" 
                    />
                    <ShortcutItem 
                      keys={['⌫', 'Del']} 
                      label="Delete selected node" 
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutItem({ keys, label }: { keys: (string | React.ReactNode)[], label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            <kbd className="px-2 py-1 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-md text-xs font-semibold text-gray-500 dark:text-gray-300 shadow-sm min-w-[24px] text-center flex items-center justify-center h-6">
              {k}
            </kbd>
            {i < keys.length - 1 && <span className="text-gray-400 text-xs">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

