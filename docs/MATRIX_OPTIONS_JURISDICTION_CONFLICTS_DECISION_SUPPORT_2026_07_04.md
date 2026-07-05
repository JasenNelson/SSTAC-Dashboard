# Matrix Options Jurisdiction Conflicts Decision-Support Document (2026-07-04)

This document maps and compares competing toxicity values for substances flagged as having jurisdiction conflicts.
It provides details on the competing values, their catalog IDs, citations, jurisdictions, and notes on the principles in tension.

## Core Selection Principles in Tension
When multiple approved values exist for a substance:
1. **Jurisdictional Priority**: Preferring Canadian federal/provincial guidance (Health Canada, ECCC, FCSAP) over US EPA for Canadian regulatory frameworks.
2. **Most Protective Policy**: Selecting the value that results in the most conservative standard (lower RfD/RfC for non-cancer pathways, or higher SF/IUR for cancer pathways).

---

## Oral Reference Doses (rfd_oral)

### Substance: Barium (`barium`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-barium-hh-direct-rfd`, `pv-iris-barium-hh-food-rfd` | 0.2 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |
| `pv-hc-barium-hh-direct-rfd`, `pv-hc-barium-hh-food-rfd` | 0.19 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |

### Substance: Benzo[a]pyrene (`benzo_a_pyrene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-bap-hh-direct-rfd-tdi`, `pv-hc-bap-hh-food-rfd-tdi`, `pv-iris-bap-hh-direct-rfd-neuro`, `pv-iris-bap-hh-food-rfd-neuro` | 0.0003 | mg/kg-bw/day | Canada_federal, US_federal | Health Canada TRVs v4.0, 2025, US EPA IRIS RfD table, live | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-bap-hh-direct-rfd-repro`, `pv-iris-bap-hh-food-rfd-repro` | 0.0004 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |
| `pv-iris-bap-hh-direct-rfd-immune`, `pv-iris-bap-hh-food-rfd-immune` | 0.002 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Cadmium (`cadmium`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-cadmium-hh-direct-rfd-tdi`, `pv-hc-cadmium-hh-food-rfd-tdi` | 0.0008 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-iris-cadmium-hh-direct-rfd-food`, `pv-iris-cadmium-hh-food-rfd-food` | 0.001 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |
| `pv-iris-cadmium-hh-direct-rfd-water`, `pv-iris-cadmium-hh-food-rfd-water` | 0.0005 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |

### Substance: Carbon Tetrachloride (`carbon_tetrachloride`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-carbon_tetrachloride-hh-direct-rfd`, `pv-hc-carbon_tetrachloride-hh-food-rfd` | 0.00071 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-carbon_tetrachloride-hh-direct-rfd`, `pv-iris-carbon_tetrachloride-hh-food-rfd` | 0.004 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Chlorobenzene (`chlorobenzene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-chlorobenzene-hh-direct-rfd`, `pv-iris-chlorobenzene-hh-food-rfd` | 0.02 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |
| `pv-hc-chlorobenzene-hh-direct-rfd`, `pv-hc-chlorobenzene-hh-food-rfd` | 0.43 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |

### Substance: Chromium (Trivalent) (`chromium_trivalent`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-chromium-trivalent-hh-direct-rfd`, `pv-iris-chromium-trivalent-hh-food-rfd` | 1.5 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |
| `pv-hc-chromium_trivalent-hh-direct-rfd`, `pv-hc-chromium_trivalent-hh-food-rfd` | 0.3 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |

### Substance: 1,2-Dichlorobenzene (`dichlorobenzene_1_2`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-dichlorobenzene_1_2-hh-direct-rfd`, `pv-hc-dichlorobenzene_1_2-hh-food-rfd` | 0.43 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-iris-dichlorobenzene_1_2-hh-direct-rfd`, `pv-iris-dichlorobenzene_1_2-hh-food-rfd` | 0.09 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |

### Substance: 1,1-Dichloroethylene (`dichloroethylene_1_1`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-dichloroethylene_1_1-hh-direct-rfd`, `pv-hc-dichloroethylene_1_1-hh-food-rfd` | 0.003 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-dichloroethylene_1_1-hh-direct-rfd`, `pv-iris-dichloroethylene_1_1-hh-food-rfd` | 0.05 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Dichloromethane (`dichloromethane`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-dichloromethane-hh-direct-rfd`, `pv-hc-dichloromethane-hh-food-rfd` | 0.014 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-iris-dichloromethane-hh-direct-rfd`, `pv-iris-dichloromethane-hh-food-rfd` | 0.006 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |

### Substance: Ethylbenzene (`ethylbenzene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-ethylbenzene-hh-direct-rfd`, `pv-hc-ethylbenzene-hh-food-rfd` | 0.022 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-ethylbenzene-hh-direct-rfd`, `pv-iris-ethylbenzene-hh-food-rfd` | 0.1 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Manganese (`manganese`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-manganese-hh-direct-rfd`, `pv-hc-manganese-hh-food-rfd` | 0.025 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-manganese-hh-direct-rfd`, `pv-iris-manganese-hh-food-rfd` | 0.14 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Methylmercury (`methylmercury`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-mehg-hh-direct-rfd-sensitive`, `pv-hc-mehg-hh-food-rfd-sensitive` | 0.0002 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-hc-mehg-hh-food-rfd-adult`, `pv-hc-methylmercury-hh-direct-rfd` | 0.00047 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-food, human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-iris-mehg-hh-direct-rfd`, `pv-iris-mehg-hh-food-rfd` | 0.0001 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |

### Substance: Tetrachloroethylene (`tetrachloroethylene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-tetrachloroethylene-hh-direct-rfd`, `pv-iris-tetrachloroethylene-hh-food-rfd` | 0.006 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |
| `pv-hc-tetrachloroethylene-hh-direct-rfd`, `pv-hc-tetrachloroethylene-hh-food-rfd` | 0.0047 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |

### Substance: Toluene (`toluene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-toluene-hh-direct-rfd`, `pv-hc-toluene-hh-food-rfd` | 0.0097 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-toluene-hh-direct-rfd`, `pv-iris-toluene-hh-food-rfd` | 0.08 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Aroclor 1254 (PCBs) (`total_pcbs_aroclor_1254`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-pcb-hh-direct-rfd-nondioxin`, `pv-hc-pcb-hh-food-rfd-nondioxin` | 0.00001 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-pcb-hh-direct-rfd-aroclor1254`, `pv-iris-pcb-hh-food-rfd-aroclor1254` | 0.00002 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Trichloroethylene (`trichloroethylene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-trichloroethylene-hh-direct-rfd`, `pv-iris-trichloroethylene-hh-food-rfd` | 0.0005 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |
| `pv-hc-trichloroethylene-hh-direct-rfd`, `pv-hc-trichloroethylene-hh-food-rfd` | 0.00146 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |

### Substance: Xylenes (`xylenes`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-xylenes-hh-direct-rfd`, `pv-hc-xylenes-hh-food-rfd` | 0.013 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-xylenes-hh-direct-rfd`, `pv-iris-xylenes-hh-food-rfd` | 0.2 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Zinc (`zinc`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-zinc-hh-direct-ul-child` | 0.51 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-hc-zinc-hh-food-ul-adult` | 0.57 | mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-iris-zinc-hh-direct-rfd`, `pv-iris-zinc-hh-food-rfd` | 0.3 | mg/kg-bw/day | US_federal | US EPA IRIS RfD table, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |

---

## Oral Slope Factors (sf_oral)

### Substance: Inorganic Arsenic (`arsenic_inorganic`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-arsenic-hh-direct-sf`, `pv-hc-arsenic-hh-food-sf` | 1.8 | per mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |
| `pv-iris-arsenic-hh-direct-sf`, `pv-iris-arsenic-hh-food-sf` | 32 | per mg/kg-bw/day | US_federal | US EPA IRIS chemical details, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |

### Substance: Benzo[a]pyrene (`benzo_a_pyrene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-bap-hh-direct-sf`, `pv-hc-bap-hh-food-sf` | 1.289 | per mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |
| `pv-iris-bap-hh-direct-sf`, `pv-iris-bap-hh-food-sf` | 2 | per mg/kg-bw/day | US_federal | US EPA IRIS chemical details, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |

### Substance: Dichloromethane (`dichloromethane`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-dichloromethane-hh-direct-sf`, `pv-hc-dichloromethane-hh-food-sf` | 0.002 | per mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |
| `pv-iris-dichloromethane-hh-direct-sf`, `pv-iris-dichloromethane-hh-food-sf` | 0.0033 | per mg/kg-bw/day | US_federal | US EPA IRIS chemical details, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |

### Substance: Trichloroethylene (`trichloroethylene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-trichloroethylene-hh-direct-sf`, `pv-iris-trichloroethylene-hh-food-sf` | 0.052 | per mg/kg-bw/day | US_federal | US EPA IRIS chemical details, live | human-health-direct, human-health-food | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |
| `pv-hc-trichloroethylene-hh-direct-sf`, `pv-hc-trichloroethylene-hh-food-sf` | 0.000811 | per mg/kg-bw/day | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct, human-health-food | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |

---

## Inhalation Reference Concentrations (rfc_inh)

### Substance: Benzo[a]pyrene (`benzo_a_pyrene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-benzo_a_pyrene-hh-direct-rfc`, `pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2` | 0.000002 | mg/m3 | Canada_federal, US_federal | Health Canada TRVs v4.0, 2025, US EPA IRIS chemical details, live | human-health-direct | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-benzo_a_pyrene-hh-direct-rfc` | 0.000003 | mg/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

### Substance: Chromium (Hexavalent) (`chromium_hexavalent`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-chromium-hexavalent-hh-direct-rfc` | 0.00003 | mg/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |
| `pv-hc-chromium_hexavalent-hh-direct-rfc` | 0.0001 | mg/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |

### Substance: Ethylbenzene (`ethylbenzene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-ethylbenzene-hh-direct-rfc` | 2 | mg/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |
| `pv-iris-ethylbenzene-hh-direct-rfc` | 1 | mg/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |

### Substance: Naphthalene (`naphthalene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-naphthalene-hh-direct-rfc` | 0.003 | mg/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Most Protective)**: Aligns with US baseline; Lower value (most protective). |
| `pv-hc-naphthalene-hh-direct-rfc` | 0.01 | mg/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Higher value (less protective). |

### Substance: Toluene (`toluene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-toluene-hh-direct-rfc` | 2.3 | mg/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Lower value (most protective). |
| `pv-iris-toluene-hh-direct-rfc` | 5 | mg/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Less Protective)**: Aligns with US baseline; Higher value (less protective). |

---

## Inhalation Unit Risks (iur_inh)

### Substance: Inorganic Arsenic (`arsenic_inorganic`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-arsenic_inorganic-hh-direct-iur` | 0.0064 | per ug/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Higher value (most protective). |
| `pv-iris-arsenic_inorganic-hh-direct-iur` | 0.0043 | per ug/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Less Protective)**: Aligns with US baseline; Lower value (less protective). |

### Substance: Benzo[a]pyrene (`benzo_a_pyrene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-benzo_a_pyrene-hh-direct-iur` | 0.0006 | per ug/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |
| `pv-iris-benzo_a_pyrene-hh-direct-iur` | 0.001 | per ug/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |

### Substance: Cadmium (`cadmium`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-cadmium-hh-direct-iur` | 0.004200000000000001 | per ug/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Higher value (most protective). |
| `pv-iris-cadmium-hh-direct-iur` | 0.0018 | per ug/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Less Protective)**: Aligns with US baseline; Lower value (less protective). |

### Substance: Chromium (Hexavalent) (`chromium_hexavalent`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-chromium-hexavalent-hh-direct-iur` | 0.018 | per ug/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Less Protective)**: Aligns with US baseline; Lower value (less protective). |
| `pv-hc-chromium_hexavalent-hh-direct-iur` | 0.076 | per ug/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction & Most Protective**: Aligns with Canadian priority; Higher value (most protective). |

### Substance: Dichloromethane (`dichloromethane`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-hc-dichloromethane-hh-direct-iur` | 1e-8 | per ug/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |
| `pv-iris-dichloromethane-hh-direct-iur` | 1.7e-8 | per ug/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |

### Substance: Trichloroethylene (`trichloroethylene`)

| Parameter ID | Value | Unit | Jurisdiction | Source | Pathway(s) | Tension / Notes |
|---|---|---|---|---|---|---|
| `pv-iris-trichloroethylene-hh-direct-iur` | 0.0000048 | per ug/m3 | US_federal | US EPA IRIS chemical details, live | human-health-direct | **US EPA (Most Protective)**: Aligns with US baseline; Higher value (most protective). |
| `pv-hc-trichloroethylene-hh-direct-iur` | 0.0000041000000000000006 | per ug/m3 | Canada_federal | Health Canada TRVs v4.0, 2025 | human-health-direct | **Canadian Jurisdiction (Less Protective)**: Aligns with Canadian priority; Lower value (less protective). |

---

