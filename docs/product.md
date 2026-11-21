# BhangariWala product summary

Copied from the product spec on claude.ai; CLAUDE.md holds the rules developers follow day to day.

## What v1 is

A household in Dhaka requests a doorstep scrap pickup. A nearby collector accepts it, weighs the items in front of the household at today's fixed per-kg rate, and pays on the spot. v1 launches across all of Dhaka, in Bangla by default with an English toggle.

In v1:
- Household app: sign in, see today's rates, request a pickup, track the collector, confirm weights, get paid, rate the collector.
- Collector app: sign up, go online, see nearby requests, accept, verify the pickup code, enter weights, pay, complete.
- Admin web panel: set daily rates, approve collectors, watch live pickups, resolve disputes.
- Payments: cash, or bKash/Nagad sent by the collector from their own wallet, recorded with a TrxID.

Not in v1: automatic bKash/Nagad payments, households buying items, reselling to dealers inside the app, collector wallets, loyalty points, referrals, and BhangariWala buying scrap from collectors (planned for v2).

## Users

| Role | Who | Main jobs |
| --- | --- | --- |
| Household | Homemakers, family members, building caretakers | Request a pickup, give the pickup code, confirm weights, get paid |
| Collector | Independent bhangariwalas with a van, pushcart or on foot | Find nearby requests, accept, weigh in front of the seller, pay |
| Admin | BhangariWala operations team | Set daily rates, approve collectors, monitor pickups, resolve disputes |

## Decisions

| Decision | Answer |
| --- | --- |
| How BhangariWala earns money | On hold; no commission in v1. Buying scrap from collectors planned for v2 |
| Who sets rates | Admins, one per-kg rate per category per day |
| Collector verification | Selfie and NID number at sign-up; NID card verification later |
| Launch area | All of Dhaka |
| Minimum pickup | 2 kg estimated; electronics exempt |
| Matching | 1 km, widening to 3 km after 5 minutes; expires at the end of the booked slot |
| Scale photo | Optional on every weigh (changed from required on 2026-11-21) |
| SMS and maps | A local SMS gateway for OTP; Google Maps within its free monthly allowance where possible |
| Apps | One mobile app with a role chosen at sign-up |

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Language | Bangla default with Bangla numerals on screen; English toggle; every string in translation files |
| Usability | Icon plus text on every action; touch targets at least 48 px; one main action per screen |
| Devices | Android first, iOS after launch; small install; usable on slow 3G/4G |
| Offline | The collector's weigh screen keeps a local draft and retries when the connection returns |
| Security | OTP rate limits per phone and IP; short-lived access tokens; pickup code stored hashed; role checks on every endpoint |
| Privacy | Exact address and phone only to the assigned collector after accept; selfies in private storage |
| Consistency | Accept is one atomic update; every status change written to `status_events` |
| Observability | Structured logs, request tracing, alerts on failed OTPs, stuck pickups and payment reports |

## Still to do outside code

Legal (privacy policy, terms, collector agreement, business registration), operations (recruiting and verifying the first collectors, the daily rate source, support channel, dispute process), accounts (Google Play, Firebase, SMS gateway, maps key, hosting, domain), Play Store listing, and pilot metrics (time to accept, completed pickups per week, dispute rate).
