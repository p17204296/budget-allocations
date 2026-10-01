import { Children, isValidElement, type ReactNode } from "react";
import * as Select from "@radix-ui/react-select";

type Props = {
  id?: string;
  value: string | undefined;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
};
// Existing option markup is shared between the trigger text and option list.
export function ScenarioSelect({
  children,
  value,
  onChange,
  disabled,
  className = "",
  ...labelProps
}: Props) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as { value: string; children: ReactNode };
      return { value: props.value || "__none__", label: props.children };
    });
  return (
    <Select.Root
      value={value || "__none__"}
      disabled={disabled}
      onValueChange={(next) =>
        onChange({ target: { value: next === "__none__" ? "" : next } })
      }
    >
      <Select.Trigger
        {...labelProps}
        className={`scenario-select ${className}`}
      >
        <Select.Value />
        <Select.Icon className="scenario-select-chevron">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m7 10 5 5 5-5" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="scenario-select-menu"
          position="popper"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          hideWhenDetached
        >
          <Select.ScrollUpButton className="scenario-select-scroll">
            ↑
          </Select.ScrollUpButton>
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="scenario-select-option"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="scenario-select-check">
                  ✓
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="scenario-select-scroll">
            ↓
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
