export type ProvenancePathway =
  | 'eco-direct-eqp'
  | 'eco-food-bsaf'
  | 'background-adjustment'
  | 'human-health-direct'
  | 'human-health-food';

export type ZoteroStatus =
  | 'pending_owner_export'
  | 'linked'
  | 'not_in_zotero';

export type SourceFileStorage =
  | 'zotero_or_external'
  | 'repo_metadata_only';

export type SourceAuthorityScope =
  | 'bc-legal'
  | 'bc-guidance'
  | 'federal-guidance'
  | 'international-guidance'
  | 'supporting-science'
  | 'repo-design';

export type SourceCurrentnessStatus =
  | 'current'
  | 'needs_currentness_check'
  | 'superseded'
  | 'unknown';

export type SourceAuthorityTier =
  | 'tier_1_government_or_regulatory'
  | 'tier_2_peer_reviewed_literature'
  | 'tier_3_supporting_science'
  | 'implementation_scaffold';

export type CanonicalSourceStatus =
  | 'direct_source_verified'
  | 'needs_direct_source_check'
  | 'needs_exact_source_locator'
  | 'not_applicable';

export type CalculatorSourceRole =
  | 'canonical_candidate'
  | 'reference_mining'
  | 'policy_compilation'
  | 'implementation_scaffold';

export type CatalogQaStatus =
  | 'needs_review'
  | 'approved'
  | 'superseded';

export type ExtractionStatus =
  | 'extracted_from_current_calculator'
  | 'extracted_from_source'
  | 'pending_extraction';

export type DefaultStatus =
  | 'current_default'
  | 'available_option'
  | 'not_default';

export type EvidenceSupportStatus =
  | 'approved_source_backed'
  | 'pending_source_locator'
  | 'current_calculator_scaffold'
  | 'reference_mining_lead'
  | 'user_entered_or_derived';

export type ParameterValueType =
  | 'single_value'
  | 'range'
  | 'formula_default';

export type ExtractionMethod =
  | 'current_calculator_scaffold'
  | 'manual_source_extraction'
  | 'zotero_metadata_import'
  | 'external_inventory';

export type EvidenceLocatorType =
  | 'current_calculator'
  | 'source_page'
  | 'source_table'
  | 'source_section'
  | 'equation_citation'
  | 'external_file';

export type SourceRelationshipRole =
  | 'canonical_candidate'
  | 'supporting_context'
  | 'policy_compilation'
  | 'reference_mining'
  | 'implementation_scaffold';

export interface SourceRelationship {
  source_id: string | null;
  role: SourceRelationshipRole;
  note: string | null;
}

export interface EvidenceItem {
  evidence_id: string;
  source_id: string | null;
  locator: string;
  locator_type: EvidenceLocatorType;
  value_text: string | null;
  extraction_method: ExtractionMethod;
  extracted_by: string;
  extracted_at: string;
  qa_status: CatalogQaStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string | null;
}

export type CalculatorValueRole =
  | 'source-backed default'
  | 'current calculator default'
  | 'placeholder default'
  | 'user-entered value'
  | 'derived value'
  | 'source-backed option'
  | 'screening assumption';

export interface SourceRecord {
  source_id: string;
  short_citation: string;
  title: string;
  year: number | null;
  publisher: string | null;
  doi: string | null;
  url: string | null;
  zotero_item_key: string | null;
  zotero_collection_path: string | null;
  zotero_attachment_keys: string[];
  zotero_status: ZoteroStatus;
  external_file_hint: string | null;
  file_storage: SourceFileStorage;
  notes: string | null;
  authority_scope: SourceAuthorityScope;
  source_authority_tier?: SourceAuthorityTier;
  currentness_status: SourceCurrentnessStatus;
  version: string | null;
  page_last_modified: string | null;
  checked_at: string | null;
  conflict_rule: string | null;
  supersedes_source_ids: string[];
  calculator_source_role?: CalculatorSourceRole;
  canonical_source_status?: CanonicalSourceStatus;
  bc_protocol_alignment?: string | null;
  bc_protocol_basis?: string | null;
  source_crystallization_date?: string | null;
}

export interface EquationRecord {
  equation_id: string;
  pathway: ProvenancePathway;
  display_name: string;
  equation_latex: string;
  plain_language: string;
  input_keys: string[];
  output_keys: string[];
  unit_notes: string;
  source_ids: string[];
  applicability: string;
  qa_status: CatalogQaStatus;
  evidence_items: EvidenceItem[];
  review_notes: string;
  evidence_support_status: EvidenceSupportStatus;
  source_relationships?: SourceRelationship[];
  receptor_groups?: string[];
  population_groups?: string[];
  species_groups?: string[];
  assumption_tags?: string[];
}

export interface ParameterValueRecord {
  parameter_value_id: string;
  substance_key: string;
  pathway: ProvenancePathway;
  input_key: string;
  display_name: string;
  value: number | string;
  unit: string;
  value_type: ParameterValueType;
  candidate_group_id: string;
  default_status: DefaultStatus;
  evidence_support_status: EvidenceSupportStatus;
  extraction_status: ExtractionStatus;
  qa_status: CatalogQaStatus;
  source_ids: string[];
  canonical_source_ids?: string[];
  compilation_source_ids?: string[];
  equation_ids: string[];
  jurisdiction: string;
  applicability: string;
  uncertainty: string | null;
  evidence_items: EvidenceItem[];
  review_notes: string;
  source_authority_tier?: SourceAuthorityTier;
  canonical_source_status?: CanonicalSourceStatus;
  bc_protocol_alignment?: string | null;
  bc_protocol_basis?: string | null;
  source_crystallization_date?: string | null;
  source_relationships?: SourceRelationship[];
  receptor_groups?: string[];
  population_groups?: string[];
  species_groups?: string[];
  assumption_tags?: string[];
}

export interface CalculatorUsedValue {
  input_key: string;
  label: string;
  value: number | string | null;
  unit?: string;
  role: CalculatorValueRole;
  pathway?: ProvenancePathway;
  substance_key?: string;
  note?: string;
}

export interface ResolvedProvenanceRow {
  input_key: string;
  label: string;
  current_value: string;
  role: CalculatorValueRole;
  catalog_record: ParameterValueRecord | null;
  sources: SourceRecord[];
  evidence_items: EvidenceItem[];
  evidence_support_status: EvidenceSupportStatus;
  qa_status: CatalogQaStatus | 'not_cataloged';
  default_status: DefaultStatus | 'not_cataloged';
  candidate_group_id: string | null;
  note: string | null;
}

export type EvidenceLibraryViewMode =
  | 'by-parameter'
  | 'sources'
  | 'source-leads'
  | 'values'
  | 'equations'
  | 'assumptions';

export interface EvidenceLibraryFilters {
  search: string;
  pathways: ProvenancePathway[];
  substanceKeys: string[];
  inputKeys: string[];
  qaStatuses: CatalogQaStatus[];
  defaultStatuses: DefaultStatus[];
  evidenceSupportStatuses: EvidenceSupportStatus[];
  extractionStatuses: ExtractionStatus[];
  jurisdictions: string[];
  authorityScopes: SourceAuthorityScope[];
  sourceAuthorityTiers: SourceAuthorityTier[];
  sourceRoles: CalculatorSourceRole[];
  canonicalSourceStatuses: CanonicalSourceStatus[];
  bcProtocolAlignments: string[];
  currentnessStatuses: SourceCurrentnessStatus[];
  zoteroStatuses: ZoteroStatus[];
  receptorGroups: string[];
  populationGroups: string[];
  speciesGroups: string[];
  sourceIds: string[];
  parameterValueIds: string[];
  candidateGroupIds: string[];
  equationIds: string[];
}

export type EvidenceLibraryFilterRequest = Partial<
  Omit<EvidenceLibraryFilters, 'search'>
> & {
  search?: string;
};

export type CalculatorReceipt = {
  pathwayLabel: string;
  substanceLabel: string;
  inputKeys: string[];
  frameLabel: string;
};

// AuditEntry is used by the source-lead promotion workflow.
// Records are local-state only and are not written to Supabase.
export interface AuditEntry {
  action: string;
  actor: string;
  timestamp: string;
  note: string | null;
}
