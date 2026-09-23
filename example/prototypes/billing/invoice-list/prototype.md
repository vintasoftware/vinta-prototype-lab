---
title: Invoice list
summary: How front-desk staff find a patient's invoice and see what is still owed.
entry: invoices
status: Draft
owner: Design — Ana
updated: 2026-09-23
---

## What this covers

Front-desk staff open the invoice list, spot what is overdue, and open one invoice to see its
lines and what has been paid.

This prototype sits in the `billing/` group folder, next to the `refunds/` group. The picker in the
header lists it under **Billing**.

## The flow

1. **Invoices** — one row per invoice, newest first. Overdue rows carry a warning badge, and the
   total still owed sits above the table. The `Empty` variant shows a clinic with no invoices yet.
2. **Invoice** — the lines, the payments made against them, and the balance.

## Open questions

- Should the list filter by status, or is the overdue badge enough?

## Out of scope

Taking a payment, and refunds (those are in **Billing / Refunds**).
