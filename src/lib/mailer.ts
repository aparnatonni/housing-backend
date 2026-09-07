import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import config from "../config";
import prisma from "./prisma";

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.password) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.password },
    });
  }
  return transporter;
};

export type MailResult = {
  ok: boolean;
  messageId: string | null;
  error: string | null;
};

export const sendMail = async (input: {
  to: string;
  subject: string;
  text: string;
}): Promise<MailResult> => {
  const transport = getTransporter();
  if (!transport) {
    return { ok: true, messageId: null, error: null };
  }
  try {
    const info = await transport.sendMail({
      from: config.smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    console.log(`[mailer] email sent to ${input.to} (${info.messageId})`);
    return { ok: true, messageId: info.messageId ?? null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mailer] send failed to ${input.to}: ${message}`);
    return { ok: false, messageId: null, error: message };
  }
};

export const sendMailToUser = async (
  userId: string,
  subject: string,
  text: string,
): Promise<MailResult> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, deletedAt: true },
    });
    if (!user || user.deletedAt !== null) {
      return { ok: true, messageId: null, error: null };
    }
    return sendMail({ to: user.email, subject, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, messageId: null, error: message };
  }
};
