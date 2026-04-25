-- Migration: add-final-tax-line-items.sql
-- Adds per-line-item columns to final_tax_forms for the 8 FINAL_TAX_ITEMS
-- that previously had no DB columns and could not persist between sessions.
--
-- ITO 2001 sections: 156A, 151(1)(a), 151(1)(b), 150, 37A, 233
-- Finance Act 2025 rates used in remark columns below.
--
-- Safe to run multiple times (uses IF NOT EXISTS guards).

BEGIN;

-- ── u/s 156A  Lottery / Raffle / Quiz / Crossword winnings ──────────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS lottery_crossword_winnings_yn           VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS lottery_crossword_winnings_amount       DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lottery_crossword_winnings_tax_rate     DECIMAL(5,2)   DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS lottery_crossword_winnings_tax_amount   DECIMAL(15,2)  DEFAULT 0;

-- ── u/s 151(1)(a)  Profit on NSS / Post Office Savings ──────────────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS profit_govt_securities_yn               VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS profit_govt_securities_amount           DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_govt_securities_tax_rate         DECIMAL(5,2)   DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS profit_govt_securities_tax_amount       DECIMAL(15,2)  DEFAULT 0;

-- ── u/s 151(1)(b)  Profit on Defence Savings Certificates ───────────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS profit_defence_savings_yn               VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS profit_defence_savings_amount           DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_defence_savings_tax_rate         DECIMAL(5,2)   DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS profit_defence_savings_tax_amount       DECIMAL(15,2)  DEFAULT 0;

-- ── u/s 150  Dividend from Listed Companies ──────────────────────────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS dividend_listed_companies_yn            VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS dividend_listed_companies_amount        DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dividend_listed_companies_tax_rate      DECIMAL(5,2)   DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS dividend_listed_companies_tax_amount    DECIMAL(15,2)  DEFAULT 0;

-- ── u/s 150  Dividend from Other Companies / Mutual Funds ───────────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS dividend_other_yn                       VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS dividend_other_amount                   DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dividend_other_tax_rate                 DECIMAL(5,2)   DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS dividend_other_tax_amount               DECIMAL(15,2)  DEFAULT 0;

-- ── u/s 37A  Capital Gain on Securities — holding < 12 months ───────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS capital_gain_securities_short_yn        VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS capital_gain_securities_short_amount    DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capital_gain_securities_short_tax_rate  DECIMAL(5,2)   DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS capital_gain_securities_short_tax_amount DECIMAL(15,2) DEFAULT 0;

-- ── u/s 37A  Capital Gain on Securities — holding ≥ 12 months ───────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS capital_gain_securities_long_yn         VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS capital_gain_securities_long_amount     DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capital_gain_securities_long_tax_rate   DECIMAL(5,2)   DEFAULT 0.125,
  ADD COLUMN IF NOT EXISTS capital_gain_securities_long_tax_amount DECIMAL(15,2)  DEFAULT 0;

-- ── u/s 233  Commission paid to Stock Exchange Members / Agents ──────────────
ALTER TABLE final_tax_forms
  ADD COLUMN IF NOT EXISTS commission_agents_yn                    VARCHAR(1)     DEFAULT '',
  ADD COLUMN IF NOT EXISTS commission_agents_amount                DECIMAL(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_agents_tax_rate              DECIMAL(5,2)   DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS commission_agents_tax_amount            DECIMAL(15,2)  DEFAULT 0;

COMMIT;
