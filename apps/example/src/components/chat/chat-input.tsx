"use client";

import type { ChatStatus } from "ai";
import { useChatId } from "ai-sdk-tools/client";
import { GlobeIcon } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import {
  type CommandMetadata,
  type CommandSelection,
  PromptCommands,
  PromptCommandsTextarea,
  useCommandActions,
} from "@/components/ai-elements/prompt-commands";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { useChatInterface } from "@/hooks/use-chat-interface";

export interface ChatInputMessage extends PromptInputMessage {
  agentChoice?: string;
  toolChoice?: string;
}

interface ChatInputProps {
  text: string;
  setText: (text: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  useWebSearch: boolean;
  setUseWebSearch: (value: boolean) => void;
  onSubmit: (message: ChatInputMessage) => void;
  status?: ChatStatus;
  hasMessages: boolean;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: string;
    code?: string;
  } | null;
}

function ChatInputInner({
  text,
  setText,
  textareaRef,
  useWebSearch,
  setUseWebSearch,
  onSubmit,
  status,
  hasMessages,
  rateLimit,
  selection,
}: ChatInputProps & {
  selection: CommandSelection;
}) {
  const { clearPills } = useCommandActions();
  const { setChatId } = useChatInterface();
  const chatId = useChatId();

  const handleSubmit = (message: PromptInputMessage) => {
    if (chatId) {
      setChatId(chatId);
    }

    // Merge message with command selection
    onSubmit({
      ...message,
      agentChoice: selection.agentChoice,
      toolChoice: selection.toolChoice,
    });

    // Clear pills after submit
    clearPills();
  };

  return (
    <PromptInput
      globalDrop
      multiple
      onSubmit={handleSubmit}
      className="bg-white/80 dark:bg-black/80 backdrop-blur-xl"
    >
      <PromptInputBody>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
        <PromptCommandsTextarea
          onChange={(event) => setText(event.target.value)}
          ref={textareaRef}
          value={text}
          placeholder={
            rateLimit?.code === "RATE_LIMIT_EXCEEDED"
              ? "Rate limit exceeded. Please try again tomorrow."
              : hasMessages
                ? undefined
                : "Ask me anything"
          }
          disabled={rateLimit?.code === "RATE_LIMIT_EXCEEDED"}
          autoFocus
        />
      </PromptInputBody>

      <PromptInputToolbar>
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputSpeechButton
            onTranscriptionChange={setText}
            textareaRef={textareaRef}
          />
          <PromptInputButton
            onClick={() => setUseWebSearch(!useWebSearch)}
            variant={useWebSearch ? "default" : "ghost"}
          >
            <GlobeIcon size={16} />
            <span>Search</span>
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit
          disabled={
            (!text.trim() && !status) ||
            status === "streaming" ||
            rateLimit?.code === "RATE_LIMIT_EXCEEDED"
          }
          status={status}
        />
      </PromptInputToolbar>
    </PromptInput>
  );
}

export function ChatInput({
  text,
  setText,
  textareaRef,
  useWebSearch,
  setUseWebSearch,
  onSubmit,
  status,
  hasMessages,
  rateLimit,
}: ChatInputProps) {
  const [metadata, setMetadata] = useState<CommandMetadata>({
    agents: [],
    tools: [],
  });
  const [selection, setSelection] = useState<CommandSelection>({});

  // Fetch metadata on mount
  useEffect(() => {
    fetch("/api/metadata")
      .then((res) => res.json())
      .then((data) => setMetadata(data))
      .catch((err) => console.error("Failed to fetch metadata:", err));
  }, []);

  return (
    <div>
      <PromptCommands metadata={metadata} onSelectionChange={setSelection}>
        <ChatInputInner
          text={text}
          setText={setText}
          textareaRef={textareaRef}
          useWebSearch={useWebSearch}
          setUseWebSearch={setUseWebSearch}
          onSubmit={onSubmit}
          status={status}
          hasMessages={hasMessages}
          rateLimit={rateLimit}
          selection={selection}
        />
      </PromptCommands>

      <div className="h-5">
        {rateLimit && rateLimit.remaining < 5 && (
          <div
            className={`py-2 text-[11px] border-t border-border/50 ${
              rateLimit.code === "RATE_LIMIT_EXCEEDED"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }`}
          >
            <div className="flex w-full">
              <span>
                {rateLimit.code === "RATE_LIMIT_EXCEEDED"
                  ? "Rate limit exceeded - try again tomorrow"
                  : `Messages remaining: ${rateLimit.remaining} / ${rateLimit.limit}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
