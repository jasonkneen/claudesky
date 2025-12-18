import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import CodeBlock from './CodeBlock';

// Custom link component that opens external links in the system browser
const ExternalLink: Components['a'] = ({ href, children, ...props }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (href) {
      window.electron.shell.openExternal(href).catch((error) => {
        console.error('Failed to open external link:', error);
      });
    }
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
};

// Custom code component with syntax highlighting
const Code: Components['code'] = ({ className, children, ...props }) => {
  // Check if it's a code block (has language-xxx class) or inline code
  const match = /language-(\w+)/.exec(className || '');
  const isCodeBlock = match || (typeof children === 'string' && children.includes('\n'));

  if (isCodeBlock) {
    const language = match ? match[1] : undefined;
    const content = String(children).replace(/\n$/, '');

    return <CodeBlock language={language}>{content}</CodeBlock>;
  }

  // Inline code - keep simple styling
  return (
    <code
      className="rounded border border-neutral-200/50 bg-neutral-100/50 px-1.5 py-0.5 font-mono text-sm text-neutral-800 dark:border-neutral-700/50 dark:bg-neutral-900/50 dark:text-neutral-200"
      {...props}
    >
      {children}
    </code>
  );
};

// Custom pre component to avoid double wrapping
const Pre: Components['pre'] = ({ children }) => {
  // CodeBlock already handles the wrapper, so just pass through
  return <>{children}</>;
};

// Custom components for ReactMarkdown
const markdownComponents: Components = {
  a: ExternalLink,
  code: Code,
  pre: Pre
};

interface MarkdownProps {
  children: string;
}

export default function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}
