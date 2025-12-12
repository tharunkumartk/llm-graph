import { Node } from "@xyflow/react";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// Custom data structure for our React Flow nodes - this should be a plain object
export interface ChatNodeData extends Record<string, unknown> {
  label?: string;
  content: string;
  role: MessageRole;
  timestamp: number;
  isInput?: boolean; // If true, this is a temporary input node
  onSend?: (content: string) => void;
  onCancel?: () => void;
}

// We extend the base Node type from React Flow
export type ChatNode = Node<ChatNodeData>;
