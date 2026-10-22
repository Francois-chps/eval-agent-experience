/**
 * Catalog of the email services the detector knows.
 * To support a new service, add an entry here: no other file needs to change.
 */
export interface EmailTool {
  /** Stable id used in results. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** npm packages: matched as package.json dependencies and as import specifiers. */
  readonly packages: readonly string[];
  /** API or SMTP hosts: an agent can call an API with fetch and no SDK. */
  readonly hosts: readonly RegExp[];
  /** Environment variables the service is configured with. */
  readonly env: readonly RegExp[];
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches an exact host name, not as part of a longer host. */
export function host(name: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9.-])${escapeRegExp(name)}(?![A-Za-z0-9-])`, "i");
}

/** Matches environment variables starting with a prefix, e.g. RESEND_API_KEY for "RESEND_". */
export function envPrefix(prefix: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(prefix)}[A-Z0-9_]*[A-Z0-9]`);
}

export const EMAIL_TOOLS: readonly EmailTool[] = [
  {
    id: "resend",
    name: "Resend",
    packages: ["resend"],
    hosts: [host("api.resend.com"), host("smtp.resend.com")],
    env: [envPrefix("RESEND_")],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    packages: ["@sendgrid/mail"],
    hosts: [host("api.sendgrid.com"), host("smtp.sendgrid.net")],
    env: [envPrefix("SENDGRID_")],
  },
  {
    id: "postmark",
    name: "Postmark",
    packages: ["postmark"],
    hosts: [host("api.postmarkapp.com"), host("smtp.postmarkapp.com")],
    env: [envPrefix("POSTMARK_")],
  },
  {
    id: "mailgun",
    name: "Mailgun",
    packages: ["mailgun.js", "mailgun-js"],
    hosts: [host("api.mailgun.net"), host("api.eu.mailgun.net"), host("smtp.mailgun.org")],
    env: [envPrefix("MAILGUN_")],
  },
  {
    id: "ses",
    name: "Amazon SES",
    packages: ["@aws-sdk/client-ses", "@aws-sdk/client-sesv2"],
    hosts: [/(?<![A-Za-z0-9.-])email(?:-smtp)?\.[a-z0-9-]+\.amazonaws\.com/i],
    env: [envPrefix("SES_")],
  },
  {
    id: "brevo",
    name: "Brevo",
    packages: ["@getbrevo/brevo", "sib-api-v3-sdk"],
    hosts: [host("api.brevo.com"), host("api.sendinblue.com"), host("smtp-relay.brevo.com")],
    env: [envPrefix("BREVO_"), envPrefix("SENDINBLUE_")],
  },
  {
    id: "mailersend",
    name: "MailerSend",
    packages: ["mailersend"],
    hosts: [host("api.mailersend.com")],
    env: [envPrefix("MAILERSEND_")],
  },
  {
    id: "smtp",
    name: "SMTP (Nodemailer)",
    packages: ["nodemailer"],
    hosts: [],
    env: [envPrefix("SMTP_")],
  },
];
