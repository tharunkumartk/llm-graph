import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizeControl } from '@xyflow/react';
import { ChatNodeData } from '@/types/chat';
import { cn } from '@/app/lib/utils';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css'; // Light theme for code blocks

// Preprocess content to convert Unicode formatting to markdown
const preprocessMarkdown = (content: string): string => {
  if (!content) return content;
  
  let processed = content;
  
  // Convert Unicode bullets to markdown bullets
  // Handle bullet points: •, ◦, ▪, ▫, ‣
  processed = processed.replace(/^[\s]*[•◦▪▫‣]\s+/gm, '- ');
  processed = processed.replace(/\n[\s]*[•◦▪▫‣]\s+/g, '\n- ');
  
  // Handle bold text with **text** if not already in markdown format
  // This regex looks for text surrounded by asterisks but not double asterisks
  processed = processed.replace(/\*([^\*\n]+)\*/g, (match, p1) => {
    // Check if it's already formatted as **text**
    if (match.startsWith('**') || match.endsWith('**')) return match;
    return `**${p1}**`;
  });
  
  // Ensure proper spacing after colons for lists
  processed = processed.replace(/:\s*\n\s*-/g, ':\n\n-');
  
  return processed;
};

const MessageNode = ({ data, isConnectable, selected }: NodeProps) => {
  const isUser = (data as ChatNodeData).role === 'user';
  
  // Preprocess the content once
  const processedContent = useMemo(() => 
    preprocessMarkdown((data as ChatNodeData).content || "..."),
    [data]
  );

  return (
    <div
      className={cn(
        "shadow-md rounded-xl border bg-white min-w-[300px] text-left relative group transition-all duration-200",
        isUser ? "border-blue-200" : "border-gray-200",
        // Add subtle outline/border highlight when selected or hovered (for assistant nodes)
        !isUser && (selected || "group-hover:border-gray-300 group-hover:shadow-lg") && "border-gray-400 shadow-lg ring-1 ring-gray-400"
      )}
    >
      {/* Resize controls for assistant nodes */}
      {!isUser && (
        <>
          {/* Right Handle */}
          <NodeResizeControl
            minWidth={300}
            maxWidth={1200}
            position="right"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              height: '100%',
              width: '24px', // Wider hit area
              transform: 'translate(50%, 0)', // Center on edge
              border: 'none',
              background: 'transparent',
              zIndex: 50,
            }}
          />

          {/* Left Handle */}
          <NodeResizeControl
            minWidth={300}
            maxWidth={1200}
            position="left"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              height: '100%',
              width: '24px', // Wider hit area
              transform: 'translate(-50%, 0)', // Center on edge
              border: 'none',
              background: 'transparent',
              zIndex: 50,
            }}
          />
        </>
      )}

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-16 h-16 bg-blue-500 border-2 border-white shadow-md hover:bg-blue-600 hover:scale-[1.125] transition-all duration-200"
      />
      
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 border-b rounded-t-xl text-sm font-medium",
        isUser ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-700 border-gray-100"
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
        {isUser ? "You" : "Assistant"}
      </div>

      <div className="p-4 text-sm text-gray-800 leading-relaxed overflow-y-auto">
        {/* We use a specific class to style the markdown content (prose-like) */}
        <div className="markdown-body break-words">
            <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeHighlight]}
            components={{
                p: ({children}) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-gray-600">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-gray-600">{children}</ol>,
                li: ({children}) => <li className="mb-1 leading-relaxed">{children}</li>,
                h1: ({children}) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
                h2: ({children}) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                h3: ({children}) => <h3 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h3>,
                code: ({node, className, children, ...props}: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match && !String(children).includes('\n');
                  return isInline ? (
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-pink-600 font-mono text-xs" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({children}) => (
                    <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto border border-gray-200 mb-3 text-xs">
                        {children}
                    </pre>
                ),
                blockquote: ({children}) => (
                    <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 mb-3">
                        {children}
                    </blockquote>
                ),
                strong: ({children}) => <strong className="font-bold text-gray-900">{children}</strong>,
                em: ({children}) => <em className="italic">{children}</em>,
            }}
            >
            {processedContent}
            </ReactMarkdown>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-16 h-16 bg-green-500 border-2 border-white shadow-md hover:bg-green-600 hover:scale-[1.125] transition-all duration-200"
      />
    </div>
  );
};

export default memo(MessageNode);
