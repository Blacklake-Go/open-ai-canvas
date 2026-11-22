"use client";

import { forwardRef, useRef } from "react";
import { PromptTextarea } from "./PromptComposer.jsx";
import { PromptMentionMenu } from "./PromptAttachments.jsx";

/** Shared text input for generation composers. The owner supplies model and submit behavior. */
export const PromptInputField = forwardRef(function PromptInputField(
  {
    value,
    onChange,
    placeholder,
    mention,
    mentionTitle,
    onEnter,
    onKeyDown,
    onKeyUp,
    onClick,
    onBlur,
    onCompositionStart,
    onCompositionEnd,
    className = "relative",
    ...textareaProps
  },
  ref,
) {
  const isComposingRef = useRef(false);

  const handleCompositionStart = (event) => {
    isComposingRef.current = true;
    onCompositionStart?.(event);
  };

  const handleCompositionEnd = (event) => {
    isComposingRef.current = false;
    onCompositionEnd?.(event);
  };

  const handleKeyDown = (event) => {
    mention?.onKeyDown?.(event);
    onKeyDown?.(event);
    if (
      onEnter &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !isComposingRef.current &&
      event.keyCode !== 229 &&
      !event.nativeEvent?.isComposing &&
      !mention?.open &&
      !event.defaultPrevented
    ) {
      event.preventDefault();
      onEnter();
    }
  };

  const handleKeyUp = (event) => {
    mention?.refresh?.(event);
    onKeyUp?.(event);
  };

  const handleClick = (event) => {
    mention?.refresh?.(event);
    onClick?.(event);
  };

  const handleBlur = (event) => {
    mention?.close?.(event);
    onBlur?.(event);
  };

  return (
    <div className={className}>
      <PromptTextarea
        {...textareaProps}
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleClick}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        aria-label={textareaProps["aria-label"] || placeholder}
        placeholder={placeholder}
      />
      {mention && (
        <PromptMentionMenu
          open={mention.open}
          candidates={mention.candidates}
          activeIndex={mention.activeIndex}
          onHover={mention.setActiveIndex}
          onSelect={(item) => mention.apply(item)}
          labels={{ title: mentionTitle }}
        />
      )}
    </div>
  );
});
