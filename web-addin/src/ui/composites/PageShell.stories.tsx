import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageShell } from "./PageShell";

const meta: Meta<typeof PageShell> = {
  title: "Composites/PageShell",
  component: PageShell,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof PageShell>;

export const Default: Story = {
  args: {
    topBar: { brand: <span className="font-semibold">a/addin</span> },
    children: <div className="p-6 font-mono text-sm">page content</div>,
  },
};
