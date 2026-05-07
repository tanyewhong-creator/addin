import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Text } from "../ui/typography/Text";
import { Caption } from "../ui/typography/Caption";

export type StubPageProps = {
  title: string;
};

/**
 * Honest "ships in v2.1" placeholder for routes whose implementation
 * is deferred. Per spec §10.2 — Phase 1 cutline.
 */
export function StubPage({ title }: StubPageProps) {
  return (
    <Container size="md" className="py-16">
      <div className="space-y-4">
        <Caption>v2.1 · in progress</Caption>
        <Heading level={1}>{title}</Heading>
        <Text className="text-addin-fg-muted">
          this surface ships in v2.1 — for now, edit{" "}
          <code className="bg-addin-bg-elev px-1 border border-addin-line">
            ~/.addin/config.yaml
          </code>{" "}
          or use the CLI.
        </Text>
      </div>
    </Container>
  );
}
