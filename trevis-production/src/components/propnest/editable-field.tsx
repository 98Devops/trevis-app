import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckIcon, PencilIcon, XIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

type FieldType = "text" | "tel" | "date" | "textarea";

export type EditableFieldProps = {
  icon?: React.ReactNode;
  label: string;
  /** Current display value (already stringified by the caller). */
  value: string | null | undefined;
  /** Persist the new value. Resolve to surface success; reject/throw to surface error. */
  onSave: (next: string) => Promise<void>;
  type?: FieldType;
  placeholder?: string;
  /** When false the row is read-only (no pencil). */
  editable?: boolean;
  /** Max length for text inputs. */
  maxLength?: number;
};

/**
 * Read-only row that flips to an inline editor on the pencil. Persists via the
 * caller's `onSave` (which wraps an engine/service call) and surfaces success /
 * failure as a toast. Keeps the drawer presentational — no engine logic here.
 */
export function EditableField({
  icon, label, value, onSave, type = "text", placeholder, editable = true, maxLength,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const display = value && value !== "—" ? value : "—";

  useEffect(() => {
    if (editing) {
      setDraft(value && value !== "—" ? value : "");
      // Focus next tick once the input is mounted.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [editing, value]);

  const cancel = () => { setEditing(false); setDraft(""); };

  const commit = async () => {
    const next = draft.trim();
    const current = (value && value !== "—" ? value : "").trim();
    if (next === current) { cancel(); return; }
    setSaving(true);
    try {
      await onSave(next);
      toast.success(`${label} updated`);
      setEditing(false);
    } catch (err) {
      toast.error(`Couldn't update ${label.toLowerCase()}`, {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon && <span className="bg-brand-gradient-soft text-brand-blue flex size-7 items-center justify-center rounded-md">{icon}</span>}
          {label}
        </div>
        <div className="flex items-start gap-2">
          {type === "textarea" ? (
            <Textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={draft}
              rows={3}
              placeholder={placeholder}
              maxLength={maxLength}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
          ) : (
            <Input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type={type === "tel" ? "tel" : type === "date" ? "date" : "text"}
              value={draft}
              placeholder={placeholder}
              maxLength={maxLength}
              max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
          )}
          <Button size="icon" variant="gradient" onClick={commit} disabled={saving} aria-label="Save">
            {saving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
          </Button>
          <Button size="icon" variant="outline" onClick={cancel} disabled={saving} aria-label="Cancel">
            <XIcon />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon && <span className="bg-brand-gradient-soft text-brand-blue flex size-7 items-center justify-center rounded-md">{icon}</span>}
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-foreground whitespace-pre-wrap text-right">{display}</span>
        {editable && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label.toLowerCase()}`}
          >
            <PencilIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
