import type { Block } from "@/modules/taxonomy/types";

/** Deterministic fallback for map_problem (M6.F2). */

const STOP = new Set(
  "a an and are at be but by can do for from get how i in is it its me my no not of on or our so that the their them they to too up us we what when with you your don t".split(
    " ",
  ),
);

/** Everyday words owners use, mapped to the blocks they point at. */
const SYNONYMS: Record<string, string[]> = {
  call: ["customer_comm", "channels"],
  calls: ["customer_comm", "channels"],
  phone: ["customer_comm", "channels"],
  voicemail: ["customer_comm"],
  answer: ["customer_comm"],
  review: ["reviews"],
  reviews: ["reviews"],
  google: ["reviews", "marketing"],
  yelp: ["reviews"],
  invoice: ["invoicing"],
  invoices: ["invoicing"],
  paid: ["invoicing"],
  overdue: ["invoicing"],
  cash: ["invoicing"],
  bookkeeping: ["accounting"],
  books: ["accounting"],
  quickbooks: ["accounting"],
  taxes: ["accounting", "sales_tax"],
  schedule: ["scheduling_payroll", "booking"],
  scheduling: ["scheduling_payroll", "booking"],
  shifts: ["scheduling_payroll"],
  payroll: ["scheduling_payroll"],
  staff: ["scheduling_payroll", "hiring_training"],
  hiring: ["hiring_training"],
  training: ["hiring_training"],
  marketing: ["marketing"],
  email: ["marketing"],
  promotion: ["marketing"],
  customers: ["marketing", "customer_records"],
  repeat: ["marketing"],
  food: ["recipe_costing", "food_inventory"],
  waste: ["food_inventory"],
  recipe: ["recipe_costing"],
  costs: ["recipe_costing", "reporting"],
  margins: ["recipe_costing", "reporting"],
  delivery: ["online_ordering", "fulfillment"],
  orders: ["online_ordering", "fulfillment"],
  doordash: ["online_ordering"],
  inspection: ["food_safety"],
  health: ["food_safety", "hipaa"],
  quote: ["estimates", "bids_takeoffs"],
  quotes: ["estimates", "bids_takeoffs"],
  estimate: ["estimates", "bids_takeoffs"],
  estimates: ["estimates", "bids_takeoffs"],
  bid: ["bids_takeoffs"],
  bids: ["bids_takeoffs"],
  route: ["dispatch"],
  dispatch: ["dispatch"],
  parts: ["truck_inventory"],
  stock: ["inventory_reorder", "food_inventory"],
  inventory: ["inventory_reorder", "food_inventory", "truck_inventory"],
  reorder: ["inventory_reorder"],
  forecast: ["demand_forecast"],
  shipping: ["fulfillment"],
  returns: ["returns"],
  listings: ["listings"],
  no: [],
  show: ["booking", "patient_scheduling"],
  shows: ["booking", "patient_scheduling"],
  appointments: ["booking", "patient_scheduling"],
  reminders: ["booking", "patient_scheduling"],
  patients: ["patient_scheduling"],
  insurance: ["insurance_billing"],
  hipaa: ["hipaa"],
  pricing: ["dynamic_pricing"],
  rates: ["dynamic_pricing"],
  cleaning: ["housekeeping"],
  guests: ["guest_messaging"],
  contracts: ["proposals_esign"],
  proposals: ["proposals_esign"],
  time: ["time_billing"],
  billing: ["time_billing", "invoicing"],
  documents: ["documents"],
  paperwork: ["documents", "invoicing"],
  permits: ["permits"],
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function keywordMap(
  problem: string,
  blocks: Block[],
): { block_ids: string[]; why: string } {
  const words = tokens(problem);
  const onBoard = new Set(blocks.map((b) => b.id));
  const scores = new Map<string, number>();
  const add = (id: string, n: number) => {
    if (onBoard.has(id)) scores.set(id, (scores.get(id) ?? 0) + n);
  };

  for (const word of words) {
    for (const id of SYNONYMS[word] ?? []) add(id, 3);
    for (const block of blocks) {
      const haystack = tokens(`${block.name} ${block.plain_name} ${block.description}`);
      if (haystack.includes(word)) add(block.id, 1);
    }
  }

  const block_ids = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  return {
    block_ids,
    why: block_ids.length
      ? "These pieces mention what you described."
      : "We couldn't match that to a piece. Try different words, or start with the highlighted pieces.",
  };
}
