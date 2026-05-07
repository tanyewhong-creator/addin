import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./Textarea";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
};
export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = { args: { placeholder: "write a longer note", rows: 4 } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "locked" } };
