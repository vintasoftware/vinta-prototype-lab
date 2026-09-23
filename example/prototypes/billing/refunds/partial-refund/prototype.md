---
title: Partial refund
summary: Refund some lines of a paid invoice, back to the card it was paid with.
entry: choose-lines
status: Draft
owner: Design — Ana
updated: 2026-09-23
---

## What this covers

Staff refund part of a paid invoice: they tick the lines to refund, check the total, and send it.

This prototype sits two folders deep, in `billing/refunds/`. The picker in the header lists it
under **Billing / Refunds**, and its link is `#/p/billing/refunds/partial-refund`.

## The flow

1. **Choose lines** — every line starts unticked. The refund total updates as lines are ticked,
   and the button stays disabled until at least one is.
2. **Refund sent** — says which card the money goes back to, and when it arrives.

## Rules the screens do not show

- A line can be refunded once. A refunded line shows on the invoice, struck through.

## Out of scope

Full refunds, which are a single button on the invoice.
