import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const AUDIT_DIR = join(homedir(), ".clawpay");
const AUDIT_FILE = join(AUDIT_DIR, "audit.log");

type AuditAction = "pay" | "refund" | "balance" | "list_transactions" | "setup_payment";

interface AuditEntry {
  timestamp: string;
  action: AuditAction;
  amount?: number;
  currency?: string;
  paymentIntentId?: string;
  refundId?: string;
  status: "success" | "failed" | "blocked";
  reason?: string;
}

export function auditLog(entry: AuditEntry): void {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
  appendFileSync(AUDIT_FILE, line + "\n", "utf-8");
}

export function auditPayment(opts: {
  amount: number;
  currency: string;
  paymentIntentId?: string;
  status: "success" | "failed" | "blocked";
  reason?: string;
}): void {
  auditLog({
    timestamp: new Date().toISOString(),
    action: "pay",
    amount: opts.amount,
    currency: opts.currency,
    paymentIntentId: opts.paymentIntentId,
    status: opts.status,
    reason: opts.reason,
  });
}

export function auditRefund(opts: {
  refundId?: string;
  amount?: number;
  status: "success" | "failed";
  reason?: string;
}): void {
  auditLog({
    timestamp: new Date().toISOString(),
    action: "refund",
    refundId: opts.refundId,
    amount: opts.amount,
    status: opts.status,
    reason: opts.reason,
  });
}

export function auditSetup(status: "success" | "failed", reason?: string): void {
  auditLog({
    timestamp: new Date().toISOString(),
    action: "setup_payment",
    status,
    reason,
  });
}
