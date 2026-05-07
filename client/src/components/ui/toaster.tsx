import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useLocation } from "wouter"

export function Toaster() {
  const { toasts } = useToast()
  const [, navigate] = useLocation()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Toasts may carry a `navigateTo` prop (string hash route) so clicking
        // the toast surface brings the user to the generated content. Set
        // by callers via toast({ ..., navigateTo: "/war-room?dealId=abc" }).
        const navigateTo: string | undefined = (props as any).navigateTo
        const cleanProps = { ...(props as any) }
        delete cleanProps.navigateTo
        const clickable = Boolean(navigateTo)
        return (
          <Toast
            key={id}
            {...cleanProps}
            style={{
              ...(cleanProps.style || {}),
              cursor: clickable ? "pointer" : undefined,
            }}
            onClick={(e) => {
              if (!clickable) return
              // Don't navigate if user clicked the X close button
              const target = e.target as HTMLElement
              if (target.closest("[toast-close]")) return
              navigate(navigateTo!)
            }}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>
                  {description}
                  {clickable && (
                    <span className="ml-2 opacity-60 text-[10px] uppercase tracking-wider">→ view</span>
                  )}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
