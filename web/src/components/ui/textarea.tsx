import * as React from "react";
import { Textarea as Base } from "@ui-sdk/react/textarea";

import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/input";

/** Several lines of text, on ui-sdk's Textarea, with the same field look as Input. */
function Textarea({ className, ...props }: React.ComponentProps<typeof Base>) {
    return <Base className={cn(fieldClass, "min-h-16 px-3 py-2 leading-relaxed", className)} {...props} />;
}

export { Textarea };
