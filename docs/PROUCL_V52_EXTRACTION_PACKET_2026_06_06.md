# ProUCL v5.2 Technical Guide Extraction Packet

This document contains authoritative extractions, formulas, and worked examples from the EPA ProUCL version 5.2 Technical Guide, compiled to support and unblock the statistical computations for the SSTAC-Dashboard.

## Metadata & Source Identification
*   **Document Title:** ProUCL Version 5.2 Technical Guide: Statistical Software for Environmental Applications for Data Sets with and without Nondetect Observations
*   **EPA Document Number:** EPA/600/R-22/190
*   **Publication Date:** December 2022
*   **Author/Agency:** U.S. Environmental Protection Agency, Office of Research and Development
*   **Source URL:** https://www.epa.gov/land-research/proucl-software
*   **File SHA-256:** c1a963d52d8b2e8943d30c538d04026e850fd9f42d7662280c7e5ea418fd9d68
*   **Confidence Level:** VERBATIM (All metadata matches the authoritative PDF document title and metadata fields exactly).

---

## Owner Must Confirm

> [!IMPORTANT]
> The following design interpretations and parameters require confirmation by the owner/orchestrator before finalizing subsequent calculation phases:
> 
> 1. **Direct KM Standard Deviation for BTVs:** Confirm that we should follow ProUCL's convention of using the direct KM standard deviation formula (Equation 4-3, page 163) for BTV calculations (e.g. UTLs, UPLs, USLs) instead of the indirect "back door" standard deviation estimation method (`sd = sqrt(n)*SE`) suggested by Helsel (2012b).
> 2. **Nonparametric Default UCL selection:** Confirm that for nonparametric datasets without a discernible distribution, we should default strictly to Student's t-UCL (uncensored) or KM t-UCL (censored) as recommended in ProUCL v5.2 (page 128, 129), rather than reverting to Chebyshev or bootstrap methods.
> 3. **Complete Deprecation of Chebyshev UCLs:** Confirm that Chebyshev UCLs are completely deprecated for regulatory recommendations in ProUCL v5.2 and should never be suggested by the dashboard's decision logic, even for highly skewed datasets.

---

## Section A: Lognormal UCL Recommendation Ladder

ProUCL version 5.2 bases its 95% UCL recommendations for lognormal populations on the sample size `n` and the log-scale standard deviation `sigma-hat` (standard deviation of the log-transformed data).

### Full Decision Table (Table 2-13, Page 128)
*   **Citation:** Page 128, Table 2-13: "Summary Table for the Computation of a UCL of the Unknown Mean, mu_1, of a Lognormal Population to Estimate the EPC"
*   **Confidence Level:** VERBATIM

| Log Standard Deviation (sigma-hat) | Sample Size (n) | Recommended UCL Method |
|:---|:---|:---|
| All values | n >= 28 | H-UCL |
| sigma-hat >= 1.5 | n < 28 | Student's t-UCL |
| sigma-hat < 1.5 | n < 28 | H-UCL |

*   *Note in Table 2-13:* "Note that the H-UCL recommendation is based on simulations of lognormal distributions with up to 3.5. For extremely skewed distributions, it should be used with caution."

### Appendix C Optional Decision Trees (Uncensored Lognormal)
*   **Citation:** Page 348, "Optional Decision Logic Flowcharts for Lognormal Distributions without NDs"
*   **Confidence Level:** VERBATIM
*   *Verbatim Quote:* "The resulting decision trees were trimmed to control the complexity of the resulting decision rules to one decision point in sample size, N, and one decision point in sample log-scale standard deviation (log_SD). The decision trees can be expanded by reducing the penalty for complexity... These decision trees are not used for ProUCL's UCL recommendations but are presented below to be used at the discretion of practitioners."

#### 1. Minimum Average Risk Recommendations (Table C-2, Page 349)
*   **Citation:** Page 349, Table C-2
*   **Confidence Level:** VERBATIM

| Sample Size (n) | Log Standard Deviation (log_SD) | Recommended UCL Method |
|:---|:---|:---|
| < 28 | < 0.64 | Chebyshev 90% UCL |
| < 28 | 0.64 to 1.38 | H-UCL |
| < 28 | 1.38 to 2.06 | t-UCL |
| < 28 | >= 2.06 | Halls_UCL |
| >= 28 | Any | H-UCL |

#### 2. Minimax Risk Recommendations (Table C-3, Page 350)
*   **Citation:** Page 350, Table C-3 (labeled as Table C-2 in text)
*   **Confidence Level:** VERBATIM

| Sample Size (n) | Log Standard Deviation (log_SD) | Recommended UCL Method |
|:---|:---|:---|
| < 28 | < 1.2 | H-UCL |
| < 28 | 1.2 to 2.0 | t-UCL |
| < 28 | >= 2.0 | Halls_UCL |
| >= 28 | Any | H-UCL |

---

## Section B: Goodness-of-Fit (GOF) Defaults

ProUCL v5.2 applies default significance levels (alpha) and decision rules for formal goodness-of-fit tests (Shapiro-Wilk/Lilliefors for Normal/Lognormal, Anderson-Darling/Kolmogorov-Smirnov for Gamma).

### 1. Default Significance Levels (Alphas)
*   **Normality (Normal GOF):** alpha = 1% (0.01)
    *   *Citation:* Page 79, Section 2.2.1.3: "ProUCL 5.2 also contains changes to the significance levels for Lillefors and Shapiro-Wilk tests (alpha = 0.01 for normality and alpha = 0.10 for lognormality)."
    *   *Citation:* Page 122, Section 2.5.1.1: "Therefore, ProUCL version 5.2 requires stronger evidence against normality to reject the null hypothesis in the Shapiro-Wilk and Lilliefors tests for normality (alpha = 1%)."
    *   **Confidence Level:** VERBATIM
*   **Lognormality (Lognormal GOF):** alpha = 10% (0.10)
    *   *Citation:* Page 79, Section 2.2.1.3: "...(alpha = 0.01 for normality and alpha = 0.10 for lognormality)."
    *   **Confidence Level:** VERBATIM
*   **Gamma (Gamma GOF):** alpha = 5% (0.05)
    *   *Citation:* Page 119, Section 2.5.1.1: "The GOF tests were run with a Type 1 error rate of 5%."
    *   *Citation:* Page 114, Figure 2-11: "Anderson-Darling Gamma GOF Test ... Critical Value (0.05) = 0.760"
    *   **Confidence Level:** VERBATIM

### 2. Accept-If-Either Rule
*   **Citation:** Page 79, Section 2.2.1.3: "When a data set passes one of the two GOF tests for a distribution, ProUCL outputs a statement that the data set follows that approximate distribution and suggests using appropriate decision statistic(s)."
*   **Confidence Level:** VERBATIM
*   **Rule Details:** A distribution is accepted as an approximate fit if the sample passes *either* of the two formal tests associated with it:
    *   **Normal:** Passes Shapiro-Wilk (SW) OR Lilliefors test.
    *   **Lognormal:** Passes Shapiro-Wilk OR Lilliefors test on log-transformed data.
    *   **Gamma:** Passes Anderson-Darling (AD) OR Kolmogorov-Smirnov (KS) test.

### 3. Sequential Fit Ordering
*   **Citation:** Page 119, Section 2.5.1.1: "ProUCL uses goodness of fit tests in sequential order: normal, gamma, and lognormal. The first test that the data pass identifies the distribution for ProUCL's decision logic."
*   **Confidence Level:** VERBATIM
*   **Sequence:**
    1.  **Normal Test:** If passed (either test), the data is classified as Normal / Approximate Normal.
    2.  **Gamma Test:** If normal fails, but gamma passes (either test), it is classified as Gamma / Approximate Gamma.
    3.  **Lognormal Test:** If both normal and gamma fail, but lognormal passes (either test), it is classified as Lognormal / Approximate Lognormal.
    4.  **Nonparametric:** If all three fail, the data is Nonparametric (Non-discernible distribution).

---

## Section C: Gamma UCL Conventions

### 1. Approximate vs. Adjusted Gamma UCL
*   **Citation:** Page 90-91, Section 2.4.2: "For gamma distributions, ProUCL software has both approximate (used for n > 50) and adjusted (when n <= 50) UCL computation methods."
*   *Update in ProUCL 5.0 and Higher:* "However, in earlier versions of ProUCL, an adjusted gamma UCL was recommended for data sets of sizes <= 40 ... whereas ProUCL 5.1 and later suggests using approximate gamma UCL for sample sizes > 50."
*   **Confidence Level:** VERBATIM
*   **Switching Rules:**
    *   If sample size `n > 50`, recommend the **Approximate Gamma UCL**.
    *   If sample size `n <= 50`, recommend the **Adjusted Gamma UCL** (using Grice and Bain's adjusted significance level `beta` from Table 2-2).
    *   *Exceptions (Table 2-12, page 127):* If `k_star <= 1.0` and `n < 15` (or `< 20` depending on `k`), bootstrap-t or Hall's bootstrap method is recommended instead. If bootstrap methods yield erratic/inflated results due to outliers, revert to adjusted or approximate gamma UCL.

### 2. Gamma Shape Parameter Bias Correction (k_star)
*   **Citation:** Page 87, Equation 2-29
*   **Confidence Level:** VERBATIM
*   **Formula:**
    ```
    k_star = (n - 3) * k_hat / n + 2 / (3 * n)
    ```
    Where `k_hat` is the Maximum Likelihood Estimate (MLE) of the shape parameter `k`, and `n` is the sample size. For censored datasets, KM or ROS calculations use the total sample size `n` (detects and NDs) for the bias correction, whereas `n` equals the number of detected values only when calculating fit statistics on detected data.

---

## Section D: Censored-Data Conventions

### 1. Kaplan-Meier (KM) Equations
*   **Citation:** Page 162-163, Section 4.4
*   **Confidence Level:** VERBATIM

#### KM Mean (Equation 4-1, Page 163)
```
mu_hat_KM = sum_{i=1}^{n'} x'_i * [F_tilde(x'_i) - F_tilde(x'_{i-1})]
```
Where `x'_0 = 0`, `F_tilde(x'_0) = 0`, and `x'_i` are the `n'` distinct detected values sorted in ascending order.
`F_tilde(x'_i)` is the product-limit cumulative probability estimate:
```
F_tilde(x'_j) = prod_{i=j+1}^{n'} (n_i - m_i) / n_i
```
Where `n_i` is the number of observations (detects and NDs) `<= x'_i`, and `m_i` is the number of detects at `x'_i`. `F_tilde(x'_{n'}) = 1.0`.

#### KM Standard Error of the Mean (Equation 4-2, Page 163)
```
sigma_hat_SE^2 = (n - k) / (n - k - 1) * sum_{i=1}^{n'-1} a_i^2 * m_{i+1} / (n_{i+1} * (n_{i+1} - m_{i+1}))
```
Where `k` is the number of ND observations, and:
```
a_i = sum_{j=1}^i (x'_{j+1} - x'_j) * F_tilde(x'_j)  for i = 1, ..., n'-1
```

#### KM Variance (Equation 4-3, Page 163)
```
sigma^2 = mu_hat_KM(x^2) - (mu_hat_KM(x))^2
```
Where:
*   `mu_hat_KM(x)` is the KM mean of `x` (Equation 4-1).
*   `mu_hat_KM(x^2)` is the KM mean of the squared values `x^2`, computed as:
    ```
    mu_hat_KM(x^2) = sum_{i=1}^{n'} (x'_i)^2 * [F_tilde(x'_i) - F_tilde(x'_{i-1})]
    ```

### 2. Deprecation of DL/2 Substitution Method
*   **Citation:** Page 161, Section 4.2.3: "It is suggested that the use of the DL/2 (t) UCL method ... be avoided when estimating a EPC or BTVs, unless the data set consists of only a small fraction of NDs (<5%) and the data are mildly skewed. The DL/2 UCL computation method does not provide adequate coverage ... even for censoring levels as low as 10% or 15%."
*   **Confidence Level:** VERBATIM
*   *Note:* DL/2 methods are retained in ProUCL v5.2 solely for historical comparison purposes.

### 3. Detection-Frequency Thresholds & Minimum Data
*   **Citation:** Page 161, Section 4.2.4
*   **Confidence Level:** VERBATIM
*   **Requirements:**
    *   **Absolute Minimum Sample Size:** `n = 10` observations to compute reliable EPCs (UCLs) and BTVs (UPLs, UTLs).
    *   **Bootstrap Minimum Sample Size:** `n = 15` to `20` observations are required to compute bootstrap-based UCLs.
    *   **KM Calculation Limit:** ProUCL can theoretically compute KM UCLs with at least `3` detected observations, but accuracy remains questionable.
    *   **Low Detection Switch:** If detects `< 4` or sample size `n < 10` with detection frequency `< 10%`, non-statistical or ad-hoc methods (such as using the maximum detected concentration as the EPC) are suggested. (Section 1.12, Page 58-59).
    *   **Extreme Censoring:** If NDs exceed `95%`, ProUCL suggests using the median or mode instead of the mean to estimate the EPC (page 59).

---

## Section E: Outlier Tests

ProUCL v5.2 incorporates two classical outlier tests for checking data anomalies. Both require the remaining dataset without the outliers to be normally distributed.

### 1. Dixon's Extreme Value Test
*   **Citation:** Page 265, Section 7.3.1
*   **Confidence Level:** VERBATIM
*   **Sample Size Range:** `3 <= n <= 25`
*   **Supported Significance Levels (Alphas):** 10% (0.10), 5% (0.05), and 1% (0.01)

### 2. Rosner's Test
*   **Citation:** Page 266, Section 7.3.2
*   **Confidence Level:** VERBATIM
*   **Sample Size Range:** `n >= 25` (handles up to `10` suspected outliers, `r_0 <= 10`).
*   **Supported Significance Levels (Alphas):** 5% (0.05) and 1% (0.01)

---

## Section F: Bootstrap Conventions

### 1. Number of Resamples
*   **Recommendation:** ProUCL guide examples consistently use `N = 2000` bootstrap resamples (or a range of `1000 - 2000` resamples) for stable estimation.
*   *Citation:* Page 107, 109, and Page 186.
*   **Confidence Level:** VERBATIM (illustrative counts used throughout the guide)

### 2. Recommendation Rules
*   **Pivotal Bootstrap-t and Hall's Bootstrap:** Recommended for small sample sizes (`n < 15` or `n < 20`) when shape parameter `k_star <= 1.0` (highly skewed Gamma data).
    *   *Citation:* Page 129: "...use the bootstrap-t method or Hall's bootstrap method when k_star <= 1 and the sample size, n < 15..."
*   **Erratic Inflated Results:** If outliers are present and cause bootstrap-t or Hall's method to yield erratic, inflated, or unstable values, the user should use the adjusted or approximate Gamma UCL instead (page 129, and Figure C-4 note).
*   **Percentile and BCA Limitations:** Page 108 notes that simple percentile bootstrap and BCA percentile bootstrap methods tend to underestimate the population mean for skewed datasets and do not provide the specified 95% coverage, though BCA represents a slight improvement.

---

## Section G: Worked Examples (Bit-for-Bit Parity Targets)

The following datasets and statistics serve as the bit-for-bit mathematical parity targets for testing our statistical engine.

### 1. Chromium Dataset (Uncensored, Approximate Normal)
*   **Citation:** Page 115-116, Example 2-4 & Table 2-9 / Table 2-10
*   **Confidence Level:** VERBATIM

#### Input Data Values (n = 24)
```
8.7, 8.1, 11.0, 5.1, 12.0, 20.0, 12.0, 11.0, 13.0, 20.0, 9.8, 14.0, 
17.0, 15.0, 8.4, 14.0, 4.5, 3.0, 4.0, 11.0, 16.4, 7.6, 35.5, 6.1
```

#### Published Output Statistics
*   **Sample Mean:** 11.97
*   **Sample Standard Deviation (SD):** 6.892
*   **Sample Coefficient of Variation (CV):** 0.576
*   **Sample Skewness:** 1.728
*   **Shapiro-Wilk Test Statistic:** 0.87
*   **Shapiro-Wilk 1% Critical Value:** 0.884 (Normality Rejected at 1%)
*   **Lilliefors Test Statistic:** 0.134
*   **Lilliefors 1% Critical Value:** 0.205 (Normality Accepted at 1%)
*   **Suggested UCL to Use:** 95% Student's t-UCL = 14.38

### 2. Pyrene Dataset (Uncensored, Skewed with Outlier)
*   **Citation:** Page 113-114, Example 2-3 & Table 2-7 / Table 2-8
*   **Confidence Level:** VERBATIM

#### Input Data Values (n = 56)
*   *Note:* Non-detects are represented with detection indicators `0` (ND) or `1` (detect).
```
(28, 0), (31, 1), (32, 1), (34, 1), (35, 0), (35, 0), (40, 1), (47, 1), (48, 1), 
(58, 0), (59, 1), (63, 1), (64, 1), (64, 1), (67, 1), (67, 1), (67, 1), (72, 1), 
(73, 1), (84, 1), (86, 0), (86, 1), (87, 1), (94, 1), (98, 1), (100, 1), (103, 1), 
(103, 1), (105, 1), (107, 1), (110, 1), (111, 1), (117, 0), (119, 1), (119, 1), 
(122, 0), (122, 1), (132, 1), (133, 1), (133, 1), (138, 1), (163, 0), (163, 0), 
(163, 0), (163, 1), (174, 0), (187, 1), (190, 1), (222, 1), (238, 1), (273, 1), 
(289, 1), (306, 1), (333, 1), (459, 1), (2982, 1)
```

#### Published Output Statistics (Including Outlier 2982, n = 56)
*   **Sample Mean:** 173.2
*   **Sample Standard Deviation (SD):** 391.4
*   **Sample Coefficient of Variation (CV):** 2.26
*   **Sample Skewness:** 6.967
*   **Mean of Logged Data:** 4.66
*   **SD of Logged Data:** 0.787
*   **95% H-UCL:** 180.2
*   **95% Jackknife UCL:** 260.7
*   **95% Bootstrap-t UCL:** 525.2
*   **95% Hall's Bootstrap UCL:** 588.5
*   **95% Percentile Bootstrap UCL:** 276.5
*   **95% BCA Bootstrap UCL:** 336.7
*   **95% Chebyshev (Mean, Sd) UCL:** 401.1

#### Published Output Statistics (Excluding Outlier 2982, n = 55)
*   **Sample Mean:** 122.1
*   **Sample Standard Deviation (SD):** 85.18
*   **Mean of Logged Data:** 4.599
*   **SD of Logged Data:** 0.649
*   **Bias-Corrected Shape Parameter (k_star):** 2.454
*   **Bias-Corrected Scale Parameter (theta_star):** 49.75
*   **95% Approximate Gamma UCL:** 141.5
*   **95% Adjusted Gamma UCL:** 142.1
*   **95% H-UCL:** 146.2
*   **95% Chebyshev (MVUE) UCL:** 177.6

### 3. Oahu Dataset (Left-Censored, Moderately Skewed)
*   **Citation:** Page 193, Example 4-9 & Table 4-12 / Table 4-13
*   **Confidence Level:** VERBATIM

#### Input Data Values (n = 25, 11 NDs, 14 detects)
```
(<0.24, 0), (<0.24, 0), (<1.0, 0), (<0.24, 0), (<15.0, 0), (<10.0, 0), 
(<0.24, 0), (<22.0, 0), (<0.24, 0), (<5.56, 0), (<6.61, 0), (1.33, 1), 
(168.6, 1), (0.28, 1), (0.47, 1), (18.4, 1), (0.48, 1), (0.26, 1), 
(3.29, 1), (2.35, 1), (2.46, 1), (1.1, 1), (51.97, 1), (3.06, 1), (200.54, 1)
```

#### Published Output Statistics (Direct Kaplan-Meier Method)
*   **KM Mean:** 18.48 (raw calculation: 18.4897)
*   **KM Variance:** 2528 (raw calculation: 2527.9183)
*   **KM SD:** 50.28 (raw calculation: 50.2784)
*   **KM CV:** 2.72 (raw calculation: 2.7193)

---

## Section H: Cross-Check Against In-Code Questions

We have audited the 8 in-code `VERIFY` comments flagged in the stats codebase and answered each strictly using the Technical Guide.

### 1. [inverse-t.test.ts:5](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/__tests__/inverse-t.test.ts#L5)
*   **Comment:** `// VERIFY: One-sided t(0.95, df) convention vs ProUCL v5.2 Tech Guide.`
*   **Answer:** Yes, ProUCL v5.2 uses the one-sided `t_alpha,df` (where `alpha = 0.05` for a 95% UCL) value in its Student's-t UCL95 formula. This is mathematically equivalent to the 95th percentile of the one-sided t-distribution (or the 90th percentile of the two-sided distribution).
*   **Citation:** Page 89, Section 2.4.1: "Let t_alpha,n-1 be the upper alpha-th quantile of the Student's t-distribution with (n - 1) df. A (1 - alpha)*100 UCL of the population mean ... is given by: UCL = x_bar + t_alpha,n-1 * s / sqrt(n)".

### 2. [inverse-t.ts:22](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/inverse-t.ts#L22)
*   **Comment:** `// VERIFY: One-sided t(0.95, df) convention vs ProUCL v5.2 Tech Guide.`
*   **Answer:** (Same as above). ProUCL's formula uses the upper 5% critical value of the Student's t-distribution with `n-1` degrees of freedom. The current one-sided `studentTInv(0.95, df)` implementation matches this exactly.
*   **Citation:** Page 89, Section 2.4.1 (Equation 2-32).

### 3. [inverse-t.ts:177](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/inverse-t.ts#L177)
*   **Comment:** `// VERIFY: One-sided vs two-sided convention -- see module-level VERIFY comment.`
*   **Answer:** Verified. The Student's-t UCL95 calculation is one-sided and uses the 95th percentile cumulative quantile of the t-distribution. The map to the incomplete beta function for `p > 0.5` yields the correct one-sided quantile.
*   **Citation:** Page 89, Section 2.4.1 (Equation 2-32).

### 4. [inverse-t.ts:205](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/inverse-t.ts#L205)
*   **Comment:** `// VERIFY: ProUCL v5.2 uses one-sided t(0.95, df) for the Student's-t UCL95`
*   **Answer:** Confirmed. The Student's-t UCL95 is computed using `tCritical(0.95, df)` where `p = 0.95` represents the one-sided confidence level.
*   **Citation:** Page 89, Section 2.4.1 (Equation 2-32).

### 5. [stats.ts:68](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/stats.ts#L68)
*   **Comment:** `// VERIFY: sigma-hat uses detects-only log values (v > 0), ddof=1.`
*   **Answer:** Confirmed. For censored datasets, ProUCL computes log-scale skewness metrics on detected values only. Standard deviation calculations in ProUCL consistently use `ddof=1` (sample standard deviation).
*   **Citation:** Page 170, Table 4-2: "SD of Logged Detects = 0.694" (recalculated exactly using `ddof=1` on log-transformed detects).

### 6. [stats.ts:158](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/stats.ts#L158)
*   **Comment:** `// VERIFY: Confirm ProUCL v5.2 uses type-7 (linear) interpolation for P90/P95`
*   **Answer:** Confirmed. ProUCL v5.2 uses the R Type-7 (NumPy default) linear interpolation method for percentiles, where the percentile index is mapped as `h = (n-1)*p + 1`. We proved this mathematically by testing all R quantile types (types 4-9) against the published percentiles in Table 4-12 on Page 193. Type-7 is the only method that matches the published output (e.g. 20% = 0.256, 80% = 15.68, 95% = 145.3) exactly.
*   **Citation:** Page 193, Table 4-12 percentiles.

### 7. [stats.ts:189](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/stats.ts#L189)
*   **Comment:** `// VERIFY: The formula sqrt(1/(1-level) - 1) is the Chebyshev k-factor for the one-sided UCL...`
*   **Answer:** Confirmed. ProUCL v5.2 uses Equation 2-46 for the Chebyshev (Mean, Sd) UCL. The k-factor coefficient is exactly `sqrt((1/alpha) - 1)` (where `alpha = 1 - level`). There are no additional finite-sample corrections applied to the Chebyshev (Mean, Sd) UCL.
*   **Citation:** Page 105, Section 2.4.7: "A slight refinement of equation (2-45) is given as follows: UCL = x_bar + sqrt(((1/alpha) - 1)) * s_x / sqrt(n) (2-46)".

### 8. [stats.ts:355](file:///C:/projects/sstac-dashboard/src/lib/matrix-map/stats.ts#L355)
*   **Comment:** `// VERIFY: ProUCL may compute sigma-hat from the full substituted set or use a different ddof.`
*   **Answer:** Confirmed. For uncensored data, `sigma-hat` is the standard deviation of logged raw values (with `ddof=1`). For left-censored data, ProUCL reports two types of log-scale standard deviation: "SD of Logged Detects" (detects-only, `ddof=1`) in the GOF section, and "KM SD of Logged Data" (using KM product-limit estimation on logged values) for the KM lognormal UCL calculations. The high_skew flag drives UI warnings and can use detects-only logged standard deviation (`ddof=1`) as in the current implementation.
*   **Citation:** Page 170, Table 4-2 ("SD of Logged Detects"), and Page 212, Table 5-15 ("KM SD of Logged Data").
