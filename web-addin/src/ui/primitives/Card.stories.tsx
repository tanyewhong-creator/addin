import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = { args: { children: "card content" } };
export const WithBlock: Story = {
  render: () => (
    <Card>
      <div className="font-mono text-sm">
        <div>name · widget</div>
        <div className="text-xs opacity-60">id · w-001</div>
      </div>
    </Card>
  ),
};
