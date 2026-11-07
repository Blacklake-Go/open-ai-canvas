package kernel

import (
	"strings"
	"testing"
)

func TestCalculateUSDOrderPoints(t *testing.T) {
	for _, tc := range []struct {
		name, retail, cost, net string
		margin, want            int64
		err                     error
	}{
		{"approved free", "0", "0.000", "1/128", 0, 0, nil},
		{"positive cost on free", "0.00", "0.000001", "1/128", 0, 0, ErrFreeOrderHasCost},
		{"positive minimum", "0.000001", "0", "0.008", 0, 1, nil},
		{"aggregate before rounding", "0.014", "0", "1/128", 0, 1, nil},
		{"exact half up", "0.015", "0", "1/128", 0, 2, nil},
		{"just below half", "0.364999999999999999", "0", "1/128", 0, 36, nil},
		{"exact break even", "0.01", "0.25", "1/128", 0, 32, nil},
		{"just above break even", "0.01", "0.250001", "1/128", 0, 33, nil},
		{"normal gross margin", "0.01", "0.55", "0.01", 4500, 100, nil},
		{"stress gross margin", "0.01", "0.65", "0.01", 3500, 100, nil},
		{"commercial dominates", "5.99", "0.12", "0.01", 3500, 599, nil},
		{"zero padded decimal ratio", "0.01", "1", "001/010", 0, 10, nil},
		{"no cost record", "0", "", "0.01", 0, 0, ErrInvalidUSDOrderPricing},
		{"no verified net", "0.01", "0", "", 0, 0, ErrInvalidUSDOrderPricing},
		{"retail absent", "", "0", "0.01", 0, 0, ErrInvalidUSDOrderPricing},
		{"net zero", "1", "0", "0", 0, 0, ErrInvalidUSDOrderPricing},
		{"zero denominator", "1", "0", "1/00", 0, 0, ErrInvalidUSDOrderPricing},
		{"negative net", "1", "0", "-0.1", 0, 0, ErrInvalidUSDOrderPricing},
		{"negative cost", "1", "-1", "0.1", 0, 0, ErrInvalidUSDOrderPricing},
		{"negative retail", "-1", "0", "0.1", 0, 0, ErrInvalidUSDOrderPricing},
		{"not finite", "NaN", "0", "0.01", 0, 0, ErrInvalidUSDOrderPricing},
		{"exponent", "1e9999999", "0", "0.01", 0, 0, ErrInvalidUSDOrderPricing},
		{"oversize net", "1", "0", strings.Repeat("9", 129), 0, 0, ErrInvalidUSDOrderPricing},
		{"invalid margin", "1", "0", "0.01", 10000, 0, ErrInvalidUSDOrderPricing},
		{"negative margin", "1", "0", "0.01", -1, 0, ErrInvalidUSDOrderPricing},
		{"ledger maximum", "92233720368.54", "0", "1", 0, 9223372036854, nil},
		{"overflow converting to ledger microcredits", "92233720368.545", "0", "1", 0, 0, ErrOrderPointsOverflow},
		{"exact fractional retail", "73/200", "0", "1/128", 0, 37, nil},
		{"exact fractional cost", "0.01", "1/3", "1/6", 0, 2, nil},
		{"commercial overflow", "92233720368547758.075", "0", "1", 0, 0, ErrOrderPointsOverflow},
		{"cost floor overflow", "1", "9223372036854775808", "1", 0, 0, ErrOrderPointsOverflow},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gross := ""
			if tc.margin > 0 {
				gross = tc.net
			}
			got, err := CalculateUSDOrderPoints(tc.retail, tc.cost, tc.net, tc.margin, gross)
			if got != tc.want || err != tc.err {
				t.Fatalf("got (%d, %v), want (%d, %v)", got, err, tc.want, tc.err)
			}
		})
	}
}

// 分母是用户实付，不能直接在扣费后的净收入上打折。
func TestUSDOrderMarginOnPaidRevenue(t *testing.T) {
	for _, tc := range []struct {
		gross        string
		margin, want int64
		err          error
	}{
		{"0.01", 4500, 100, nil},
		{"", 4500, 0, ErrInvalidUSDOrderPricing},
		{"0.009", 4500, 0, ErrInvalidUSDOrderPricing},
		{"0.03", 4500, 0, ErrInvalidUSDOrderPricing},
	} {
		got, err := CalculateUSDOrderPoints("0.01", "0.52", "0.0097", tc.margin, tc.gross)
		if got != tc.want || err != tc.err {
			t.Errorf("gross=%q: got (%d,%v), want (%d,%v)", tc.gross, got, err, tc.want, tc.err)
		}
	}
}
