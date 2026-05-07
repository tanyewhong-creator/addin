import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const meta: Meta<typeof Modal> = {
  title: "Primitives/Modal",
  component: Modal,
};
export default meta;

type Story = StoryObj<typeof Modal>;

export const Closed: Story = {
  render: () => <Modal open={false} onClose={() => {}}>hidden</Modal>,
};

export const OpenWithTitle: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>open</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
          <p className="text-sm text-addin-fg">Are you sure?</p>
          <div className="flex gap-2 mt-3">
            <Button variant="primary" onClick={() => setOpen(false)}>ok</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>cancel</Button>
          </div>
        </Modal>
      </>
    );
  },
};

export const Large: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>open large</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Edit Document" size="lg">
          <p className="text-sm text-addin-fg">A wider modal for richer content.</p>
        </Modal>
      </>
    );
  },
};
