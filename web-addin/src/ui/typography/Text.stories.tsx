import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "./Text";

const meta: Meta<typeof Text> = {
  title: "Typography/Text",
  component: Text,
};
export default meta;

type Story = StoryObj<typeof Text>;

export const Default: Story = {
  args: {
    children:
      "the quick brown fox jumps over the lazy dog. monospace body text at 14px.",
  },
};
