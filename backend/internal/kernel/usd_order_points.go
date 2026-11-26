package kernel

import (
	"errors"
	"math"
	"math/big"
	"regexp"
	"strings"
)

// CreditScale 表示一整积分对应的账本微积分数。
const CreditScale int64 = 1_000_000

var (
	ErrInvalidUSDOrderPricing = errors.New("美元整单定价参数无效或缺失")
	ErrFreeOrderHasCost       = errors.New("免费订单存在采购成本")
	ErrOrderPointsOverflow    = errors.New("整单积分超出上限")
	usdDecimal                = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?$`)
	usdFraction               = regexp.MustCompile(`^[0-9]+/[0-9]+$`)
)

// CalculateUSDOrderPoints 按整单商业零售价、已审核的整单美元成本及每分最差税费后净收入计算整数积分。
// 金额接受非负十进制美元或精确比率（如 "1/128"）。未审核的输入必须留空。
// minMarginBPS 以用户实付金额为分母。取 0 时仅校验保本，可留空 grossUSDPerPoint。
func CalculateUSDOrderPoints(retailUSD, approvedCostUSD, worstNetUSDPerPoint string, minMarginBPS int64, grossUSDPerPoint string) (int64, error) {
	commercial, err := USDCommercialOrderPoints(retailUSD)
	if err != nil {
		return 0, err
	}
	cost, okCost := parseOrderUSD(approvedCostUSD)
	net, okNet := parseOrderUSD(worstNetUSDPerPoint)
	if !okCost || !okNet || net.Sign() <= 0 || minMarginBPS < 0 || minMarginBPS >= 10_000 {
		return 0, ErrInvalidUSDOrderPricing
	}
	if minMarginBPS > 0 || grossUSDPerPoint != "" {
		gross, ok := parseOrderUSD(grossUSDPerPoint)
		if !ok || gross.Cmp(net) < 0 {
			return 0, ErrInvalidUSDOrderPricing
		}
		net.Sub(net, gross.Mul(gross, big.NewRat(minMarginBPS, 10_000)))
		if net.Sign() <= 0 {
			return 0, ErrInvalidUSDOrderPricing
		}
	}
	if commercial == 0 {
		if cost.Sign() != 0 {
			return 0, ErrFreeOrderHasCost
		}
		return 0, nil
	}

	// 取满足 points * (net - gross * margin) >= cost 的最小整数。
	required := new(big.Rat).Quo(cost, net)
	var remainder big.Int
	floor := new(big.Int)
	floor.QuoRem(required.Num(), required.Denom(), &remainder)
	if remainder.Sign() != 0 {
		floor.Add(floor, big.NewInt(1))
	}
	requiredPoints, err := ledgerSafePoints(floor)
	if err != nil {
		return 0, err
	}
	return max(commercial, requiredPoints), nil
}

// USDCommercialOrderPoints 按整单零售价计算商业参考积分。上线核价另须核验成本及支付条件。
func USDCommercialOrderPoints(retailUSD string) (int64, error) {
	retail, ok := parseOrderUSD(retailUSD)
	if !ok {
		return 0, ErrInvalidUSDOrderPricing
	}
	if retail.Sign() == 0 {
		return 0, nil
	}
	retail.Mul(retail, big.NewRat(100, 1))
	retail.Add(retail, big.NewRat(1, 2))
	points := new(big.Int).Quo(retail.Num(), retail.Denom())
	if points.Sign() == 0 {
		points.SetInt64(1)
	}
	return ledgerSafePoints(points)
}

func ledgerSafePoints(points *big.Int) (int64, error) {
	if points.Cmp(big.NewInt(math.MaxInt64/CreditScale)) > 0 {
		return 0, ErrOrderPointsOverflow
	}
	return points.Int64(), nil
}

func parseOrderUSD(s string) (*big.Rat, bool) {
	// 限定输入长度和语法以避免无界大数或科学计数法展开。SetString 将前导零的分数作八进制解析。
	if len(s) == 0 || len(s) > 128 {
		return nil, false
	}
	if usdFraction.MatchString(s) {
		n, d, _ := strings.Cut(s, "/")
		num, _ := new(big.Int).SetString(n, 10)
		denom, _ := new(big.Int).SetString(d, 10)
		if denom.Sign() == 0 {
			return nil, false
		}
		return new(big.Rat).SetFrac(num, denom), true
	}
	if !usdDecimal.MatchString(s) {
		return nil, false
	}
	return new(big.Rat).SetString(s)
}
