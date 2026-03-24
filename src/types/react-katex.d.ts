declare module 'react-katex' {
  import * as React from 'react';
  
  interface InlineMathProps {
    math: string;
  }
  
  interface BlockMathProps {
    math: string;
  }
  
  export const InlineMath: React.FC<InlineMathProps>;
  export const BlockMath: React.FC<BlockMathProps>;
}
