-- Migration 068: Normalize gross margin safety floor from legacy 75% to platform standard 30%
-- Aligns with ADMIN_UI_DESIGN_SYSTEM and pricing strategy safety red line (minMarginRate: 0.30).

UPDATE ai_studio.model_pricing
SET min_gross_margin_rate = 0.3000, updated_at = NOW()
WHERE min_gross_margin_rate = 0.7500;
