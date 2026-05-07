import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "../primitives/Button";

const meta: Meta<typeof EmptyState> = {
  title: "Composites/EmptyState",
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = { args: { message: "no entries yet" } };

export const WithAction: Story = {
  args: {
    message: "no skills yet",
    action: <Button variant="secondary">add one</Button>,
  },
};
