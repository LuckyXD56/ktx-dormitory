import { ShieldCheck } from "lucide-react";

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-foreground">
          DormPro
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          Workspace
        </span>
      </div>
    </div>
  );
}
