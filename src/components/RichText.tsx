import React from "react";

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("/")
  );
}

const INLINE_PATTERN = new RegExp(
  [
    // 1. Escaped special characters
    "\\\\([*_~`\\\\[\\]<>])",
    // 2. <br> / <br/>
    "(<br\\s*\\/?>)",
    // 3. <strong> / <b> (group 3 = tag, group 4 = content)
    "<(strong|b)>([\\s\\S]*?)<\\/\\3>",
    // 4. <em> / <i> (group 5 = tag, group 6 = content)
    "<(em|i)>([\\s\\S]*?)<\\/\\5>",
    // 5. <u>
    "<u>([\\s\\S]*?)<\\/u>",
    // 6. <a href="...">text</a>
    "<a\\s+href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)<\\/a>",
    // 7. Markdown link [text](url)
    "\\[([^\\]]+)\\]\\(([^)\\s]+)\\)",
    // 8. ***bold italic***
    "\\*\\*\\*([^\\s*](?:[^*]*[^\\s*])?)\\*\\*\\*",
    // 9. **bold**
    "\\*\\*([^\\s*](?:[^*]*[^\\s*])?)\\*\\*",
    // 10. *italic*
    "\\*([^\\s*](?:[^*]*[^\\s*])?)\\*",
    // 11. _italic_ (not inside alphanumeric words)
    "(?<![A-Za-z0-9])_([^\\s_](?:[^_]*[^\\s_])?)_(?![A-Za-z0-9])",
  ].join("|"),
  "gi"
);

function renderLink(
  href: string,
  children: React.ReactNode,
  key: string
): React.ReactNode {
  const trimmed = href.trim();
  if (!isSafeUrl(trimmed)) {
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }
  const isExternal =
    trimmed.startsWith("https://") || trimmed.startsWith("http://");
  return (
    <a
      key={key}
      href={trimmed}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="text-accent hover:text-accent-light underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  );
}

function renderInline(text: string, keyPrefix = "in"): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = new RegExp(INLINE_PATTERN.source, INLINE_PATTERN.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${tokenIdx++}`;
    const [
      ,
      escapedChar,
      brTag,
      ,
      htmlBold,
      ,
      htmlItalic,
      htmlUnderline,
      htmlLinkHref,
      htmlLinkText,
      mdLinkText,
      mdLinkHref,
      mdBoldItalic,
      mdBold,
      mdItalicStar,
      mdItalicUnderscore,
    ] = match;

    if (escapedChar !== undefined) {
      nodes.push(escapedChar);
    } else if (brTag !== undefined) {
      nodes.push(<br key={key} />);
    } else if (htmlBold !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(htmlBold, key)}
        </strong>
      );
    } else if (htmlItalic !== undefined) {
      nodes.push(<em key={key}>{renderInline(htmlItalic, key)}</em>);
    } else if (htmlUnderline !== undefined) {
      nodes.push(<u key={key}>{renderInline(htmlUnderline, key)}</u>);
    } else if (htmlLinkHref !== undefined && htmlLinkText !== undefined) {
      nodes.push(renderLink(htmlLinkHref, renderInline(htmlLinkText, key), key));
    } else if (mdLinkText !== undefined && mdLinkHref !== undefined) {
      nodes.push(renderLink(mdLinkHref, renderInline(mdLinkText, key), key));
    } else if (mdBoldItalic !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          <em>{renderInline(mdBoldItalic, key)}</em>
        </strong>
      );
    } else if (mdBold !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(mdBold, key)}
        </strong>
      );
    } else if (mdItalicStar !== undefined) {
      nodes.push(<em key={key}>{renderInline(mdItalicStar, key)}</em>);
    } else if (mdItalicUnderscore !== undefined) {
      nodes.push(<em key={key}>{renderInline(mdItalicUnderscore, key)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderLines(lines: string[], keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) {
      result.push(<br key={`${keyPrefix}-br-${idx}`} />);
    }
    result.push(
      <React.Fragment key={`${keyPrefix}-ln-${idx}`}>
        {renderInline(line, `${keyPrefix}-ln-${idx}`)}
      </React.Fragment>
    );
  });
  return result;
}

interface RichTextProps {
  content: string;
  className?: string;
}

export function RichText({ content, className }: RichTextProps) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const blocks = normalized.split(/\n{2,}/).filter((b) => b.trim().length > 0);

  return (
    <div className={className}>
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        const key = `blk-${idx}`;

        // Horizontal rule
        if (/^([-*_])\1{2,}$/.test(trimmed)) {
          return <hr key={key} className="border-surface-border my-6" />;
        }

        const lines = trimmed.split("\n");

        // Single-line heading (# / ## / ###)
        if (lines.length === 1) {
          const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const headingText = headingMatch[2];
            if (level === 1) {
              return (
                <h2
                  key={key}
                  className="text-xl sm:text-2xl font-light text-foreground tracking-tight pt-2"
                >
                  {renderInline(headingText, key)}
                </h2>
              );
            }
            if (level === 2) {
              return (
                <h2
                  key={key}
                  className="text-lg sm:text-xl font-light text-foreground tracking-tight pt-2"
                >
                  {renderInline(headingText, key)}
                </h2>
              );
            }
            return (
              <h3
                key={key}
                className="text-base sm:text-lg font-medium text-foreground pt-2"
              >
                {renderInline(headingText, key)}
              </h3>
            );
          }
        }

        // Blockquote (all lines start with >)
        if (lines.every((l) => /^>\s?/.test(l))) {
          const stripped = lines.map((l) => l.replace(/^>\s?/, ""));
          return (
            <blockquote
              key={key}
              className="border-l-2 border-accent/60 pl-4 text-foreground/75 space-y-1"
            >
              <p>{renderLines(stripped, key)}</p>
            </blockquote>
          );
        }

        // Unordered list (all lines start with - or *)
        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={key} className="list-disc pl-5 space-y-1.5">
              {lines.map((l, i) => (
                <li key={`${key}-li-${i}`}>
                  {renderInline(l.replace(/^[-*]\s+/, ""), `${key}-li-${i}`)}
                </li>
              ))}
            </ul>
          );
        }

        // Standard paragraph (preserving single line breaks)
        return <p key={key}>{renderLines(lines, key)}</p>;
      })}
    </div>
  );
}
