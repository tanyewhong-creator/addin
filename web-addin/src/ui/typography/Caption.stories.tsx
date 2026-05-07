import type { Meta, StoryObj } from "@storybook/react-vite";
import { Caption } from "./Caption";

const meta: Meta<typeof Caption> = {
  title: "Typography/Caption",
  component: Caption,
};
export default meta;

type Story = StoryObj<typeof Caption>;

export const Default: Story = { args: { children: "small caption · faint" } };
