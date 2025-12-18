import { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

type CodeBlockVariant = 'default' | 'error' | 'warning' | 'success';

interface CodeBlockProps {
  children: string;
  language?: string;
  variant?: CodeBlockVariant;
  className?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
}

// Map file extensions to language identifiers
const extensionToLanguage: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  mjs: 'javascript',
  cjs: 'javascript',
  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  // Data
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  toml: 'toml',
  // Config
  md: 'markdown',
  mdx: 'mdx',
  ini: 'ini',
  env: 'bash',
  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  bat: 'batch',
  cmd: 'batch',
  // Programming
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  r: 'r',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  // Other
  dockerfile: 'docker',
  makefile: 'makefile',
  gitignore: 'bash'
};

// Try to detect language from file path
export function detectLanguageFromPath(filePath?: string): string {
  if (!filePath) return 'text';

  const fileName = filePath.split('/').pop()?.toLowerCase() || '';

  // Check for exact file matches
  if (fileName === 'dockerfile') return 'docker';
  if (fileName === 'makefile') return 'makefile';
  if (fileName.startsWith('.')) {
    // Dotfiles like .gitignore, .env, etc.
    const dotFile = fileName.slice(1);
    if (extensionToLanguage[dotFile]) return extensionToLanguage[dotFile];
    return 'bash';
  }

  // Check extension
  const ext = fileName.split('.').pop();
  if (ext && extensionToLanguage[ext]) {
    return extensionToLanguage[ext];
  }

  return 'text';
}

// Detect language from content heuristics
export function detectLanguageFromContent(content: string): string {
  const trimmed = content.trim();

  // Shell commands (starts with $ or common shell patterns)
  if (
    trimmed.startsWith('$') ||
    /^(npm|yarn|bun|pnpm|git|cd|ls|cat|echo|export|source)\s/.test(trimmed)
  ) {
    return 'bash';
  }

  // JSON (starts with { or [)
  if (/^[{[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  // HTML/XML
  if (/^<[!?]?(html|xml|!DOCTYPE)/i.test(trimmed)) {
    return 'html';
  }

  // JavaScript/TypeScript patterns
  if (/^(import|export|const|let|var|function|class|interface|type)\s/.test(trimmed)) {
    if (/:\s*(string|number|boolean|any|void|Promise|React)/.test(trimmed)) {
      return 'typescript';
    }
    return 'javascript';
  }

  // Python
  if (/^(import|from|def|class|if __name__|async def)\s/.test(trimmed)) {
    return 'python';
  }

  // YAML (key: value patterns, but not shell)
  if (/^\w+:\s*(\n|$)/.test(trimmed) && !trimmed.includes('$')) {
    return 'yaml';
  }

  return 'text';
}

// Hook to detect system dark mode
function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        window.matchMedia('(prefers-color-scheme: dark)').matches ||
        document.documentElement.classList.contains('dark')
      );
    }
    return false;
  });

  useEffect(() => {
    // Watch for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    // Also watch for class changes on html element (Tailwind dark mode)
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);

  return isDark;
}

// Variant-specific styling
const variantStyles: Record<CodeBlockVariant, { light: string; dark: string }> = {
  default: {
    light: 'bg-neutral-100/50 border-neutral-200/50',
    dark: 'bg-neutral-950/50 border-neutral-800/50'
  },
  error: {
    light: 'bg-red-100/50 border-red-200/50',
    dark: 'bg-red-950/50 border-red-800/50'
  },
  warning: {
    light: 'bg-amber-100/50 border-amber-200/50',
    dark: 'bg-amber-950/50 border-amber-800/50'
  },
  success: {
    light: 'bg-green-100/50 border-green-200/50',
    dark: 'bg-green-950/50 border-green-800/50'
  }
};

export default function CodeBlock({
  children,
  language,
  variant = 'default',
  className = '',
  maxHeight,
  showLineNumbers = false
}: CodeBlockProps) {
  const isDark = useDarkMode();

  // Auto-detect language if not provided
  const detectedLanguage = language || detectLanguageFromContent(children);

  const variantStyle = isDark ? variantStyles[variant].dark : variantStyles[variant].light;

  // Custom style overrides to blend with our design
  const customStyle: React.CSSProperties = {
    margin: 0,
    padding: '0.5rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    background: 'transparent',
    ...(maxHeight ? { maxHeight, overflowY: 'auto' as const } : {})
  };

  return (
    <div className={`overflow-x-auto rounded border ${variantStyle} ${className}`}>
      <SyntaxHighlighter
        language={detectedLanguage}
        style={isDark ? oneDark : oneLight}
        customStyle={customStyle}
        showLineNumbers={showLineNumbers}
        wrapLongLines
        PreTag="div"
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// Simpler inline code component for short snippets
export function InlineCodeHighlight({ children }: { children: string }) {
  return (
    <code className="rounded border border-neutral-200/50 bg-neutral-50/50 px-1.5 py-0.5 font-mono text-sm text-neutral-800 dark:border-neutral-700/50 dark:bg-neutral-900/50 dark:text-neutral-200">
      {children}
    </code>
  );
}
