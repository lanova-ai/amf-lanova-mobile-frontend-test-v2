import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-farm-accent/20 bg-farm-card px-3 py-2 text-base text-farm-text ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-farm-text placeholder:text-farm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
