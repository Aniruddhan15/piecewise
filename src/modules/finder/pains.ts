import type { ArchetypeId } from "@/modules/taxonomy/types";

/**
 * Everyday problems, in the owner's words, mapped to the jobs (blocks) that solve them.
 * The finder hides any whose job has no answer for this business, so this list can be
 * generous without leading anyone to an empty page.
 */
export type Pain = { label: string; block: string };

const COMMON: Pain[] = [
  { label: "I miss calls when I'm busy", block: "customer_comm" },
  { label: "Not enough good online reviews", block: "reviews" },
  { label: "Customers don't come back often enough", block: "marketing" },
  { label: "Bookkeeping eats my weekends", block: "accounting" },
];

export const PAINS: Record<ArchetypeId, Pain[]> = {
  food_bev: [
    { label: "Food costs keep eating my profit", block: "recipe_costing" },
    { label: "Making the staff schedule takes forever", block: "scheduling_payroll" },
    { label: "The phone rings nonstop during the rush", block: "customer_comm" },
    { label: "Too much food ends up in the bin", block: "food_inventory" },
    { label: "Regulars don't come back often enough", block: "marketing" },
    { label: "Not enough good online reviews", block: "reviews" },
  ],
  field_services: [
    { label: "I miss calls while I'm on a job", block: "customer_comm" },
    { label: "Happy customers never leave reviews", block: "reviews" },
    { label: "Scheduling my crew is a headache", block: "scheduling_payroll" },
    { label: "Slow season: I need more repeat work", block: "marketing" },
  ],
  construction: [
    { label: "Bids take my nights and weekends", block: "bids_takeoffs" },
    { label: "Clients pay late", block: "invoicing" },
    { label: "Keeping job sites safe and on the rules", block: "legal" },
    { label: "I miss calls from new clients", block: "customer_comm" },
    { label: "Not enough good online reviews", block: "reviews" },
  ],
  retail: [
    { label: "We run out of our best sellers", block: "inventory_reorder" },
    { label: "I'm guessing what to order", block: "demand_forecast" },
    { label: "I want to sell online too", block: "catalog_store" },
    { label: "Customers don't come back often enough", block: "marketing" },
    { label: "Not enough good online reviews", block: "reviews" },
    { label: "Making the staff schedule takes forever", block: "scheduling_payroll" },
  ],
  ecommerce: [
    { label: "Listing products everywhere takes hours", block: "listings" },
    { label: "Sales tax confuses me", block: "sales_tax" },
    { label: "Packing and shipping eats my day", block: "fulfillment" },
    { label: "Payouts never match my books", block: "payout_recon" },
    { label: "I need more repeat buyers", block: "marketing" },
  ],
  appointments: [
    { label: "I miss calls while I'm with a client", block: "customer_comm" },
    { label: "Clients forget to rebook", block: "marketing" },
    { label: "Not enough good online reviews", block: "reviews" },
    { label: "Making the staff schedule takes forever", block: "scheduling_payroll" },
  ],
  clinics: [
    { label: "No-shows leave empty chairs", block: "patient_scheduling" },
    { label: "The front desk can't keep up with calls", block: "customer_comm" },
    { label: "Not enough good online reviews", block: "reviews" },
    { label: "Patients drift away between visits", block: "marketing" },
  ],
  lodging: [
    { label: "I'm not sure what to charge each night", block: "dynamic_pricing" },
    { label: "Cleaning between guests is chaos", block: "housekeeping" },
    { label: "Guests message me at all hours", block: "guest_messaging" },
    { label: "Not enough good online reviews", block: "reviews" },
  ],
  professional: [
    { label: "Taking on new clients is slow", block: "client_intake" },
    { label: "I miss calls while I'm in meetings", block: "customer_comm" },
    { label: "I can never find the right document", block: "documents" },
    { label: "Not enough good online reviews", block: "reviews" },
    { label: "Bookkeeping eats my weekends", block: "accounting" },
  ],
};

export function painsFor(archetypes: ArchetypeId[]): Pain[] {
  const list = archetypes.flatMap((a) => PAINS[a] ?? []);
  const all = [...list, ...COMMON];
  const seen = new Set<string>();
  return all.filter((p) => {
    if (seen.has(p.block)) return false;
    seen.add(p.block);
    return true;
  });
}
