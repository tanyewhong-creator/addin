import type { Meta, StoryObj } from "@storybook/react-vite";
import { TopBar } from "./TopBar";

const meta: Meta<typeof TopBar> = {
  title: "Composites/TopBar",
  component: TopBar,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof TopBar>;

export const Default: Story = {
  args: {
    brand: <span className="font-semibold">a/addin</span>,
    nav: (
      <>
        <span className="px-3">chat</span>
        <span className="px-3 opacity-60">audit</span>
        <span className="px-3 opacity-60">skills</span>
      </>
    ),
    end: <span>⌘K</span>,
  },
};
