---
title: Book a follow-up visit
summary: Four screens covering how a patient books a follow-up from the dashboard.
entry: home
status: In review
owner: Design — Ana
updated: 2026-09-04
---

## What this covers

A patient with an open care task books a follow-up visit. The flow starts on the dashboard, picks a
time, reviews it, and lands on a confirmation the patient can add to their calendar.

## The flow

1. **Home** — the follow-up card is the only card with a filled button, so the next step reads at a
   glance. Clicking it opens the time picker.
2. **Choose time** — the picker opens on the first day with availability, not on today. The
   `No availability` variant shows the week where nothing is bookable.
3. **Review** — one screen, no editing. The patient changes the time by going back.
4. **Confirmed** — the appointment card repeats the same three facts as the review screen, in the
   same order, so nothing looks like it changed on submit.

## Rules the screens do not show

- A patient may hold one open follow-up at a time. Booking a second one replaces the first, and the
  confirmation says so.
- Times are shown in the patient's own timezone, with the clinic's timezone in the detail line when
  the two differ.
- The `Reschedule` link on the confirmation screen re-enters this flow at **Choose time**, keeping
  the existing appointment until the new one is confirmed.

## Open questions

- Does the empty week offer a waitlist, or only a link to call the clinic? The variant shows the
  call link.
- Should the review screen show the cost estimate, or is that a later screen?

## Out of scope

Rescheduling and cancellation flows, provider selection, and anything about insurance.
