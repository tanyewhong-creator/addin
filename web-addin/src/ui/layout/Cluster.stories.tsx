import type { Meta, StoryObj } from "@storybook/react-vite";
import { Cluster } from "./Cluster";

const meta: Meta<typeof Cluster> = {
  title: "Layout/Cluster",
  component: Cluster,
};
export default meta;

type Story = StoryObj<typeof Cluster>;

export const Default: Story = {
  render: () => (
    <Cluster>
      <span className="font-mono text-sm">one</span>
      <span className="font-mono text-sm">two</span>
      <span className="font-mono text-sm">three</span>
    </Cluster>
  ),
};

export const Between: Story = {
  args: { justify: "between" },
  render: (args) => (
    <Cluster {...args} className="w-64">
      <span className="font-mono text-sm">left</span>
      <span className="font-mono text-sm">right</span>
    </Cluster>
  ),
};
