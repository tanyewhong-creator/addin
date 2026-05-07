import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./Stack";

const meta: Meta<typeof Stack> = {
  title: "Layout/Stack",
  component: Stack,
};
export default meta;

type Story = StoryObj<typeof Stack>;

export const Default: Story = {
  args: { gap: 4 },
  render: (args) => (
    <Stack {...args}>
      <div className="font-mono text-sm">one</div>
      <div className="font-mono text-sm">two</div>
      <div className="font-mono text-sm">three</div>
    </Stack>
  ),
};

export const Tight: Story = {
  args: { gap: 1 },
  render: (args) => (
    <Stack {...args}>
      <div className="font-mono text-sm">a</div>
      <div className="font-mono text-sm">b</div>
    </Stack>
  ),
};
