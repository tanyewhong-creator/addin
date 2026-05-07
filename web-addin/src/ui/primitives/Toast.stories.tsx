import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToastProvider, useToast } from "./Toast";
import { Button } from "./Button";

const meta: Meta = {
  title: "Primitives/Toast",
};
export default meta;

type Story = StoryObj;

function TriggerAll() {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Button onClick={() => toast("default toast")}>default</Button>
      <Button variant="secondary" onClick={() => toast("saved", { intent: "success" })}>
        success
      </Button>
      <Button variant="secondary" onClick={() => toast("save failed", { intent: "danger" })}>
        danger
      </Button>
    </div>
  );
}

export const Variants: Story = {
  render: () => (
    <ToastProvider>
      <TriggerAll />
    </ToastProvider>
  ),
};
