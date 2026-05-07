import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommandBar } from "./CommandBar";

const meta: Meta<typeof CommandBar> = {
  title: "Composites/CommandBar",
  component: CommandBar,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof CommandBar>;

export const Open: Story = {
  args: { isOpen: true, onClose: () => {} },
};
