/**
 * Split Container
 *
 * Renders a split with two child panes and a draggable divider between them.
 */

import type { ReactNode } from 'react';

import type { SplitDirection } from '../../../shared/types/splits';
import { useSplitContext } from '../../contexts/SplitContext';

import SplitDivider from './SplitDivider';

interface SplitContainerProps {
  direction: SplitDirection;
  ratio: number;
  branchId: string;
  first: ReactNode;
  second: ReactNode;
}

export default function SplitContainer({
  direction,
  ratio,
  branchId,
  first,
  second
}: SplitContainerProps) {
  const { updateRatio } = useSplitContext();
  const isVertical = direction === 'vertical';
  const firstSize = `${ratio * 100}%`;
  const secondSize = `${(1 - ratio) * 100}%`;

  const handleResize = (newRatio: number) => {
    updateRatio(branchId, newRatio);
  };

  return (
    <div className={`flex h-full w-full ${isVertical ? 'flex-row' : 'flex-col'}`}>
      {/* First pane */}
      <div
        style={{
          [isVertical ? 'width' : 'height']: firstSize,
          flexShrink: 0
        }}
      >
        {first}
      </div>

      {/* Draggable divider */}
      <SplitDivider direction={direction} onResize={handleResize} />

      {/* Second pane */}
      <div
        style={{
          [isVertical ? 'width' : 'height']: secondSize,
          flexShrink: 0
        }}
      >
        {second}
      </div>
    </div>
  );
}
