import { Container } from "../ui/layout/Container";
import { Heading } from "../ui/typography/Heading";
import { Caption } from "../ui/typography/Caption";
import { Text } from "../ui/typography/Text";
import { Card } from "../ui/primitives/Card";

export function ChatPage() {
  return (
    <Container size="md" className="py-16">
      <div className="space-y-6">
        <div className="space-y-2">
          <Caption>terminal first · browser chat in a later release</Caption>
          <Heading level={1}>chat</Heading>
        </div>
        <Text className="text-addin-fg-muted">
          A/addin's chat is in your terminal. browser-based chat ships once
          we land a streaming protocol that does justice to the tool-call
          render and conversation flow.
        </Text>
        <Card className="bg-addin-bg-elev">
          <pre className="font-mono text-sm text-addin-fg whitespace-pre-wrap">
            $ addin
          </pre>
          <Text className="text-addin-fg-muted text-xs mt-2">
            run `addin` from any shell. memory and skills are shared with
            this dashboard.
          </Text>
        </Card>
      </div>
    </Container>
  );
}
