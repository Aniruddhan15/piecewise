import { z } from "zod";

/**
 * Shared data model (SPEC §3). These Zod schemas are the single source for the
 * seed data, API I/O and LLM structured output. Fields marked "additive" are not
 * in §3; they exist because a rule cannot be evaluated without them.
 */

export const ArchetypeIdSchema = z.enum([
  "food_bev",
  "field_services",
  "construction",
  "retail",
  "ecommerce",
  "appointments",
  "clinics",
  "lodging",
  "professional",
]);

export const EntitySchema = z.enum([
  "customers",
  "items",
  "appointments",
  "invoices",
  "orders",
  "rates",
  "timesheets",
]);

export const AccountingEditionSchema = z.enum([
  "qbo",
  "qbd",
  "xero",
  "wave",
  "freshbooks",
  "spreadsheet",
  "none",
]);

export const DeviceSchema = z.enum(["ios", "android", "windows", "web"]);
export const EvidenceGradeSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BlockSchema = z.object({
  id: z.string(),
  name: z.string(),
  plain_name: z.string(),
  layer: z.enum(["base", "universal", "archetype"]),
  archetypes: z.union([z.array(ArchetypeIdSchema), z.literal("all")]),
  condition: z.enum(["has_employees", "multi_location"]).optional(),
  description: z.string(),
  /** Additive: key of an SBA resource shown next to this block (M12.F2). */
  sba_resource: z.string().optional(),
});

export const ArchetypeSchema = z.object({
  id: ArchetypeIdSchema,
  name: z.string(),
  plain_name: z.string(),
  examples: z.array(z.string()),
  block_ids: z.array(z.string()),
  starter_blocks: z.array(z.string()),
  anchor_label: z.string(),
  anchor_description: z.string(),
  regulated_question: z
    .object({
      prompt: z.string(),
      help: z.string(),
      yes_value: z.enum(["hipaa", "tax_7216", "legal_aba"]),
    })
    .array()
    .optional(),
});

export const TierSchema = z.object({
  name: z.string(),
  monthly_usd: z.number().nullable(),
  unit: z.string().optional(),
  includes: z.array(z.string()),
});

export const EvidenceSchema = z.object({
  claim: z.string(),
  url: z.string().url(),
  grade: EvidenceGradeSchema,
  /** Additive: short exact quote (15 words or fewer) when we have one. */
  quote: z.string().optional(),
  /** Additive: the rule this evidence backs (R1, R8, ...), for reason links. */
  rule: z.string().optional(),
});

export const NeedSchema = z.object({
  with: z.enum(["anchor", "accounting", "payments"]),
  entities: z.array(EntitySchema).min(1),
  /** Direction relative to this tool. */
  direction: z.enum(["from_tool", "to_tool", "two_way"]).optional(),
  detail: z.enum(["summary", "itemized"]).optional(),
  why: z.string(),
});

export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  vendor_url: z.string().url(),
  kind: z.enum(["base_system", "ai_tool", "adapter"]),
  blocks: z.array(z.string()),
  archetypes: z.union([z.array(ArchetypeIdSchema), z.literal("all")]),
  ai_capabilities: z.array(z.string()),
  owns_entities: z.array(EntitySchema),
  writes_inventory: z.boolean().optional(),
  writes_rates: z.boolean().optional(),
  posts_sales_to_accounting: z.boolean().optional(),
  bookable_calendar: z.boolean().optional(),
  requires_processor: z.string().optional(),
  requires_vendor_hardware: z.boolean().optional(),
  os_supported: z.array(DeviceSchema).optional(),
  offline_mode: z.enum(["full", "limited", "none"]).optional(),
  editions_supported: z.array(AccountingEditionSchema).optional(),
  ecosystem_lock: z.string().optional(),
  baa: z
    .object({
      available: z.boolean(),
      min_tier: z.string().optional(),
      excluded_features: z.array(z.string()).optional(),
    })
    .optional(),
  handles_10dlc: z.boolean().optional(),
  review_gating_feature: z.boolean().optional(),
  tiers: z.array(TierSchema),
  free_tier: z.boolean(),
  trial_days: z.number().optional(),
  contract_term: z.string().optional(),
  included_in: z
    .array(
      z.object({
        base_system: z.string(),
        min_tier: z.string().optional(),
      }),
    )
    .optional(),
  setup: z.object({
    hours_estimate: z.number(),
    no_code: z.boolean(),
    steps: z.array(z.string()),
    data_needed: z.array(z.string()),
  }),
  how_to_start: z.object({
    type: z.enum(["marketplace_install", "signup", "book_demo"]),
    url: z.string().url(),
  }),
  privacy: z.object({
    trains_on_customer_data: z.boolean().nullable(),
    policy_url: z.string().url().optional(),
  }),
  evidence: z.array(EvidenceSchema),
  last_checked: IsoDate,
  verified: z.boolean(),

  // ---- Additive fields ----
  /** Connections this tool must have to do its job (R7, R20, R21). */
  needs: z.array(NeedSchema).optional(),
  /** Tool still does its job with no connection; R7 becomes a caveat. */
  standalone_ok: z
    .object({
      message: z.string(),
      /** True when working alone is a real limit worth a "catch". */
      caveat: z.boolean().optional(),
    })
    .optional(),
  /** Base systems: which archetypes treat this as their anchor (M4.F2). */
  anchor_for: z.array(ArchetypeIdSchema).optional(),
  /** Base systems: which intake questions list this system (M4.F1). */
  slots: z
    .array(z.enum(["payments_pos", "accounting", "customer_records", "channels"]))
    .optional(),
  /** Base systems: non-recommendation features that already cover a block (P4, R15). */
  covers: z
    .array(
      z.object({
        block: z.string(),
        feature: z.string(),
        min_tier: z.string().optional(),
        addon_monthly_usd: z.number().optional(),
        evidence_url: z.string().url(),
        verified: z.boolean(),
      }),
    )
    .optional(),
  /** Tool sends text messages to customers (R23). */
  sends_sms: z.boolean().optional(),
  /** Set false when a tool can be used without patient data (R8). */
  touches_patient_data: z.boolean().optional(),
  /** Plain-language BAA guidance shown when touches_patient_data is false. */
  baa_note: z.string().optional(),
  /** Source for the BAA fact shown in R8/R9/R10 reasons. */
  baa_evidence_url: z.string().url().optional(),
  /** Payroll tools: ledgers this payroll can post to (R4). */
  ledger_lock: z.array(AccountingEditionSchema).optional(),
  /** Base systems: API restricted to certified partners (R5). */
  partner_only_api: z.boolean().optional(),
  /** Features this tool's recommended use relies on (R10). */
  uses_features: z.array(z.string()).optional(),
  /** Tool works on client data covered by ABA or §7216 rules (R23). */
  touches_client_confidential: z.boolean().optional(),
  /** Mutually exclusive tools, documented by the vendor (R16). */
  mutually_exclusive_with: z
    .array(z.object({ tool: z.string(), note: z.string(), evidence_url: z.string().url() }))
    .optional(),
  /** Report conflict or correction shown beside the fact. */
  caution: z.string().optional(),
});

export const EdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["native", "marketplace", "certified", "ipaas", "bridge_app", "none"]),
  via: z.string().optional(),
  direction: z.enum(["from_to", "to_from", "two_way"]),
  entities: z.array(EntitySchema),
  detail: z.enum(["summary", "itemized"]).optional(),
  min_tier_from: z.string().optional(),
  min_tier_to: z.string().optional(),
  latency_minutes: z.number().optional(),
  fee: z
    .object({
      pct: z.number().optional(),
      monthly_usd: z.number().optional(),
      note: z.string(),
    })
    .optional(),
  status: z.enum(["active", "deprecated", "replaced"]),
  evidence_url: z.string().url(),
  evidence_quote: z.string().optional(),
  evidence_grade: EvidenceGradeSchema,
  last_checked: IsoDate,
  verified: z.boolean(),
  /** Additive: one plain sentence shown with this connection. */
  note: z.string().optional(),
});

export const BusinessProfileSchema = z.object({
  description: z.string(),
  archetypes: z.array(ArchetypeIdSchema),
  naics: z.object({ code: z.string(), title: z.string() }).optional(),
  employees: z.number(),
  locations: z.number(),
  mobile: z.boolean(),
  monthly_budget_usd: z.number().optional(),
  base: z.object({
    payments_pos: z.string().optional(),
    accounting: z.string().optional(),
    accounting_edition: AccountingEditionSchema.optional(),
    customer_records: z.string().optional(),
    channels: z.array(z.string()),
  }),
  anchor: z.string().optional(),
  selected_tiers: z.record(z.string(), z.string()),
  devices: z.array(DeviceSchema),
  connectivity: z.enum(["reliable", "unreliable"]),
  regulated: z.enum(["hipaa", "tax_7216", "legal_aba", "none"]),
  sells_on: z.array(z.string()),
});

export const SbaResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  last_checked: IsoDate,
  verified: z.boolean(),
});

export const DemoProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  blurb: z.string(),
  profile: BusinessProfileSchema,
  /** block id -> tool id */
  pieces: z.record(z.string(), z.string()),
  /** Shown under the demo so judges know what to look for. */
  stories: z.array(z.string()),
});

/**
 * Before/after story for a job. The default entry (no archetype) is complete; an entry for one
 * type of business only needs new wording and inherits the rest. Hours are our estimate of
 * time back per week, as a low-high range, never a vendor claim.
 */
export const OutcomeSchema = z.object({
  block: z.string(),
  archetype: ArchetypeIdSchema.optional(),
  before: z.string().min(1),
  after: z.string().min(1),
  icon: z.string().optional(),
  hours: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).optional(),
  assumption: z.string().optional(),
});

/**
 * Money and efficiency for a job, for a typical small business. "revenue" is extra sales or
 * money you would have lost; "saved" is something that costs you less. Dollars are per month
 * and always carry the assumption behind them. The measure is a before/after pair we can chart.
 */
/**
 * How much to trust a number. "sourced": backed by published research or official benchmarks.
 * "vendor": the best figure we found comes from a company that sells this kind of tool.
 * "guess": our own estimate, with the assumption stated.
 */
export const ConfidenceSchema = z.enum(["sourced", "vendor", "guess"]);
export const SourceSchema = z.object({ label: z.string().min(1), url: z.string().url() });

const MoneySchema = z.object({
  kind: z.enum(["revenue", "saved"]),
  low: z.number().nonnegative(),
  high: z.number().nonnegative(),
  assumption: z.string().min(1),
  confidence: ConfidenceSchema.default("guess"),
  source: SourceSchema.optional(),
});

export const ImpactSchema = z.object({
  block: z.string(),
  /** Which number leads this job's card: hours saved, money, or the before/after measure. */
  headline: z.enum(["time", "money", "measure"]).default("time"),
  /** Null when the value is avoiding problems and we will not put a dollar figure on it. */
  money: MoneySchema.nullable(),
  /** Different dollars for a type of business, when a typical sale is very different. */
  by_archetype: z.partialRecord(ArchetypeIdSchema, z.object({ money: MoneySchema })).optional(),
  measure: z.object({
    label: z.string().min(1),
    /** Text after the number: "%", " min", " days" or "". */
    unit: z.string(),
    before: z.number().nonnegative(),
    after: z.number().nonnegative(),
    better: z.enum(["higher", "lower"]),
    confidence: ConfidenceSchema.default("guess"),
    source: SourceSchema.optional(),
  }),
});

export const NaicsMapSchema = z.record(
  ArchetypeIdSchema,
  z.array(z.object({ code: z.string(), title: z.string() })),
);
