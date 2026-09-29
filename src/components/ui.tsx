import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FlaskConical } from "lucide-react";
export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="brand"
      onClick={onClick}
      aria-label="CharacterizationCafe home"
    >
      <span className="brand-mark">
        <FlaskConical size={19} />
      </span>
      <span>
        Characterization<span className="brand-light">Cafe</span>
      </span>
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(
    children,
  )
    ? children
    : null;
  const id = control?.props.id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control
        ? cloneElement(control, {
            id,
            "aria-describedby": hint ? `${id}-hint` : undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  id,
  "aria-describedby": description,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const valid = (text: string) =>
    text.trim() !== "" &&
    Number.isFinite(Number(text)) &&
    (min === undefined || Number(text) >= min) &&
    (max === undefined || Number(text) <= max);
  return (
    <input
      id={id}
      aria-describedby={description}
      aria-label={label}
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (valid(text)) onChange(Number(text));
      }}
      onBlur={() => {
        if (!valid(draft)) setDraft(String(value));
      }}
    />
  );
}
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => !v && onClose()}
      modal={false}
    >
      <Dialog.Portal>
        {open && <div className="drawer-shade" onClick={onClose} />}
        <Dialog.Content
          className={`drawer ${wide ? "wide" : ""}`}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="drawer-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close panel">
              <X size={20} />
            </Dialog.Close>
          </div>
          <div className="drawer-content">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-shade" />
        <Dialog.Content className="confirm-dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <div className="button-row">
            <button onClick={onClose}>Cancel</button>
            <button
              className="danger"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Delete project
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
