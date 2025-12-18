import type { Mention } from '../utils/mentionUtils';
import MentionChip from './MentionChip';

interface MentionChipsProps {
  mentions: Mention[];
  onRemove: (id: string) => void;
}

export default function MentionChips({ mentions, onRemove }: MentionChipsProps) {
  if (mentions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-1.5">
      {mentions.map((mention) => (
        <MentionChip key={mention.id} label={mention.label} onRemove={() => onRemove(mention.id)} />
      ))}
    </div>
  );
}
