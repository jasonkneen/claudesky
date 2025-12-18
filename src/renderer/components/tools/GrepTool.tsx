import type { GrepInput, ToolUseSimple } from '@/types/chat';

import CodeBlock from '../CodeBlock';
import { CollapsibleTool } from './CollapsibleTool';
import { InlineCode, ToolHeader } from './utils';

interface GrepToolProps {
  tool: ToolUseSimple;
}

export default function GrepTool({ tool }: GrepToolProps) {
  const input = tool.parsedInput as GrepInput;

  if (!input) {
    return (
      <div className="my-0.5">
        <ToolHeader tool={tool} toolName={tool.name} />
      </div>
    );
  }

  const collapsedContent = (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToolHeader tool={tool} toolName={tool.name} />
      <InlineCode>{input.pattern}</InlineCode>
      {input.path && (
        <span className="text-[10px] text-neutral-500 dark:text-neutral-500">in {input.path}</span>
      )}
    </div>
  );

  const expandedContent = tool.result ? <CodeBlock language="bash">{tool.result}</CodeBlock> : null;

  return <CollapsibleTool collapsedContent={collapsedContent} expandedContent={expandedContent} />;
}
