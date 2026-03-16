import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export function DateInput({ className, wrapperClassName, ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        ref={inputRef}
        type="date"
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => {
          inputRef.current?.showPicker?.();
          inputRef.current?.focus();
        }}
        tabIndex={-1}
      >
        <Calendar className="w-4 h-4" />
      </button>
    </div>
  );
}
