import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageRow } from "./MessageRow";

const meta: Meta<typeof MessageRow> = {
  title: "Composites/MessageRow",
  component: MessageRow,
};
export default meta;

type Story = StoryObj<typeof MessageRow>;

export const You: Story = {
  args: { actor: "you", timestamp: "14:02", children: "hello addin" },
};

export const Addin: Story = {
  args: {
    actor: "addin",
    timestamp: "14:03",
    children: "hello — what can i help with",
  },
};
