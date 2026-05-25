import type { ReactNode } from "react";

type ProductChromeProps = {
  children: ReactNode;
};

export function ProductChrome({ children }: ProductChromeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
