"use client";

import { useState, useMemo, useId, useRef, useEffect } from "react";
import { Tag, History, Search, X } from "lucide-react";

export const RECENT_TAGS_STORAGE_KEY = "lumenist_recent_tags";

export function loadRecentTagsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TAGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string" && !!t.trim())
      : [];
  } catch {
    return [];
  }
}

export function saveRecentTagsToStorage(
  tagsInput: string,
  previousRecent: string[] = []
): string[] {
  const submittedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (submittedTags.length === 0) return previousRecent;

  const merged = Array.from(new Set([...submittedTags, ...previousRecent])).slice(
    0,
    24
  );
  try {
    localStorage.setItem(RECENT_TAGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

interface TagInputWithTrayProps {
  value: string;
  onChange: (nextValue: string) => void;
  allTags: string[];
  popularTags: { tag: string; count: number }[];
  recentTags: string[];
  inputId?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  inputClassName?: string;
  placeholder?: string;
  needsAttention?: boolean;
  headerVariant?: "upload-step" | "compact";
  label?: string;
}

export function TagInputWithTray({
  value,
  onChange,
  allTags,
  popularTags,
  recentTags,
  inputId,
  inputRef,
  inputClassName,
  placeholder = "Type or paste comma-separated tags (e.g. Washington, Fall color, sunset, river, trees)...",
  needsAttention = false,
  headerVariant = "compact",
  label = "Tags / Keywords (comma-separated)",
}: TagInputWithTrayProps) {
  const autoId = useId();
  const resolvedInputId = inputId || `tags-input-${autoId}`;
  const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    internalTextareaRef.current = el;
    if (inputRef) {
      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
        el;
    }
  };

  // Auto-expand textarea height to fit current tags while still allowing manual vertical resize
  useEffect(() => {
    const el = internalTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 60)}px`;
  }, [value]);

  const [showTagTray, setShowTagTray] = useState(false);
  const [tagTraySearch, setTagTraySearch] = useState("");
  const [tagTrayView, setTagTrayView] = useState<"all" | "popular">("all");

  const selectedTagSet = useMemo(
    () =>
      new Set(
        value
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      ),
    [value]
  );

  const filteredTrayTags = useMemo(() => {
    const q = tagTraySearch.trim().toLowerCase();
    if (q) {
      return allTags.filter((tag) => tag.toLowerCase().includes(q));
    }
    if (tagTrayView === "popular") {
      return popularTags.map(({ tag }) => tag);
    }
    return allTags;
  }, [allTags, popularTags, tagTraySearch, tagTrayView]);

  const handleTagChipClick = (tag: string) => {
    const currentTags = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const exists = currentTags.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );

    if (exists) {
      const next = currentTags.filter(
        (t) => t.toLowerCase() !== tag.toLowerCase()
      );
      onChange(next.join(", "));
    } else {
      const next = [...currentTags, tag];
      onChange(next.join(", "));
    }
  };

  const toggleButton = (
    <button
      type="button"
      onClick={() => setShowTagTray(!showTagTray)}
      aria-expanded={showTagTray}
      className="text-xs text-accent hover:underline flex items-center space-x-1 cursor-pointer"
    >
      <span>{showTagTray ? "Hide Tag Tray" : "+ Quick-Add Tags"}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      {headerVariant === "upload-step" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-foreground uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5 text-accent" />
            <label htmlFor={resolvedInputId}>{label}</label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {toggleButton}
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border border-surface-border text-muted">
              Optional
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={resolvedInputId}
            className="flex items-center space-x-1.5 text-xs font-medium text-foreground"
          >
            <Tag className="w-3.5 h-3.5 text-accent" />
            <span>{label}</span>
          </label>
          {toggleButton}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          ref={setTextareaRef}
          id={resolvedInputId}
          name="tags"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-needs-attention={needsAttention || undefined}
          className={`${
            inputClassName ||
            "w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
          } resize-y min-h-[60px] leading-relaxed`}
        />

        <p className="text-[11px] text-muted">
          Paste comma-separated tags freely, or open{" "}
          <button
            type="button"
            onClick={() => setShowTagTray(!showTagTray)}
            className="text-accent hover:underline cursor-pointer"
          >
            Quick-Add Tags
          </button>{" "}
          to pick from all {allTags.length} library keywords.
        </p>
      </div>

      {/* Quick-Add Tag Tray */}
      {showTagTray && (
        <div className="border-t border-surface-border pt-3 mt-2 space-y-3">
          {/* Recently Used Tags */}
          {recentTags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted uppercase tracking-wider font-semibold flex items-center space-x-1">
                <History className="w-3 h-3 text-accent" />
                <span>Recently Used Across Photos</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentTags.map((tag) => {
                  const isIncluded = selectedTagSet.has(tag.toLowerCase());
                  return (
                    <button
                      type="button"
                      key={tag}
                      aria-pressed={isIncluded}
                      onClick={() => handleTagChipClick(tag)}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        isIncluded
                          ? "bg-accent text-accent-contrast font-semibold border-accent shadow-sm"
                          : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All & Popular Library Keywords */}
          {allTags.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={tagTrayView === "all" && !tagTraySearch.trim()}
                    onClick={() => setTagTrayView("all")}
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      tagTrayView === "all" && !tagTraySearch.trim()
                        ? "bg-accent text-accent-contrast border-accent"
                        : "bg-surface border-surface-border text-muted hover:text-foreground"
                    }`}
                  >
                    All A–Z ({allTags.length})
                  </button>
                  <button
                    type="button"
                    aria-pressed={
                      tagTrayView === "popular" && !tagTraySearch.trim()
                    }
                    onClick={() => setTagTrayView("popular")}
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      tagTrayView === "popular" && !tagTraySearch.trim()
                        ? "bg-accent text-accent-contrast border-accent"
                        : "bg-surface border-surface-border text-muted hover:text-foreground"
                    }`}
                  >
                    Popular ({popularTags.length})
                  </button>
                </div>

                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="w-3 h-3 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={tagTraySearch}
                    onChange={(e) => setTagTraySearch(e.target.value)}
                    placeholder={`Filter all ${allTags.length} tags...`}
                    className="w-full bg-surface border border-surface-border rounded pl-7 pr-6 py-1 text-[11px] text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                  {tagTraySearch && (
                    <button
                      type="button"
                      onClick={() => setTagTraySearch("")}
                      aria-label="Clear tag filter"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {filteredTrayTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredTrayTags.map((tag) => {
                    const isIncluded = selectedTagSet.has(tag.toLowerCase());
                    return (
                      <button
                        type="button"
                        key={tag}
                        aria-pressed={isIncluded}
                        onClick={() => handleTagChipClick(tag)}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          isIncluded
                            ? "bg-accent text-accent-contrast font-semibold border-accent shadow-sm"
                            : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted italic">
                  No tags matching &ldquo;{tagTraySearch}&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
