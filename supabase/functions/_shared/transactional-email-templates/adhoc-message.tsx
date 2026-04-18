import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 's2kDOTza Entertainment'

interface AdhocMessageProps {
  subject?: string
  body?: string
  recipientName?: string
  senderName?: string
}

const AdhocMessageEmail = ({
  subject,
  body,
  recipientName,
  senderName,
}: AdhocMessageProps) => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,'
  const paragraphs = (body || '').split(/\n\n+/).filter((p) => p.trim().length > 0)
  const sign = senderName || SITE_NAME

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject || `A message from ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subject || 'A message from ' + SITE_NAME}</Heading>
          <Section>
            <Text style={text}>{greeting}</Text>
            {paragraphs.length === 0 ? (
              <Text style={text}>{body}</Text>
            ) : (
              paragraphs.map((p, i) => (
                <Text key={i} style={text}>
                  {p}
                </Text>
              ))
            )}
            <Text style={text}>Best regards,</Text>
            <Text style={signature}>{sign}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdhocMessageEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `A message from ${SITE_NAME}`,
  displayName: 'Ad-hoc message (Outbox)',
  previewData: {
    subject: 'Following up on our conversation',
    body: 'Thanks again for taking the time to chat earlier this week.\n\nI wanted to follow up with the next steps we discussed.',
    recipientName: 'Jane',
    senderName: 'Pitch Black Afro',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"DM Sans", Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '32px 24px',
}
const h1 = {
  fontFamily: '"Playfair Display", Georgia, serif',
  fontSize: '24px',
  fontWeight: 700,
  color: '#0a0a0a',
  margin: '0 0 24px',
  lineHeight: 1.3,
}
const text = {
  fontSize: '15px',
  color: '#2a2a2a',
  lineHeight: 1.6,
  margin: '0 0 16px',
}
const signature = {
  fontSize: '15px',
  color: '#0a0a0a',
  fontWeight: 600,
  margin: '0',
}
