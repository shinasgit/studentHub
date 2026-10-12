import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style, ...props }) => {
  return (
    <div
      className={`glass-panel ${className}`.trim()}
      style={{ padding: '24px', ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
