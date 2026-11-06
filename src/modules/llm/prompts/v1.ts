import blocks from "@data/blocks.json";
import type { TaskId } from "../tasks";

/** Versioned prompts (M15.F5). Change the file name when a prompt's meaning changes. */

const SHARED =
  "Write in plain language at about a grade 8 reading level. Never add prices, integrations or claims that aren't in the input.";

export const PROMPT_VERSION = "v1";

export const SYSTEM_PROMPTS: Record<TaskId, string> = {
  classify_business: `You classify a small business from its description.
Business types:
- food_bev: restaurants, cafes, bakeries, food trucks, bars
- field_services: trades that go to the customer: HVAC, plumbing, electrical, landscaping, cleaning
- construction: general contractors, remodelers, specialty subcontractors
- retail: shops with a physical storefront
- ecommerce: selling mainly online: Shopify, Etsy, Amazon
- appointments: salons, barbers, spas, fitness studios, tutors, pet groomers
- clinics: dentists, chiropractors, therapists, doctors, veterinary clinics
- lodging: inns, B&Bs, short-term rentals
- professional: lawyers, accountants, tax preparers, consultants, agencies
Return every type that clearly applies; a bakery that also sells packaged coffee beans is food_bev and retail. Return the most likely 6-digit NAICS code and title, a confidence from 0 to 1, and suggested_extra_blocks: ids from this list that the description clearly calls for beyond those business types, usually an empty list: ${blocks.map((b) => b.id).join(", ")}. ${SHARED}`,

  map_problem: `A small business owner describes their biggest headache. Pick up to 3 ids from the provided puzzle pieces that would help most, best first. Use only ids from the input. "why" is one short sentence to the owner. ${SHARED}`,

  explain_verdict: `Explain to a small business owner, in one or two plain sentences, what this compatibility result means for them. Use only the facts in the reasons. Don't mention rule numbers. Keep any numbers exactly as given. ${SHARED}`,

  personalize_steps: `Reword these setup steps so they suit this business. Return exactly the same number of steps, in the same order. Don't add new steps, tools, prices, numbers or facts. ${SHARED}`,

  extract_tool_profile: `You read a software vendor or marketplace page and extract a partial profile of the tool. Only state what the page says. Every claim in "evidence" needs "quote": an exact, short passage copied from the page text, 15 words or fewer. Use null prices when none is stated. is_ai_tool is true only when the page describes a specific AI capability. Never guess.`,

  verify_edge: `You check whether a page supports a claimed connection between two software tools. supported is true only if the page clearly says so. "quote" is an exact, short passage copied from the page text, 15 words or fewer, or an empty string if unsupported. Give the sync direction and minimum plan only if the page states them; otherwise null.`,
};
