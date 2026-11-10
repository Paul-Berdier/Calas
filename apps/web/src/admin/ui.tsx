import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, LoaderCircle, ArrowRight, FileText } from "lucide-react";

// Local shadcn/ui-style primitives, composed from Radix and our Calas design tokens.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva(
  "admin-button inline-flex items-center justify-center gap-2 transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "",
        secondary: "admin-button-secondary",
        ghost: "admin-button-ghost",
        danger: "admin-button-danger",
      },
      size: {
        default: "",
        sm: "admin-button-small",
        icon: "admin-button-icon",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);
export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}
export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type={asChild ? undefined : "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="admin-spin" aria-hidden />}
      {children}
    </Component>
  );
}
export function Field({
  label,
  hint,
  children,
  className,
  required,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  className?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("admin-field", className)}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      {children(id)}
      {hint && (
        <p className="admin-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
export function Badge({
  status,
  children,
}: {
  status?: string;
  children?: ReactNode;
}) {
  const labels: Record<string, string> = {
    published: "Publié",
    draft: "Brouillon",
    archived: "Archivé",
    modified: "Modifications en brouillon",
    review: "À relire",
  };
  return (
    <span className="admin-badge" data-status={status}>
      {children ?? labels[status ?? ""] ?? status}
    </span>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-overlay" />
        <Dialog.Content
          className={cn("admin-modal", wide && "admin-modal-wide")}
          aria-describedby={description ? undefined : ""}
        >
          <div className="admin-modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description>{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer la fenêtre"
              >
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  onConfirm,
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="admin-overlay" />
        <AlertDialog.Content className="admin-modal admin-confirm">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="admin-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={busy}>
                Annuler
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? "danger" : "primary"}
              onClick={onConfirm}
              loading={busy}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <span className="admin-empty-icon">
        <FileText size={28} strokeWidth={1.4} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="admin-loading" role="status">
      <LoaderCircle size={22} className="admin-spin" />
      {label}
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-section-heading">
      <div>
        {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-actions">{actions}</div>}
    </header>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="admin-text-link" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
